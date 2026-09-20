interface LatLngPoint {
  lat: number
  lng: number
}

// Haversine distance in kilometers, mirrors the calculation already used in
// flight-plan-editor.tsx for waypoint distances.
function distanceKm(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function cubicBezierPoint(p0: LatLngPoint, p1: LatLngPoint, p2: LatLngPoint, p3: LatLngPoint, t: number): LatLngPoint {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    lat: a * p0.lat + b * p1.lat + c * p2.lat + d * p3.lat,
    lng: a * p0.lng + b * p1.lng + c * p2.lng + d * p3.lng,
  }
}

function approxChordLength(points: LatLngPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += distanceKm(points[i - 1], points[i])
  }
  return total
}

// Samples a cubic bezier curve (p0 = start anchor, p1 = start's outgoing
// handle, p2 = end's incoming handle, p3 = end anchor) into waypoints,
// roughly one point per 40km of chord length, clamped to a sensible range so
// short hops still get a couple of points and long curves don't produce an
// unreasonable number of waypoints. The start point (p0) is excluded since
// it's already an existing waypoint on the route.
export function sampleCubicBezier(p0: LatLngPoint, p1: LatLngPoint, p2: LatLngPoint, p3: LatLngPoint): LatLngPoint[] {
  const approxLength = approxChordLength([p0, p1, p2, p3])
  const sampleCount = Math.min(12, Math.max(3, Math.round(approxLength / 40)))

  const points: LatLngPoint[] = []
  for (let i = 1; i <= sampleCount; i++) {
    const t = i / sampleCount
    points.push(cubicBezierPoint(p0, p1, p2, p3, t))
  }
  return points
}
