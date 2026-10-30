// Run with `pnpm test:runway-guide`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import runwaysJson from "@/lib/data/runways.json"
import type { RunwayRow, TrimAirport, TrimPoint } from "@/lib/ground-trim"
import { distanceM } from "@/lib/ground-trim"
import { splitPhases } from "@/lib/route-phases"
import { guideErrorKey, pointsToPayload, rowToGuide } from "@/lib/runway-guide-client"
import {
  angleBetween,
  applyGuide,
  bearingDeg,
  compassPoint,
  extractDeparture,
  findRunwayEnd,
  fromRunwayFrame,
  MAX_GUIDE_POINTS,
  rankGuides,
  runwayEnds,
  toRunwayFrame,
  type GuideGeometry,
  type LatLng,
} from "@/lib/runway-guide"

const data = runwaysJson as unknown as Record<string, [number | null, number, number, RunwayRow[], unknown[]]>
const KDTW: TrimAirport = { elevationFt: data.KDTW[0], lat: data.KDTW[1], lng: data.KDTW[2], runways: data.KDTW[3] }

// A point `meters` from `from` along `bearing`: the great-circle formula, independent of the module under test.
const EARTH = 6_371_008.8
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
function offset(from: LatLng, bearing: number, meters: number): LatLng {
  const d = meters / EARTH
  const b = rad(bearing)
  const lat1 = rad(from.lat)
  const lng1 = rad(from.lng)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: deg(lat2), lng: deg(lng2) }
}
const near = (a: LatLng, b: LatLng, metres: number, message = "") => assert.ok(distanceM(a, b) <= metres, `${message} ${Math.round(distanceM(a, b))} m apart`)

// KDTW's runways and their ends: 21L starts at the north-east end of the 03R/21L row, pointing about 209 degrees true.
const ends = runwayEnds(KDTW)
assert.equal(ends.length, 12)
const e21L = findRunwayEnd(KDTW, "21L")!
const e21R = findRunwayEnd(KDTW, "21R")!
const e09L = findRunwayEnd(KDTW, "09L")!
assert.ok(angleBetween(e21L.headingTrue, 209) < 3, `21L heading ${e21L.headingTrue}`)
assert.ok(angleBetween(e09L.headingTrue, 89) < 3)
assert.equal(findRunwayEnd(KDTW, "99X"), null)

// 1. The frame is a clean round trip, and means what it says (along the heading, positive across to the right).
{
  const p = offset(e21L, e21L.headingTrue, 4_000)
  const frame = toRunwayFrame({ ...p, altitude: 1500 }, e21L)
  assert.ok(Math.abs(frame.along - 4_000) <= 2 && Math.abs(frame.across) <= 2 && frame.altitude === 1500, JSON.stringify(frame))
  const right = offset(e21L, e21L.headingTrue + 90, 700)
  assert.ok(Math.abs(toRunwayFrame({ ...right, altitude: 0 }, e21L).across - 700) <= 2)
  const left = offset(e21L, e21L.headingTrue - 90, 700)
  assert.ok(Math.abs(toRunwayFrame({ ...left, altitude: 0 }, e21L).across + 700) <= 2)
  for (const [along, across] of [[0, 0], [12_345, -2_000], [60_000, 8_000], [-500, 300]]) {
    const back = toRunwayFrame(fromRunwayFrame({ along, across, altitude: 700 }, e21L), e21L)
    assert.ok(Math.abs(back.along - along) <= 2 && Math.abs(back.across - across) <= 2, `${along},${across} -> ${JSON.stringify(back)}`)
  }
  assert.equal(compassPoint(0), "north")
  assert.equal(compassPoint(359), "north")
  assert.equal(compassPoint(268), "west")
  assert.equal(compassPoint(225), "south-west")
}

// 2. A synthetic departure from 21L: taxi, roll, climb straight out, a right turn to the west, climb, cruise.
const gate = offset(e21L, 120, 700) // off the runway
const track: TrimPoint[] = [
  ...[0, 1, 2, 3, 4].map((i) => ({ ...offset(gate, 300 + i * 40, 60 + i * 80), altitude: 645 })),
  ...[0, 400, 900, 1500, 2200].map((m, i) => ({ ...offset(e21L, e21L.headingTrue, m), altitude: 645 + i * 8 })),
]
let here: LatLng = offset(e21L, e21L.headingTrue, 2200)
for (const [bearing, metres, altitude] of [[209, 1300, 1500], [209, 2500, 2800], [209, 3000, 4000], [235, 4000, 6000], [260, 6000, 8500], [270, 15_000, 13_000], [270, 25_000, 20_000], [272, 45_000, 28_000], [272, 50_000, 33_000]] as const) {
  here = offset(here, bearing, metres)
  track.push({ ...here, altitude })
}
for (let i = 0; i < 6; i++) {
  here = offset(here, 270, 80_000)
  track.push({ ...here, altitude: 35_000 })
}
const split = splitPhases(track)
const tocIndex = split.departureEnd
assert.equal(track[tocIndex].altitude, 33_000) // first point at 90% of the 35,000 ft maximum

