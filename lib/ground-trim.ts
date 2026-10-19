// Ground trimming: removes the taxi and rollout waypoints before take-off and after landing, so a tracked flight
// starts at the runway line-up point and ends at touchdown. Pure functions, no React: the editor calls them and
// shows the result as a preview before anything is removed.

export interface TrimPoint {
  lat: number
  lng: number
  /** Feet. Tracker altitudes are noisy near the ground. */
  altitude: number
}

/** [lat1, lng1, lat2, lng2, lengthFt, widthFt]: the two thresholds of one runway. */
export type RunwayRow = [number, number, number, number, number, number]

export interface TrimAirport {
  elevationFt: number | null
  lat: number
  lng: number
  runways: RunwayRow[]
  /** The two names of every open runway, e.g. ["13R", "31L"]. Not used by trimming; the airport panel offers them. */
  names?: [string, string][]
}

export type TrimEnd = "departure" | "arrival"

export interface TrimResult {
  /** Indices (in the plan as given) of the waypoints to remove, ascending. Empty when there is nothing to remove. */
  remove: number[]
  /** True when no runway data matched and the airport-radius fallback decided. */
  approximate: boolean
}

const EARTH_M = 6_371_008.8
const FEET_TO_M = 0.3048
const AIRBORNE_FT = 200
const RUNWAY_MIN_TOLERANCE_M = 45
const RUNWAY_EXTRA_M = 15
const FALLBACK_RADIUS_NM = 3
const FALLBACK_BELOW_FT = 50
const NM_M = 1852
// How far back from the first airborne waypoint to look for the runway roll, and how many waypoints in a row may
// miss the runway inside it (tracker positions are noisy and sparse).
const ROLL_LOOKBACK = 40
const ROLL_GAP = 1

const rad = (deg: number) => (deg * Math.PI) / 180

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Distance from a point to a segment, on a flat plane around the point (runways are a few km at most).
function distanceToSegmentM(p: { lat: number; lng: number }, row: RunwayRow): number {
  const kx = Math.cos(rad(p.lat)) * rad(1) * EARTH_M
  const ky = rad(1) * EARTH_M
  const ax = (row[1] - p.lng) * kx
  const ay = (row[0] - p.lat) * ky
  const bx = (row[3] - p.lng) * kx
  const by = (row[2] - p.lat) * ky
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

/** A waypoint is "on a runway" within max(45 m, half the runway width + 15 m) of its centre line. */
export function isOnRunway(point: TrimPoint, runways: RunwayRow[]): boolean {
  return runways.some((row) => {
    const tolerance = Math.max(RUNWAY_MIN_TOLERANCE_M, (row[5] * FEET_TO_M) / 2 + RUNWAY_EXTRA_M)
    return distanceToSegmentM(point, row) <= tolerance
  })
}

// Without a field elevation, the lowest altitude of the first waypoints stands in for it.
function fieldElevation(points: TrimPoint[], airport: TrimAirport): number {
  if (airport.elevationFt !== null) return airport.elevationFt
  return Math.min(...points.slice(0, 10).map((p) => p.altitude))
}

/**
 * Trims the start of the plan. Returns the indices to remove, or an empty list. `anchor` picks which waypoint of the
 * runway roll becomes waypoint 1: the first one (departure: the line-up point, the roll stays) or the last one before
 * the plan leaves the runway (arrival, seen backwards: the touchdown point, the rollout goes).
 */
function trimStart(points: TrimPoint[], airport: TrimAirport, anchor: "first" | "last"): TrimResult {
  if (points.length < 3) return { remove: [], approximate: false }
  const elevation = fieldElevation(points, airport)
  const away = points.map((p) => distanceM(p, airport))

  // First waypoint that is airborne and not coming back towards the field.
  let airborne = -1
  for (let i = 1; i < points.length; i++) {
    if (points[i].altitude >= elevation + AIRBORNE_FT && away[i] >= away[i - 1] - 50) {
      airborne = i
      break
    }
  }

  if (airport.runways.length > 0 && airborne > 0) {
    // The last on-runway waypoint at or just before take-off, then back to the start of that run.
    let last = -1
    for (let i = airborne; i >= Math.max(0, airborne - ROLL_LOOKBACK); i--) {
      if (isOnRunway(points[i], airport.runways)) {
        last = i
        break
      }
    }
    if (last >= 0) {
      let first = last
      let misses = 0
      for (let i = last - 1; i >= 0; i--) {
        if (isOnRunway(points[i], airport.runways)) {
          first = i
          misses = 0
        } else if (++misses > ROLL_GAP) break
      }
      // The anchor waypoint becomes waypoint 1 and the next one must still be there.
      const keepFrom = anchor === "first" ? first : last
      if (keepFrom >= 1 && points.length - keepFrom >= 2) {
        return { remove: Array.from({ length: keepFrom }, (_, i) => i), approximate: false }
      }
      if (keepFrom === 0) return { remove: [], approximate: false }
    }
  }

  // No usable runway match: drop the slow waypoints close to the airport, keeping the last one before the climb.
  let n = 0
  while (
    n < points.length - 1 &&
    distanceM(points[n], airport) <= FALLBACK_RADIUS_NM * NM_M &&
    points[n].altitude < elevation + FALLBACK_BELOW_FT
  ) {
    n++
  }
  const count = n - 1
  if (count >= 1 && points.length - count >= 2) {
    return { remove: Array.from({ length: count }, (_, i) => i), approximate: true }
  }
  return { remove: [], approximate: airport.runways.length === 0 }
}

/**
 * Which waypoints to remove at one end of the plan. The arrival is the departure seen backwards, except that it ends at
 * the touchdown point (the first on-runway waypoint of the final run) where the departure starts at the line-up
 * point. Never leaves fewer than 2 waypoints, never touches the ones between
 * line-up and touchdown.
 */
export function planTrim(points: TrimPoint[], airport: TrimAirport, end: TrimEnd): TrimResult {
  if (points.length < 3) return { remove: [], approximate: false }
  if (end === "departure") return trimStart(points, airport, "first")
  const reversed = [...points].reverse()
  const result = trimStart(reversed, airport, "last")
  const last = points.length - 1
  return { remove: result.remove.map((i) => last - i).sort((a, b) => a - b), approximate: result.approximate }
}
