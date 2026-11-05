// Runway guides: a reusable path tied to one runway end. Pure functions, no React, no I/O.
//
// A guide is a stretch of a flight plan stored relative to the runway it starts from (metres along and across the runway
// axis, plus altitude), so it does not depend on absolute coordinates and can be laid onto another runway. Departure is the
// first kind: from the line-up point to the top of climb. The arrival is the second: from the start of the arrival to the
// touchdown point, framed on the runway it lands on. The frame and the ranking are kind-neutral; the extraction and the way a
// guide is laid onto another runway differ (applyGuide / applyArrivalGuide).
//
// Naming and provenance rules live elsewhere (lib/flight-plans.ts, the database): this file only does the geometry.
import { distanceM, isOnRunway, planTrim, type TrimAirport, type TrimPoint } from "@/lib/ground-trim"
import type { PhaseSplit } from "@/lib/route-phases"

const EARTH_M = 6_371_008.8
const rad = (degrees: number) => (degrees * Math.PI) / 180
const deg = (radians: number) => (radians * 180) / Math.PI
const NM_M = 1852

export interface LatLng {
  lat: number
  lng: number
}

/** A point of a plan or of an applied guide. */
export interface GuidePoint extends LatLng {
  altitude: number // feet
  name?: string
}

/** The start of the takeoff roll of one runway end, and the true heading it points to. */
export interface RunwayEnd extends LatLng {
  name: string
  headingTrue: number
}

