// Run with `pnpm test:procedures`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import {
  airportFor,
  groupFlights,
  parseFlightName,
  readPoints,
  suggestName,
  type FlightAnalysis,
} from "@/lib/procedure-analysis"
import { buildCoverage, doneKey, octantOf, runwayFamily, cellKey } from "@/lib/procedure-coverage"
import { ingestKml } from "@/lib/procedure-ingest"
import type { LatLng } from "@/lib/runway-guide"
import { runwayEnds } from "@/lib/runway-guide"

// A point `meters` from `from` along `bearing` (great circle, independent of the module under test).
const EARTH = 6_371_008.8
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
function offset(from: LatLng, bearing: number, meters: number): LatLng {
  const d = meters / EARTH, b = rad(bearing), lat1 = rad(from.lat), lng1 = rad(from.lng)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: deg(lat2), lng: deg(lng2) }
}
const NM = 1852

// ---- file names -------------------------------------------------------------------------------------------------------
assert.deepEqual(parseFlightName("LFPG (08L) - LSGG (04).kml"), { origin: "LFPG", originRunway: "08L", destination: "LSGG", destinationRunway: "04" })
assert.deepEqual(parseFlightName("LFPG-LSGG_2.kml"), { origin: "LFPG", originRunway: null, destination: "LSGG", destinationRunway: null })
assert.deepEqual(parseFlightName("daag (xx) - lsgg (22)_2.kml"), { origin: "DAAG", originRunway: "XX", destination: "LSGG", destinationRunway: "22" })
assert.equal(parseFlightName("AF1042-1.kml"), null)
assert.equal(parseFlightName("notes.kml"), null)

// ---- the two KML layouts ----------------------------------------------------------------------------------------------
const placemarks = Array.from({ length: 12 }, (_, i) => `<Placemark><description><b>Altitude:</b></span> <span>${i * 1000} ft</span></description><Point><coordinates>${6 + i * 0.01},46.2,0</coordinates></Point></Placemark>`).join("")
const fromPlacemarks = readPoints(`<kml><Document>${placemarks}</Document></kml>`)
assert.equal(fromPlacemarks.length, 12)
assert.equal(fromPlacemarks[3].altitude, 3000)
const gx = readPoints(`<kml xmlns:gx="x"><gx:Track>${Array.from({ length: 11 }, (_, i) => `<gx:coord>${6 + i * 0.01} 46.2 ${i * 300}</gx:coord>`).join("")}</gx:Track></kml>`)
assert.equal(gx.length, 11)
assert.equal(gx[10].altitude, Math.round(3000 * 3.28084))

// ---- grouping by real bearing -------------------------------------------------------------------------------------------
const flight = (file: string, kind: "arrival" | "departure", runway: string | null, bearing: number | null): FlightAnalysis => ({
  file, kind, runway, bearing, turnNm: 50, altAt: {}, establishedNm: null, flags: [], track: [],
})
const groups = groupFlights([flight("a", "arrival", "04", 350), flight("b", "arrival", "04", 10), flight("c", "arrival", "04", 180)], "arrival")
assert.equal(groups.length, 2, "350 and 10 degrees are one group across north")
assert.deepEqual(groups.map((g) => g.members.length).sort(), [1, 2])

