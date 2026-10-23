// Which part of a plan each waypoint belongs to: departure, cruise or arrival. Pure functions, no React.
//
// The editor shows one tab per part. Tracked flights have real altitudes, so the parts follow the climb and the descent (by
// how far the aircraft flies level, so step climbs work);
// a plan without usable altitudes (a Route Sketch drawing) is split by distance from each airport instead. Whichever
// rule applies, departure and arrival never overlap, and cruise is simply what is left between them (it can be empty).
import { distanceM } from "@/lib/ground-trim"

export interface PhasePoint {
  lat: number
  lng: number
  /** Feet. 0 or less means "no altitude". */
  altitude: number
}

/** Departure is `0..departureEnd`, arrival is `arrivalStart..last`, cruise is everything between (possibly nothing). */
export interface PhaseSplit {
  departureEnd: number
  arrivalStart: number
}

export type Phase = "departure" | "cruise" | "arrival"

const MIN_CRUISE_FT = 10_000
const CRUISE_SHARE = 0.9
const LEVEL_BAND_FT = 1000
const LEVEL_MIN_NM = 15
const LEVEL_MIN_SHARE = 0.1
const LEVEL_FLOOR_SHARE = 0.6
const MIN_ALTITUDE_POINTS = 3
const NM_M = 1852
const END_MAX_NM = 60
const END_MAX_SHARE = 0.25

// Climb and descent are found by how far the aircraft flies level, not by the highest altitude: a flight that climbs
// in steps (FL300, then FL340...) reaches 90% of its top long after the real top of climb, and one that descends in
// steps leaves it long before the real top of descent. A level stretch is a run of points within LEVEL_BAND_FT of each
// other that lasts at least LEVEL_MIN_NM (or a tenth of the flight, for a short one), high enough to be cruise and
// not a hold at 3,000 ft. The departure ends where the first one starts, the arrival begins where the last one ends,
// so every step in between is cruise.
function byAltitude(points: PhasePoint[]): PhaseSplit | null {
  const withAltitude = points.filter((p) => p.altitude > 0)
  if (withAltitude.length < MIN_ALTITUDE_POINTS) return null
  const top = Math.max(...withAltitude.map((p) => p.altitude))
  if (top < MIN_CRUISE_FT) return null

  const along = [0]
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distanceM(points[i - 1], points[i]))
  const minLevelM = Math.min(LEVEL_MIN_NM * NM_M, along[along.length - 1] * LEVEL_MIN_SHARE)

  let first = -1
  let last = -1
  let start = 0
  let low = points[0].altitude
  let high = points[0].altitude
  const closeRun = (end: number) => {
    if (low >= top * LEVEL_FLOOR_SHARE && along[end] - along[start] >= minLevelM) {
      if (first < 0) first = start
      last = end
    }
  }
  for (let i = 1; i < points.length; i++) {
    const nextLow = Math.min(low, points[i].altitude)
    const nextHigh = Math.max(high, points[i].altitude)
    if (nextHigh - nextLow <= LEVEL_BAND_FT) {
      low = nextLow
      high = nextHigh
      continue
    }
    closeRun(i - 1)
    start = i
    low = high = points[i].altitude
  }
  closeRun(points.length - 1)

  if (first >= 0) return { departureEnd: first, arrivalStart: last > first ? last : first + 1 }

  // No level stretch (a flight that climbs and descends without cruising): split around its highest point.
  const level = top * CRUISE_SHARE
  points.forEach((p, i) => {
    if (p.altitude >= level) {
      if (first < 0) first = i
      last = i
    }
  })
  return { departureEnd: first, arrivalStart: last > first ? last : first + 1 }
}

function byDistance(points: PhasePoint[]): PhaseSplit {
  const along = [0]
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distanceM(points[i - 1], points[i]))
  const total = along[along.length - 1]
  const limit = Math.min(END_MAX_NM * NM_M, total * END_MAX_SHARE)
  let departureEnd = 0
  while (departureEnd + 1 < points.length && along[departureEnd + 1] <= limit) departureEnd++
  let arrivalStart = points.length - 1
  while (arrivalStart - 1 >= 0 && total - along[arrivalStart - 1] <= limit) arrivalStart--
  return { departureEnd, arrivalStart }
}

export function splitPhases(points: PhasePoint[]): PhaseSplit {
  const n = points.length
  if (n === 0) return { departureEnd: -1, arrivalStart: 0 }
  if (n < 3) return { departureEnd: 0, arrivalStart: Math.min(1, n) }
  let split = byAltitude(points) ?? byDistance(points)
  // Keep both ends non-empty and apart.
  let { departureEnd, arrivalStart } = split
  departureEnd = Math.min(Math.max(departureEnd, 0), n - 2)
  arrivalStart = Math.min(Math.max(arrivalStart, 1), n - 1)
  if (arrivalStart <= departureEnd) {
    departureEnd = Math.floor((n - 1) / 2)
    arrivalStart = departureEnd + 1
  }
  return { departureEnd, arrivalStart }
}

export function phaseOf(index: number, split: PhaseSplit): Phase {
  if (index <= split.departureEnd) return "departure"
  if (index >= split.arrivalStart) return "arrival"
  return "cruise"
}

/** The index range [from, to) of a part. */
export function phaseRange(phase: Phase, count: number, split: PhaseSplit): [number, number] {
  if (phase === "departure") return [0, Math.min(split.departureEnd + 1, count)]
  if (phase === "arrival") return [Math.min(split.arrivalStart, count), count]
  return [Math.min(split.departureEnd + 1, count), Math.min(split.arrivalStart, count)]
}