{
  const found = extractDeparture(track, KDTW, split)!
  assert.ok(found, "found a departure")
  assert.equal(found.runwayEnd, "21L")
  assert.ok(found.runwayHeadingTrue !== null && angleBetween(found.runwayHeadingTrue, 209) < 3)
  assert.equal(found.confidence, "high", found.reasons.join("; "))
  assert.ok(found.points.length >= 3 && found.points.length <= MAX_GUIDE_POINTS, `points ${found.points.length}`)
  // Starts at the line-up point (the first roll waypoint, on the threshold), taxi left out.
  assert.ok(Math.abs(found.points[0].along) <= 60 && Math.abs(found.points[0].across) <= 60, JSON.stringify(found.points[0]))
  assert.ok(found.points.every((p) => Math.hypot(p.along, p.across) / 1852 <= 40.5))
  assert.equal(found.direction, "west")
  assert.ok(found.tocDistanceNm > 40)
  assert.ok(angleBetween(found.tocBearing, 270) < 15)
}

// 3. Not on a runway we can name: low confidence, nothing guessed.
{
  const noRunways = extractDeparture(track, { ...KDTW, runways: [] }, split)
  assert.ok(noRunways)
  assert.equal(noRunways!.runwayEnd, null)
  assert.equal(noRunways!.confidence, "low")
  assert.ok(noRunways!.reasons.length > 0)
  assert.equal(extractDeparture(track.slice(0, 3), KDTW, split), null)
  assert.equal(extractDeparture(track, KDTW, { departureEnd: 2, arrivalStart: 30 }), null)
}

// 3b. The pilot names the runway: a drawn route that starts at the airport centre, not on a runway.
{
  const drawn: TrimPoint[] = [
    { lat: KDTW.lat, lng: KDTW.lng, altitude: 0 },
    ...track.slice(14).map((p) => ({ lat: p.lat, lng: p.lng, altitude: p.altitude })),
  ]
  const drawnSplit = splitPhases(drawn)
  const auto = extractDeparture(drawn, KDTW, drawnSplit)
  assert.ok(auto)
  assert.equal(auto!.runwayEnd, null) // not on a runway: nothing guessed
  assert.equal(auto!.confidence, "low")
  assert.equal(auto!.assigned, false)
  const assigned = extractDeparture(drawn, KDTW, drawnSplit, "21L")!
  assert.equal(assigned.runwayEnd, "21L")
  assert.equal(assigned.assigned, true)
  assert.equal(assigned.confidence, "high")
  assert.ok(assigned.runwayHeadingTrue !== null && angleBetween(assigned.runwayHeadingTrue, 209) < 3)
  // A runway that does not exist at that airport stays low confidence with no runway.
  const wrong = extractDeparture(drawn, KDTW, drawnSplit, "99X")!
  assert.equal(wrong.runwayEnd, null)
  assert.equal(wrong.confidence, "low")
  assert.equal(wrong.assigned, false)
}

// 4. A long, dense departure is thinned to at most 60 points, keeping the shape.
{
  const dense: TrimPoint[] = [...track.slice(0, 10)]
  let p: LatLng = offset(e21L, e21L.headingTrue, 2200)
  for (let i = 0; i < 400; i++) {
    p = offset(p, 209 + (i < 200 ? 0 : 60), 250)
    dense.push({ ...p, altitude: Math.min(33_000, 700 + i * 90) })
  }
  for (let i = 0; i < 4; i++) {
    p = offset(p, 270, 80_000)
    dense.push({ ...p, altitude: 35_000 })
  }
  const found = extractDeparture(dense, KDTW, splitPhases(dense))!
  assert.ok(found.points.length <= MAX_GUIDE_POINTS, `points ${found.points.length}`)
  assert.ok(found.points.length >= 3)
}