// ---- coverage ------------------------------------------------------------------------------------------------------------
assert.equal(octantOf(0), "N")
assert.equal(octantOf(359), "N")
assert.equal(octantOf(46), "NE")
assert.equal(runwayFamily("08L"), "08")
const LSGG = airportFor("LSGG")!
assert.ok(LSGG)
const empty = buildCoverage(LSGG, [], new Set())
assert.equal(empty.needed, 32, "2 runway families x 2 kinds x 8 directions")
assert.equal(empty.percent, 0)
const one = buildCoverage(LSGG, [flight("a", "arrival", "04", 310)], new Set())
assert.equal(one.covered, 1)
assert.equal(one.percent, Math.round((1 / 32) * 100))
// Parallel runways share a family: 22 and 22 are the same row.
const notNeeded = buildCoverage(LSGG, [flight("a", "arrival", "04", 310)], new Set([cellKey("arrival", "04", "N")]))
assert.equal(notNeeded.needed, 31, "a direction marked not needed leaves the count")
const done = buildCoverage(LSGG, [flight("a", "arrival", "04", 310)], new Set([doneKey("arrival")]))
assert.equal(done.arrival.done, true)
assert.equal(done.arrival.percent, 100)
assert.equal(done.departure.percent, 0)
assert.equal(done.needed, 1 + 16, "arrivals: only the covered cell; departures: all 16 still needed")
const bothDone = buildCoverage(LSGG, [], new Set([doneKey("arrival"), doneKey("departure")]))
assert.equal(bothDone.percent, 100, "both kinds done reads as finished even when empty")
const unplaced = buildCoverage(LSGG, [flight("x", "arrival", null, 100)], new Set())
assert.equal(unplaced.unplaced.length, 1)
assert.equal(unplaced.covered, 0)

// ---- ingest: refusals --------------------------------------------------------------------------------------------------
assert.equal(ingestKml("hello", "x.kml").ok, false)
assert.equal(ingestKml("<kml><x/></kml>", "x.kml").ok, false)
const tiny = `<kml xmlns:gx="x"><gx:Track>${Array.from({ length: 12 }, (_, i) => `<gx:coord>${-40 + i * 0.01} 0.5 1000</gx:coord>`).join("")}</gx:Track></kml>`
const refused = ingestKml(tiny, "unknown.kml")
assert.equal(refused.ok, false, "no airport anywhere: refused")

// ---- ingest: an arrival at LSGG 04 that begins in the air near Algiers --------------------------------------------------
const end04 = runwayEnds(LSGG).find((e) => e.name === "04")!
const entry = offset(end04, 158, 40 * NM) // 40 NM out, south-south-east of the runway
const faf = offset(end04, 226, 15 * NM) // on the extended centreline
const start = offset(end04, 158, 300 * NM)
const legs: [LatLng, number, LatLng, number, number][] = [
  [start, 30000, entry, 17000, 40],
  [entry, 17000, faf, 6000, 25],
  [faf, 6000, end04, 1450, 40],
]
const DAAG = airportFor("DAAG")!
const nearAlgiers = offset(DAAG, 20, 7 * NM) // the tracker picks the flight up in the air, 7 NM from Algiers
const coords: string[] = []
for (let i = 0; i < 12; i++) coords.push(`<gx:coord>${(nearAlgiers.lng + i * 0.004).toFixed(5)} ${(nearAlgiers.lat + i * 0.004).toFixed(5)} ${Math.round((3300 + i * 200) * 0.3048)}</gx:coord>`)
for (const [from, fromAlt, to, toAlt, steps] of legs) {
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    coords.push(`<gx:coord>${(from.lng + (to.lng - from.lng) * t).toFixed(5)} ${(from.lat + (to.lat - from.lat) * t).toFixed(5)} ${Math.round((fromAlt + (toAlt - fromAlt) * t) * 0.3048)}</gx:coord>`)
  }
}
const rollout = offset(end04, 46, 900)
coords.push(`<gx:coord>${end04.lng.toFixed(5)} ${end04.lat.toFixed(5)} ${Math.round(1450 * 0.3048)}</gx:coord>`)
coords.push(`<gx:coord>${rollout.lng.toFixed(5)} ${rollout.lat.toFixed(5)} ${Math.round(1440 * 0.3048)}</gx:coord>`)
const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document><name>AF1042/AFR44SZ</name><description>Air France F-GKXM https://tracker.example/flight/af1042</description><Placemark><gx:Track>${coords.map((_, i) => `<when>2026-10-22T16:${String(i % 60).padStart(2, "0")}:00Z</when>`).join("")}${coords.join("")}</gx:Track></Placemark></Document></kml>`
const result = ingestKml(kml, "DAAG-LSGG.kml")
assert.equal(result.ok, true)
if (result.ok) {
  assert.equal(result.route, "DAAG-LSGG", "the file name's codes win")
  const geneva = result.rows.find((r) => r.airport === "LSGG")!
  assert.equal(geneva.kind, "arrival")
  assert.equal(geneva.runway, "04")
  assert.ok(geneva.bearing !== null && Math.abs(geneva.bearing - 158) <= 3, `entry bearing ${geneva.bearing}`)
  assert.ok(geneva.track.length >= 2 && geneva.track.length <= 140, `track of ${geneva.track.length} points`)
  assert.match(geneva.content_hash, /^[0-9a-f]{64}$/)
  const algiers = result.rows.find((r) => r.airport === "DAAG")!
  assert.equal(algiers.kind, "unknown", "a track that begins in the air is no departure")
  // Nothing that identifies the flight reaches a row.
  const stored = JSON.stringify(result.rows)
  for (const secret of ["AF1042", "AFR44SZ", "F-GKXM", "tracker.example", "2026-10-22", "16:0"]) assert.ok(!stored.includes(secret), `"${secret}" must not be stored`)
  assert.ok(stored.length < 40_000, "rows stay small")
  // The same file twice hashes the same: the database skips the second.
  const again = ingestKml(kml, "DAAG-LSGG.kml")
  assert.ok(again.ok && again.rows[0].content_hash === geneva.content_hash)
}
// A runway named in the file name is used as given, XX is flagged.
const named = ingestKml(kml, "DAAG (XX) - LSGG (04).kml")
assert.ok(named.ok && named.rows.find((r) => r.airport === "DAAG")!.needs_check, "XX marks the row to check")
assert.equal(suggestName(kml, parseFlightName("DAAG (XX) - LSGG (04).kml"))?.base, "DAAG (XX) - LSGG (04)")

