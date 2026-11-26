// Run with `pnpm test:export-trim`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { generateFPL } from "@/lib/fpl-generator"
import { parseAeroHubKml } from "@/lib/partners/aerohub-parser"
import {
  arrivalCutOptions, buildExportWaypoints, fallbackAirport, loadWithoutArrival, resolveCut, topOfDescent, trimRoute,
} from "@/lib/export-trim"

// [nautical miles from the origin, feet], due east along the equator.
type Profile = [number, number][]
const line = (p: Profile) => p.map(([nm, altitude], i) => ({ name: String(i).padStart(3, "0"), lat: 0, lng: nm / 60.04, altitude }))
const options = (p: Profile) => arrivalCutOptions(line(p), { ...fallbackAirport(line(p)), elevationFt: 0 })
const tod = (p: Profile) => topOfDescent(line(p))

const NORMAL: Profile = [[0,0],[5,3000],[40,20000],[100,35000],[400,35000],[880,35000],[920,24000],[960,10000],[1000,0]]

// Top of descent
assert.equal(tod(NORMAL), 5)
// step climbs
assert.equal(tod([[0,0],[50,20000],[100,31000],[400,31000],[420,33000],[700,33000],[720,35000],[880,35000],[940,18000],[1000,0]]), 7)
// step down far from the destination
assert.equal(tod([[0,0],[100,39000],[1000,39000],[1020,35000],[2000,35000],[2850,35000],[2920,20000],[3000,0]]), 5)
// short level-offs in the descent do not move it
assert.equal(tod([[0,0],[100,37000],[500,37000],[850,37000],[880,24000],[900,24000],[930,12000],[950,12000],[1000,0]]), 3)
// a high level-off of 40 NM or more counts as cruise (accepted limit)
assert.equal(tod([[0,0],[100,37000],[850,37000],[880,24000],[925,24000],[960,10000],[1000,0]]), 4)
// the LFPG-KIAH shape: a 50 NM step down close to the destination
assert.equal(tod([[0,0],[100,34000],[700,34000],[732,34000],[750,32000],[800,32000],[873,28000],[950,9000],[1000,0]]), 5)
// short hop
assert.equal(tod([[0,0],[20,10000],[40,18000],[60,18000],[90,18000],[120,8000],[150,0]]), 4)
// zero altitude in cruise is ignored
assert.equal(tod([[0,0],[100,35000],[400,0],[880,35000],[920,20000],[1000,0]]), 3)
// a zero inside the last level does not break it
assert.equal(tod([[0,0],[100,39000],[500,39000],[600,35000],[620,0],[650,35000],[920,20000],[1000,0]]), 5)
// ground zeros don't make a flat profile look like a descent
assert.equal(tod([[0,0],[100,35000],[500,35000],[900,35000],[1000,0]]), null)
// unusable: all zero, flat, file ending in cruise
assert.equal(tod([[0,0],[100,0],[500,0],[1000,0]]), null)
assert.equal(tod([[0,35000],[500,35000],[1000,35000]]), null)
assert.equal(tod([[0,1000],[100,35000],[500,35000],[900,35000]]), null)

// Cut options
assert.deepEqual(options(NORMAL), { min: 3, max: 7, defaultIndex: 6, estimated: false, resumeAt: 8 })
const TAXI: Profile = [[0,0],[100,35000],[880,35000],[920,24000],[960,10000],[999,0],[999.5,0],[1000,0]]
assert.deepEqual(options(TAXI), { min: 1, max: 4, defaultIndex: 3, estimated: false, resumeAt: 5 })
// the ground switch already applied: nothing left but the destination
assert.equal(options(TAXI.slice(0, 6))!.resumeAt, 5)
// nothing between top of descent and the ground: the top of descent itself
assert.equal(options([[0,0],[100,35000],[880,35000],[999,40],[999.5,40],[1000,40]])!.defaultIndex, 2)
// fallback: last waypoint at least 120 NM out, flagged
assert.deepEqual(options([[0,0],[200,0],[700,0],[850,0],[900,0],[960,0],[1000,0]]), { min: 1, max: 5, defaultIndex: 3, estimated: true, resumeAt: 6 })
assert.equal(options([[0,1000],[100,35000],[500,35000],[900,35000]])!.defaultIndex, 2)
// route shorter than 120 NM, and nothing to cut
assert.deepEqual(options([[0,0],[30,0],[60,0],[100,0]]), { min: 1, max: 2, defaultIndex: 1, estimated: true, resumeAt: 3 })
assert.equal(options([[0,0],[100,0]]), null)