// 5. Laying the guide onto runways.
{
  const found = extractDeparture(track, KDTW, split)!
  const guide: GuideGeometry = { runwayEnd: found.runwayEnd, runwayHeadingTrue: found.runwayHeadingTrue, points: found.points }
  const original = found.points.map((p) => fromRunwayFrame(p, { ...e21L, headingTrue: found.runwayHeadingTrue! }))

  // The same end: the recorded path, to the metre (the stored heading is rounded, so allow a few metres).
  const same = applyGuide(guide, e21L, e21L)
  assert.equal(same.mode, "reanchored")
  assert.equal(same.points.length, guide.points.length)
  same.points.forEach((p, i) => near(p, fromRunwayFrame(guide.points[i], e21L), 2, `same ${i}`))
  assert.equal(same.warnings.length, 0)

  // A parallel runway (21R): starts at its own threshold, rejoins the original track far out.
  const parallel = applyGuide(guide, e21L, e21R)
  assert.equal(parallel.mode, "merged")
  assert.equal(parallel.points.length, guide.points.length)
  near(parallel.points[0], fromRunwayFrame(guide.points[0], e21R), 3, "parallel start")
  const far = guide.points.map((p, i) => ({ p, i })).filter(({ p }) => p.along > 12_000)
  assert.ok(far.length > 0)
  for (const { p, i } of far) near(parallel.points[i], fromRunwayFrame(p, e21L), 3, `parallel far ${i}`)
  assert.equal(parallel.warnings.length, 0)

  // A different heading (09L, about 120 degrees away): straight out along 09L, then the original path.
  const joined = applyGuide(guide, e21L, e09L)
  assert.equal(joined.mode, "joined")
  assert.ok(joined.warnings.length >= 1)
  near(joined.points[0], fromRunwayFrame({ along: 0, across: 0, altitude: 0 }, e09L), 3, "joined start")
  near(joined.points[1], offset(e09L, e09L.headingTrue, 5_000), 5, "stub 5 km out")
  const lastGuide = fromRunwayFrame(guide.points[guide.points.length - 1], e21L)
  near(joined.points[joined.points.length - 1], lastGuide, 5, "joined end is the original end")
  assert.ok(joined.points.length >= 3)

  // Source unknown: only rotated onto the target, with a warning when the headings differ.
  const unknown = applyGuide(guide, null, e09L)
  assert.equal(unknown.mode, "joined")
  assert.ok(unknown.warnings.length >= 2)
  assert.equal(applyGuide(guide, null, e21R).mode, "reanchored")
  void original
}

// 6. Ranking: the same end first, then a parallel runway, then others; the plan's direction breaks ties.
{
  const g = (id: string, end: string | null, heading: number | null, toc: number | null, useCount = 0) => ({ id, runwayEnd: end, runwayHeadingTrue: heading, tocBearing: toc, useCount })
  const guides = [g("c", "09L", 89, 90), g("b", "21R", 209, 270), g("a", "21L", 209, 270), g("d", "21R", 209, 90), g("e", null, null, null)]
  const ranked = rankGuides(guides, e21L, 270)
  assert.deepEqual(ranked.map((r) => r.guide.id), ["a", "b", "d", "c", "e"])
  assert.deepEqual(ranked.map((r) => r.fit), ["same end", "parallel", "parallel", "other", "other"])
  // b and d are both parallel; b points the way the plan goes (270), so it ranks first.
  assert.ok(ranked[1].score > ranked[2].score)
  // Same fit and direction: the more used guide first.
  const used = rankGuides([g("x", "21R", 209, 270, 0), g("y", "21R", 209, 270, 40)], e21L, 270)
  assert.equal(used[0].guide.id, "y")
  assert.deepEqual(rankGuides([], e21L, null), [])
}

// 6b. The client's shapes: payload, rows, error codes.
{
  assert.deepEqual(pointsToPayload([{ along: 10.4, across: -3.6, altitude: 1500.2 }]), [[10, -4, 1500]])
  const row = { id: "g1", airport: "LFPG", runway_name: "09R", runway_heading_deg: 85, toc_bearing_deg: 19, toc_distance_nm: 122, label: null, points: [[0, 0, 400], [3000, 0, 1500], [9000, -2000, 4000]], use_count: 2, origin_sources: ["Sketch"], created_at: "2026-10-19T00:00:00Z" }
  const guide = rowToGuide(row)!
  assert.equal(guide.runwayName, "09R")
  assert.deepEqual(guide.points[1], { along: 3000, across: 0, altitude: 1500 })
  assert.deepEqual(guide.originSources, ["Sketch"])
  assert.equal(guide.useCount, 2)
  // Rows that are not shaped like a guide are dropped, never half-read.
  assert.equal(rowToGuide(null), null)
  assert.equal(rowToGuide({ ...row, points: [[0, 0, 1], [1, 1, 2]] }), null)
  assert.equal(rowToGuide({ ...row, points: [[0, 0, 1], [1, "x", 2], [2, 2, 3]] }), null)
  assert.equal(rowToGuide({ ...row, id: 5 }), null)
  assert.equal(guideErrorKey("too_many_guides"), "tooMany")
  assert.equal(guideErrorKey("plan_not_found"), "notSaved")
  assert.equal(guideErrorKey("plan_not_draft"), "notDraft")
  assert.equal(guideErrorKey("guide_not_found"), "notFound")
  assert.equal(guideErrorKey("anything else"), "generic")
  assert.equal(guideErrorKey(null), "generic")
}

// 7. Bearings.
assert.ok(angleBetween(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 90) < 0.01)
assert.ok(angleBetween(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 0) < 0.01)
assert.equal(angleBetween(350, 10), 20)

console.log("runway-guide: all checks passed")
