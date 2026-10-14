// Geometry behind every picture of a route: the plan page's map and altitude graph, the library
// thumbnails and the preview image of a link. One implementation, pure functions, no React: it
// runs on the server (pages, OG image) and costs the browser nothing.

export interface RoutePoint {
  lat: number
  lng: number
  altitude?: number
}

export interface Point {
  x: number
  y: number
}

export interface Frame {
  width: number
  height: number
  pad: number
}

// Longitudes unwrapped so a route crossing the antimeridian stays in one piece (170E -> 170W
// continues at 190E instead of jumping across the whole map).
export function unwrapLongitudes<T extends { lng: number }>(waypoints: T[]): T[] {
  const unwrapped: T[] = []
  waypoints.forEach((w, i) => {
    let lng = w.lng
    if (i > 0) {
      const prev = unwrapped[i - 1].lng
      while (lng - prev > 180) lng -= 360
      while (lng - prev < -180) lng += 360
    }
    unwrapped.push({ ...w, lng })
  })
  return unwrapped
}

// Equirectangular projection fitted to a route inside a frame, aspect ratio kept, centered. `project`
// goes from a position to the frame, `unproject` back, so a picture can also be filled with the
// map around the route (land dots) and not only the route itself.
export interface Projection {
  project: (lat: number, lng: number) => Point
  unproject: (x: number, y: number) => { lat: number; lng: number }
  // The route's longitudes unwrapped (continuous across the antimeridian).
  route: RoutePoint[]
}

export function createProjection(waypoints: RoutePoint[], frame: Frame, minSpanDeg = 0.01): Projection {
  const route = unwrapLongitudes(waypoints)
  const lats = route.map((w) => w.lat)
  const lngs = route.map((w) => w.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.max(0.05, Math.cos((midLat * Math.PI) / 180))
  const minLng = Math.min(...lngs)
  const maxLat = Math.max(...lats)
  const spanX = Math.max((Math.max(...lngs) - minLng) * k, minSpanDeg)
  const spanY = Math.max(maxLat - Math.min(...lats), minSpanDeg)
  const centerX = minLng * k + ((Math.max(...lngs) - minLng) * k) / 2
  const centerY = maxLat - (maxLat - Math.min(...lats)) / 2

  const innerW = frame.width - frame.pad * 2
  const innerH = frame.height - frame.pad * 2
  const scale = Math.min(innerW / spanX, innerH / spanY)

  return {
    route,
    project: (lat, lng) => ({
      x: frame.width / 2 + (lng * k - centerX) * scale,
      y: frame.height / 2 + (centerY - lat) * scale,
    }),
    unproject: (x, y) => ({
      lat: centerY - (y - frame.height / 2) / scale,
      lng: (centerX + (x - frame.width / 2) / scale) / k,
    }),
  }
}

export function projectRoute(waypoints: RoutePoint[], frame: Frame): Point[] {
  if (waypoints.length === 0) return []
  const { project, route } = createProjection(waypoints, frame)
  return route.map((w) => project(w.lat, w.lng))
}

// Thousands of waypoints are pointless at picture size: keep every n-th one and the last.
export function sampleWaypoints<T>(waypoints: T[], max: number): T[] {
  const step = Math.max(1, Math.ceil(waypoints.length / max))
  return waypoints.filter((_, i) => i % step === 0 || i === waypoints.length - 1)
}

export function toSvgPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
}

const EARTH_RADIUS_NM = 3440.065

export function distanceNm(a: RoutePoint, b: RoutePoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Altitude against distance flown. x runs 0..width over the route's length, y maps 0..maxAltitude
// to the plot's height (a flat profile still gets a visible line).
export interface AltitudeProfile {
  line: string
  area: string
  points: Point[]
  maxAltitudeFt: number
  totalNm: number
}

export function altitudeProfile(waypoints: Required<RoutePoint>[], frame: Frame): AltitudeProfile {
  const totalNm = waypoints.reduce((sum, w, i) => (i === 0 ? 0 : sum + distanceNm(waypoints[i - 1], w)), 0)
  const maxAltitudeFt = Math.max(0, ...waypoints.map((w) => w.altitude))
  const top = Math.max(maxAltitudeFt, 1000)

  const innerW = frame.width - frame.pad * 2
  const innerH = frame.height - frame.pad * 2
  let travelled = 0
  const points = waypoints.map((w, i) => {
    if (i > 0) travelled += distanceNm(waypoints[i - 1], w)
    return {
      x: frame.pad + (totalNm > 0 ? travelled / totalNm : i / Math.max(1, waypoints.length - 1)) * innerW,
      y: frame.pad + innerH - (Math.max(0, w.altitude) / top) * innerH,
    }
  })

  const line = toSvgPath(points)
  const baseline = frame.pad + innerH
  const first = points[0]
  const last = points[points.length - 1]
  const area = points.length ? `${line} L${last.x.toFixed(1)} ${baseline} L${first.x.toFixed(1)} ${baseline} Z` : ""
  return { line, area, points, maxAltitudeFt, totalNm }
}

// "FL370" at and above 18,000 ft, "8,500 ft" below.
export function formatAltitude(feet: number): string {
  if (feet >= 18000) return `FL${String(Math.round(feet / 100)).padStart(3, "0")}`
  return `${feet.toLocaleString("en-US")} ft`
}

export function formatDistanceNm(nm: number): string {
  return `${Math.round(nm).toLocaleString("en-US")} NM`
}