/** A point in a runway's frame: metres along the heading from the threshold, metres across (positive to the right), feet. */
export interface FramePoint {
  along: number
  across: number
  altitude: number
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry

export function bearingDeg(from: LatLng, to: LatLng): number {
  const dLng = rad(to.lng - from.lng)
  const y = Math.sin(dLng) * Math.cos(rad(to.lat))
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(dLng)
  return (deg(Math.atan2(y, x)) + 360) % 360
}

/** Smallest angle between two headings, 0-180. */
export function angleBetween(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const
export function compassPoint(bearing: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]
}

/** The runway frame of `end`: a point's metres along the runway heading from the threshold, and across (positive right). */
export function toRunwayFrame(point: GuidePoint, end: RunwayEnd): FramePoint {
  const east = rad(point.lng - end.lng) * Math.cos(rad(end.lat)) * EARTH_M
  const north = rad(point.lat - end.lat) * EARTH_M
  const h = rad(end.headingTrue)
  return {
    along: Math.round(east * Math.sin(h) + north * Math.cos(h)),
    across: Math.round(east * Math.cos(h) - north * Math.sin(h)),
    altitude: Math.round(point.altitude),
  }
}

export function fromRunwayFrame(frame: FramePoint, end: RunwayEnd): GuidePoint {
  const h = rad(end.headingTrue)
  const east = frame.along * Math.sin(h) + frame.across * Math.cos(h)
  const north = frame.along * Math.cos(h) - frame.across * Math.sin(h)
  return {
    lat: end.lat + deg(north / EARTH_M),
    lng: end.lng + deg(east / (EARTH_M * Math.cos(rad(end.lat)))),
    altitude: frame.altitude,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Runway ends from the airport data

/** Every named runway end of an airport with its threshold and true heading (from the bearing between the two thresholds). */
export function runwayEnds(airport: TrimAirport): RunwayEnd[] {
  const ends: RunwayEnd[] = []
  for (const row of airport.runways) {
    const [lat1, lng1, lat2, lng2, , , first, second] = row
    if (!first || !second) continue
    ends.push({ name: first, lat: lat1, lng: lng1, headingTrue: bearingDeg({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) })
    ends.push({ name: second, lat: lat2, lng: lng2, headingTrue: bearingDeg({ lat: lat2, lng: lng2 }, { lat: lat1, lng: lng1 }) })
  }
  return ends
}

export function findRunwayEnd(airport: TrimAirport, name: string): RunwayEnd | null {
  return runwayEnds(airport).find((end) => end.name === name) ?? null
}

// ---------------------------------------------------------------------------------------------------------------------
// Detecting a departure in a plan

export const MAX_GUIDE_POINTS = 60
export const MAX_GUIDE_RADIUS_NM = 40
const SIMPLIFY_TOLERANCE_M = 120
const RUNWAY_MATCH_M = 80
const HEADING_MATCH_DEG = 35
const MIN_TOC_NM = 3

export interface DepartureExtraction {
  /** The runway end the departure left from, or null when none could be matched. */
  runwayEnd: string | null
  runwayHeadingTrue: number | null
  /** The path from the line-up point, in the runway frame, at most MAX_GUIDE_POINTS points within MAX_GUIDE_RADIUS_NM. */
  points: FramePoint[]
  /** Bearing and distance from the threshold to the top of climb (the real one, even when the stored path stops earlier). */
  tocBearing: number
  tocDistanceNm: number
  direction: (typeof COMPASS)[number]
  /** True when the pilot named the runway (the detection is then not asked: nothing is guessed). */
  assigned: boolean
  /** "low": the runway was not matched, or the path is too short: the pilot assigns the runway by hand, nothing is guessed. */
  confidence: "high" | "low"
  reasons: string[]
}

// Perpendicular distance of a point from the line a-b, in the frame's plane.
function lineDistance(p: FramePoint, a: FramePoint, b: FramePoint): number {
  const dx = b.along - a.along
  const dy = b.across - a.across
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(p.along - a.along, p.across - a.across)
  return Math.abs(dy * (p.along - a.along) - dx * (p.across - a.across)) / length
}

// Douglas-Peucker: keeps the points that bend the path, drops the ones along straight stretches.
function simplify(points: FramePoint[], tolerance: number): FramePoint[] {
  if (points.length < 3) return points
  const keep = new Array(points.length).fill(false)
  keep[0] = keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [from, to] = stack.pop()!
    let worst = -1
    let worstDistance = tolerance
    for (let i = from + 1; i < to; i++) {
      const distance = lineDistance(points[i], points[from], points[to])
      if (distance > worstDistance) {
        worst = i
        worstDistance = distance
      }
    }
    if (worst >= 0) {
      keep[worst] = true
      stack.push([from, worst], [worst, to])
    }
  }
  return points.filter((_, index) => keep[index])
}

// The point that matters most for the shape, kept when there are still too many: widen the tolerance until it fits.
function limit(points: FramePoint[]): FramePoint[] {
  let tolerance = SIMPLIFY_TOLERANCE_M
  let reduced = simplify(points, tolerance)
  while (reduced.length > MAX_GUIDE_POINTS && tolerance < 20_000) {
    tolerance *= 1.5
    reduced = simplify(points, tolerance)
  }
  return reduced
}

/**
 * The departure of a plan: from the line-up point (found like the ground trim does) to the top of climb. `points` is the plan
 * as it stands (a plan already trimmed starts at the line-up point), `split` says where departure ends (route-phases).
 * `assignedEnd` is a runway end the pilot named ("28L"): the path is then framed on that end whatever the detection says.
 */
export function extractDeparture(points: TrimPoint[], airport: TrimAirport, split: PhaseSplit, assignedEnd?: string): DepartureExtraction | null {
  if (points.length < 4) return null
  const trim = planTrim(points, airport, "departure")
  const lineUp = trim.remove.length // planTrim removes indices 0..lineUp-1
  const toc = Math.min(split.departureEnd, points.length - 1)
  if (toc <= lineUp + 1) return null
  const reasons: string[] = []
  if (trim.approximate) reasons.push("no runway data matched the start of the plan")

  // Which end: the one the pilot named, else the named runway row the line-up point sits on and the end whose heading
  // matches the way the path leaves.
  const start = points[lineUp]
  let end: RunwayEnd | null = null
  if (assignedEnd) {
    end = findRunwayEnd(airport, assignedEnd)
    if (!end) reasons.push("that runway is not in the airport data")
  } else {
    const ahead = points[Math.min(lineUp + 3, toc)]
    const trackBearing = bearingDeg(start, ahead)
    let best: { end: RunwayEnd; off: number } | null = null
    for (const row of airport.runways) {
      if (!row[6] || !row[7] || !isOnRunway(start, [row])) continue
      for (const candidate of runwayEnds({ ...airport, runways: [row] })) {
        const off = angleBetween(candidate.headingTrue, trackBearing)
        if (!best || off < best.off) best = { end: candidate, off }
      }
    }
    end = best && best.off <= HEADING_MATCH_DEG ? best.end : null
    if (!end) reasons.push(best ? "the path does not leave along a runway heading" : "the line-up point is not on a named runway")
  }

  // The path in the runway frame (or, with no runway, relative to the line-up point, heading along the first leg).
  const anchor: RunwayEnd = end ?? { name: "", lat: start.lat, lng: start.lng, headingTrue: bearingDeg(start, points[Math.min(lineUp + 3, toc)]) }
  const framed: FramePoint[] = []
  for (let i = lineUp; i <= toc; i++) {
    if (distanceM(anchor, points[i]) / NM_M > MAX_GUIDE_RADIUS_NM) break
    framed.push(toRunwayFrame(points[i], anchor))
  }
  const stored = limit(framed)
  if (stored.length < 3) reasons.push("the departure is too short to keep")

  const tocBearing = bearingDeg(anchor, points[toc])
  const tocDistanceNm = distanceM(anchor, points[toc]) / NM_M
  if (tocDistanceNm < MIN_TOC_NM) reasons.push("the top of climb is very close to the airport")

  return {
    runwayEnd: end?.name ?? null,
    runwayHeadingTrue: end ? Math.round(end.headingTrue) : null,
    points: stored,
    tocBearing: Math.round(tocBearing),
    tocDistanceNm: Math.round(tocDistanceNm),
    direction: compassPoint(tocBearing),
    assigned: Boolean(assignedEnd && end),
    confidence: reasons.length === 0 ? "high" : "low",
    reasons,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Detecting an arrival in a plan

export interface ArrivalExtraction extends DepartureExtraction {
  /** Index in the plan of the first waypoint the guide covers (the arrival, from where it comes within MAX_GUIDE_RADIUS_NM). */
  fromIndex: number
}

/**
 * The arrival of a plan: from the start of the arrival (route-phases) to the touchdown point (found like the ground trim does),
 * framed on the runway end it lands on. `tocBearing` and `tocDistanceNm` describe the start of the arrival (where the plan comes
 * from), seen from the threshold. `assignedEnd` is a runway end the pilot named: the path is then framed on that end.
 */
export function extractArrival(points: TrimPoint[], airport: TrimAirport, split: PhaseSplit, assignedEnd?: string): ArrivalExtraction | null {
  if (points.length < 4) return null
  const trim = planTrim(points, airport, "arrival")
  const touchdown = points.length - 1 - trim.remove.length
  const startOfArrival = Math.max(0, split.arrivalStart)
  if (touchdown - startOfArrival < 2) return null
  const reasons: string[] = []
  if (trim.approximate) reasons.push("no runway data matched the end of the plan")

  const landing = points[touchdown]
  const approach = points[Math.max(startOfArrival, touchdown - 3)]
  const trackBearing = bearingDeg(approach, landing)
  let end: RunwayEnd | null = null
  if (assignedEnd) {
    end = findRunwayEnd(airport, assignedEnd)
    if (!end) reasons.push("that runway is not in the airport data")
  } else {
    let best: { end: RunwayEnd; off: number } | null = null
    for (const row of airport.runways) {
      if (!row[6] || !row[7] || !isOnRunway(landing, [row])) continue
      for (const candidate of runwayEnds({ ...airport, runways: [row] })) {
        const off = angleBetween(candidate.headingTrue, trackBearing)
        if (!best || off < best.off) best = { end: candidate, off }
      }
    }
    end = best && best.off <= HEADING_MATCH_DEG ? best.end : null
    if (!end) reasons.push(best ? "the path does not arrive along a runway heading" : "the touchdown point is not on a named runway")
  }

  const anchor: RunwayEnd = end ?? { name: "", lat: landing.lat, lng: landing.lng, headingTrue: trackBearing }
  // Where the guide starts: the first point of the arrival that is within the guide radius of the runway.
  let fromIndex = startOfArrival
  while (fromIndex < touchdown - 1 && distanceM(anchor, points[fromIndex]) / NM_M > MAX_GUIDE_RADIUS_NM) fromIndex++
  const framed: FramePoint[] = []
  for (let i = fromIndex; i <= touchdown; i++) framed.push(toRunwayFrame(points[i], anchor))
  let stored = limit(framed)
  // A straight final simplifies to two points: keep the middle one too (a guide has at least three, and it carries an altitude).
  if (stored.length < 3 && framed.length >= 3) {
    const middle = framed[Math.floor(framed.length / 2)]
    stored = [stored[0], middle, stored[stored.length - 1]]
  }
  if (stored.length < 3) reasons.push("the arrival is too short to keep")

  const start = points[startOfArrival]
  const startBearing = bearingDeg(anchor, start)
  const startDistanceNm = distanceM(anchor, start) / NM_M
  if (startDistanceNm < MIN_TOC_NM) reasons.push("the start of the arrival is very close to the airport")

  return {
    runwayEnd: end?.name ?? null,
    runwayHeadingTrue: end ? Math.round(end.headingTrue) : null,
    points: stored,
    tocBearing: Math.round(startBearing),
    tocDistanceNm: Math.round(startDistanceNm),
    direction: compassPoint(startBearing),
    assigned: Boolean(assignedEnd && end),
    confidence: reasons.length === 0 ? "high" : "low",
    reasons,
    fromIndex,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Laying a guide onto a runway

export const SAME_HEADING_DEG = 15 // within this a guide is re-anchored (the same runway, a parallel one, a near neighbour)
const MERGE_FROM_M = 3_000 // a re-anchored guide on another runway rejoins the original track between here...
const MERGE_TO_M = 10_000 // ...and here
const STUB_M = 5_000 // on a different heading: straight out along the target runway this far
const JOIN_MIN_M = 6_000 // ...then onto the original path from the first point at least this far from the source threshold

export type ApplyMode = "reanchored" | "merged" | "joined"

export interface AppliedGuide {
  points: GuidePoint[]
  mode: ApplyMode
  warnings: string[]
}

export interface GuideGeometry {
  runwayEnd: string | null
  runwayHeadingTrue: number | null
  points: FramePoint[]
}

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * The guide's path laid onto `target`. `source` is the runway end the guide was recorded from (looked up in the airport data;
 * null when unknown). On the same end: the original path. On a runway with a similar heading (a parallel one): the path
 * re-anchored on the target and, between 3 and 10 km out, blended back onto the original track so both end up on the same
 * route. On a different heading: straight out along the target runway, then the original path from the first point that
 * is at least 6 km from where it started, with a warning to check terrain and obstacles.
 */
export function applyGuide(guide: GuideGeometry, source: RunwayEnd | null, target: RunwayEnd): AppliedGuide {
  const anchored = guide.points.map((point) => fromRunwayFrame(point, target))
  if (source && source.name === target.name) {
    return { points: guide.points.map((point) => fromRunwayFrame(point, source)), mode: "reanchored", warnings: [] }
  }
  const similar = guide.runwayHeadingTrue !== null && angleBetween(guide.runwayHeadingTrue, target.headingTrue) <= SAME_HEADING_DEG
  if (similar) {
    if (!source) return { points: anchored, mode: "reanchored", warnings: [] }
    const points = guide.points.map((point, index) => {
      const original = fromRunwayFrame(point, source)
      const weight = smoothstep((point.along - MERGE_FROM_M) / (MERGE_TO_M - MERGE_FROM_M))
      return {
        lat: anchored[index].lat * (1 - weight) + original.lat * weight,
        lng: anchored[index].lng * (1 - weight) + original.lng * weight,
        altitude: point.altitude,
      }
    })
    return { points, mode: "merged", warnings: [] }
  }
  // A different heading: the guide's own track cannot start from this runway. Join it.
  const warnings = ["Different runway heading: check the terrain and obstacles on the joining leg."]
  if (!source) return { points: anchored, mode: "joined", warnings: [...warnings, "The original runway is unknown, so the path is only rotated onto this runway."] }
  const distances = guide.points.map((point) => Math.hypot(point.along, point.across))
  const firstFar = distances.findIndex((distance) => distance >= JOIN_MIN_M)
  if (firstFar < 0) return { points: anchored, mode: "joined", warnings }
  // Altitude of the stub: what the original path had at that distance.
  const stubAltitude = guide.points[Math.max(0, firstFar - 1)].altitude
  const stub = fromRunwayFrame({ along: STUB_M, across: 0, altitude: stubAltitude }, target)
  const start = fromRunwayFrame({ along: 0, across: 0, altitude: guide.points[0].altitude }, target)
  const rest = guide.points.slice(firstFar).map((point) => fromRunwayFrame(point, source))
  return { points: [start, stub, ...rest], mode: "joined", warnings }
}

const ARRIVAL_JOIN_MIN_M = 12_000 // a re-routed arrival keeps the original path as far as the last point at least this far from the threshold...
const ARRIVAL_STUB_M = 8_000 // ...then lines up on the target runway this far out (a straight-in final)

/**
 * The arrival's path laid onto `target`: the mirror of applyGuide. On the same end: the original path. On a runway with a similar
 * heading: the path re-anchored on the target, blended back onto the original track further out (10 to 3 km from the threshold),
 * so the far part of the arrival is untouched. On a different heading: the original path as far as its last point 12 km or more from
 * the threshold, then a straight-in final along the target runway, with a warning to check terrain and obstacles.
 */
export function applyArrivalGuide(guide: GuideGeometry, source: RunwayEnd | null, target: RunwayEnd): AppliedGuide {
  const anchored = guide.points.map((point) => fromRunwayFrame(point, target))
  if (source && source.name === target.name) {
    return { points: guide.points.map((point) => fromRunwayFrame(point, source)), mode: "reanchored", warnings: [] }
  }
  const similar = guide.runwayHeadingTrue !== null && angleBetween(guide.runwayHeadingTrue, target.headingTrue) <= SAME_HEADING_DEG
  if (similar) {
    if (!source) return { points: anchored, mode: "reanchored", warnings: [] }
    const points = guide.points.map((point, index) => {
      const original = fromRunwayFrame(point, source)
      // Far from the threshold the original track, near it the target runway.
      const weight = smoothstep((Math.hypot(point.along, point.across) - MERGE_FROM_M) / (MERGE_TO_M - MERGE_FROM_M))
      return {
        lat: anchored[index].lat * (1 - weight) + original.lat * weight,
        lng: anchored[index].lng * (1 - weight) + original.lng * weight,
        altitude: point.altitude,
      }
    })
    return { points, mode: "merged", warnings: [] }
  }
  const warnings = ["Different runway heading: check the terrain and obstacles on the final leg."]
  if (!source) return { points: anchored, mode: "joined", warnings: [...warnings, "The original runway is unknown, so the path is only rotated onto this runway."] }
  let lastFar = -1
  guide.points.forEach((point, index) => {
    if (Math.hypot(point.along, point.across) >= ARRIVAL_JOIN_MIN_M) lastFar = index
  })
  if (lastFar < 0) return { points: anchored, mode: "joined", warnings }
  const kept = guide.points.slice(0, lastFar + 1).map((point) => fromRunwayFrame(point, source))
  // Altitude of the stub: what the original path had at about that distance from the threshold.
  const stubSource = guide.points.find((point, index) => index > lastFar && Math.hypot(point.along, point.across) <= ARRIVAL_STUB_M) ?? guide.points[lastFar]
  const stub = fromRunwayFrame({ along: -ARRIVAL_STUB_M, across: 0, altitude: stubSource.altitude }, target)
  const last = guide.points[guide.points.length - 1]
  const touchdown = fromRunwayFrame({ along: Math.max(0, last.along), across: 0, altitude: last.altitude }, target)
  return { points: [...kept, stub, touchdown], mode: "joined", warnings }
}

// ---------------------------------------------------------------------------------------------------------------------
// Ranking guides for a runway

export type GuideFit = "same end" | "parallel" | "similar heading" | "other"

export interface RankableGuide {
  id: string
  runwayEnd: string | null
  runwayHeadingTrue: number | null
  tocBearing: number | null
  useCount?: number
}

export interface RankedGuide<T extends RankableGuide> {
  guide: T
  fit: GuideFit
  score: number
}

/** The guides for `target`, best first: the same end, then a parallel or similar heading, then others pointing the plan's way. */
export function rankGuides<T extends RankableGuide>(guides: T[], target: RunwayEnd, wantedBearing: number | null): RankedGuide<T>[] {
  const ranked = guides.map((guide): RankedGuide<T> => {
    const headingOff = guide.runwayHeadingTrue === null ? 180 : angleBetween(guide.runwayHeadingTrue, target.headingTrue)
    const fit: GuideFit =
      guide.runwayEnd === target.name ? "same end" : headingOff <= 5 ? "parallel" : headingOff <= SAME_HEADING_DEG ? "similar heading" : "other"
    let score = { "same end": 100, parallel: 80, "similar heading": 60, other: 20 }[fit]
    if (wantedBearing !== null && guide.tocBearing !== null) score += (45 - Math.min(45, angleBetween(guide.tocBearing, wantedBearing))) / 45 * 20
    score += Math.min(5, Math.log1p(guide.useCount ?? 0))
    return { guide, fit, score }
  })
  return ranked.sort((a, b) => b.score - a.score || (a.guide.id < b.guide.id ? -1 : 1))
}