// ---- the production export endpoint: who may read it ------------------------------------------------------------------------
async function exportStatus(env: Record<string, string | undefined>, authorization?: string) {
  const saved = { ...process.env }
  Object.assign(process.env, env)
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key]
  try {
    const { GET } = await import("@/app/api/procedures-sync/export/route")
    const headers: Record<string, string> = { "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250)}` }
    if (authorization) headers.authorization = authorization
    return (await GET(new Request("https://example.test/api/procedures-sync/export", { headers }))).status
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
}
const TOKEN = "a-long-random-sync-token-for-tests-0123456789"
async function checkExport() {
  assert.equal(await exportStatus({ NEXT_PUBLIC_ENV: "production", PROCEDURES_SYNC_TOKEN: undefined }), 404, "no token configured: not there")
  assert.equal(await exportStatus({ NEXT_PUBLIC_ENV: "production", PROCEDURES_SYNC_TOKEN: "short" }), 404, "a weak token is refused outright")
  assert.equal(await exportStatus({ NEXT_PUBLIC_ENV: "staging", PROCEDURES_SYNC_TOKEN: TOKEN }, `Bearer ${TOKEN}`), 404, "staging never serves the export")
  assert.equal(await exportStatus({ NEXT_PUBLIC_ENV: "production", PROCEDURES_SYNC_TOKEN: TOKEN }), 401, "no token given")
  assert.equal(await exportStatus({ NEXT_PUBLIC_ENV: "production", PROCEDURES_SYNC_TOKEN: TOKEN }, "Bearer wrong-token"), 401, "wrong token")
  assert.equal(await exportStatus({ NEXT_PUBLIC_ENV: "production", PROCEDURES_SYNC_TOKEN: TOKEN }, `Bearer ${TOKEN}x`), 401, "almost the token")
  // The right token gets past the check: with no database configured it stops at 503, which is not an auth answer.
  assert.equal(
    await exportStatus({ NEXT_PUBLIC_ENV: "production", PROCEDURES_SYNC_TOKEN: TOKEN, NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, `Bearer ${TOKEN}`),
    503,
  )
}

checkExport().then(
  () => console.log("test-procedures: all checks passed"),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