// A picked cut: used inside the range, ignored outside it
const range = { min: 1, max: 4, defaultIndex: 3, estimated: true, resumeAt: 5 }
assert.deepEqual(resolveCut(range, null), { index: 3, estimated: true })
assert.deepEqual(resolveCut(range, 2), { index: 2, estimated: false })
assert.deepEqual(resolveCut(range, 5), { index: 3, estimated: true })
assert.deepEqual(resolveCut(range, -1), { index: 3, estimated: true })

// Trim: keeps the ground block, reports the original distance
const trimmed = trimRoute(line(TAXI), { arrival: { after: 3, resumeAt: 5 } })
assert.deepEqual(trimmed.kept.map((w) => w.name), ["000", "001", "002", "003", "005", "006", "007"])
assert.deepEqual(trimmed.removed.map((w) => w.name), ["004"])
assert.equal(Math.round(trimmed.distanceToDestinationNm), 80)

// Branding follows what is exported
const long = line(Array.from({ length: 12 }, (_, i) => [i * 100, 30000] as [number, number]))
const names = (cut: { after: number; resumeAt: number }, includeBranding = true) =>
  buildExportWaypoints(long, { includeBranding, arrival: cut }).map((w) => w.name)
// one ground point (010): the names cover it and the three waypoints before the gap
assert.deepEqual(names({ after: 7, resumeAt: 10 }), ["000","001","002","003","004","MADE","WITH","INFINITE","PLANNER","011"])
assert.deepEqual(names({ after: 7, resumeAt: 11 }), ["000","001","002","003","MADE","WITH","INFINITE","PLANNER","011"])
assert.deepEqual(names({ after: 7, resumeAt: 11 }, false), ["000","001","002","003","004","005","006","007","011"])
// too short for branding once trimmed
assert.deepEqual(names({ after: 2, resumeAt: 11 }), ["000", "001", "002", "011"])
// a plan that already carries the names (as in the editor) gets its own names back where the block moved away
const branded = buildExportWaypoints(long, { includeBranding: true })
assert.deepEqual(
  buildExportWaypoints(branded, { includeBranding: true, arrival: { after: 7, resumeAt: 11 } }).map((w) => w.name),
  ["000", "001", "002", "003", "MADE", "WITH", "INFINITE", "PLANNER", "011"],
)
assert.deepEqual(
  buildExportWaypoints(branded, { includeBranding: false, arrival: { after: 9, resumeAt: 11 } }).map((w) => w.name),
  ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009", "011"],
)
// the input is untouched
assert.equal(long[7].name, "007")

// Toggle off: byte-identical to the export before this feature (hashes taken 2026-11-26)
const fixture = parseAeroHubKml(readFileSync("scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml", "utf8"), [])
assert.ok(fixture.ok)
const hash = (includeBranding: boolean) =>
  createHash("sha256").update(generateFPL(buildExportWaypoints(fixture.route.waypoints, { includeBranding }))).digest("hex")
assert.equal(hash(false), "47151d74fb179d55c41b589e6a54951a45584ac8e98832f484fa69a8bd7ebd8c")
assert.equal(hash(true), "bb2586f896db9faa94ba8d6dd4d127b889395809a0a8b78e756ffc3643be442f")

// Remembered toggle
assert.equal(loadWithoutArrival({ getItem: () => "1" }), true)
assert.equal(loadWithoutArrival({ getItem: () => null }), false)
assert.equal(loadWithoutArrival({ getItem: () => { throw new Error("blocked") } }), false)
assert.equal(loadWithoutArrival(undefined), false)

console.log("export-trim: all checks passed")
