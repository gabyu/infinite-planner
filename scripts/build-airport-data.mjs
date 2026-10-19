// Rebuilds lib/data/airports.json and lib/data/runways.json from OurAirports' airports.csv and runways.csv (public
// domain, https://ourairports.com/data/). One script, one pair of files, so both outputs always cover the same airports.
//   node scripts/build-airport-data.mjs path/to/airports.csv path/to/runways.csv
// (the files are published at https://davidmegginson.github.io/ourairports-data/ and refreshed nightly)
//
// airports.json: every airport with a valid 4-letter ICAO code - the `ident` when it is one (OurAirports uses the ICAO
//   code as ident whenever it exists), else the separate `icao_code` column; local/GPS-only identifiers are skipped:
//   { "EHAM": ["Amsterdam Airport Schiphol", "Amsterdam", "AMS", "NL", 0], ... }  = [name, city, iata, country, rank],
//   sorted by code. `rank` orders search results: 0 large airport, 1 medium, 2 small, 3 anything else, 4 closed (kept
//   for name lookup, left out of search). Read by lib/airports.ts (the Convert airport search, page text).
// runways.json: for the same airports, the field elevation, the reference point, the open runways that have both end
//   coordinates, and the runway names:
//   { "LFPG": [392, 49.0097, 2.5479, [[lat1, lng1, lat2, lng2, lengthFt, widthFt], ...], [["08L","26R",87], ...]], ... }
//   The coordinate rows are what ground trimming (lib/ground-trim.ts) reads. The names list every open runway whose two
//   ends both have a standard name (number 1-36, optional L / R / C), including the many small airports that have no
//   coordinates; numbers are padded to two digits ("1L" -> "01L") to match the wording of the ATIS. A pair must be exact
//   opposites (13R / 31L: numbers 18 apart, L with R, C with C, none with none); the few pairs that are not are typos in
//   the source and are left out, since a chip for a runway that does not exist is worse than none. The third value of a
//   name is the TRUE heading in degrees of the first end (the second end is that + 180), from OurAirports'
//   le_heading_degT / he_heading_degT, else the bearing between the two thresholds, else null; a heading more than 45
//   degrees from the runway number x 10 is a source error and becomes null. True, because the weather reports (METAR)
//   give the wind in degrees true. Both are served
//   through /api/airports/{icao}/runways.
import { readFileSync, writeFileSync } from "node:fs"

const [airportsFile, runwaysFile] = process.argv.slice(2)
if (!airportsFile || !runwaysFile) {
  console.error("Usage: node scripts/build-airport-data.mjs path/to/airports.csv path/to/runways.csv")
  process.exit(1)
}

// Minimal RFC 4180 parser: the files have quoted fields with commas and doubled quotes.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else field += c
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const [aHeader, ...aRows] = parseCsv(readFileSync(airportsFile, "utf8"))
const [rHeader, ...rRows] = parseCsv(readFileSync(runwaysFile, "utf8"))
const a = (name) => aHeader.indexOf(name)
const r = (name) => rHeader.indexOf(name)
if (a("ident") < 0 || a("name") < 0 || a("icao_code") < 0) throw new Error("Unexpected airports.csv header: " + aHeader.join(","))
if (r("airport_ref") < 0 || r("le_ident") < 0 || r("he_ident") < 0) throw new Error("Unexpected runways.csv header: " + rHeader.join(","))

const RANK = { large_airport: 0, medium_airport: 1, small_airport: 2, closed: 4 }
const ICAO = /^[A-Z]{4}$/
const round = (n) => Math.round(n * 1e5) / 1e5

// Two passes so an `ident` match always wins over another airport's `icao_code` alias. `rows` remembers which CSV row
// each code came from, so the runways below attach to the airport that kept the code.
const airports = {}
const source = {}
for (const column of [a("ident"), a("icao_code")]) {
  for (const row of aRows) {
    const code = row[column]?.trim().toUpperCase()
    const name = row[a("name")]?.trim()
    if (code && name && ICAO.test(code) && !(code in airports)) {
      airports[code] = [
        name,
        row[a("municipality")]?.trim() ?? "",
        row[a("iata_code")]?.trim().toUpperCase() ?? "",
        row[a("iso_country")]?.trim() ?? "",
        // Airports with scheduled flights rank one step higher than their size alone.
        (RANK[row[a("type")]] ?? 3) - (row[a("type")] !== "closed" && row[a("scheduled_service")] === "yes" ? 1 : 0),
      ]
      source[code] = row
    }
  }
}

// One airport can hold two codes (its ident and an alias in icao_code): its runways go to each of them.
const runways = {}
const refToCodes = new Map()
for (const [code, row] of Object.entries(source)) {
  const elevation = Number.parseFloat(row[a("elevation_ft")])
  runways[code] = [
    Number.isFinite(elevation) ? Math.round(elevation) : null,
    round(Number.parseFloat(row[a("latitude_deg")])),
    round(Number.parseFloat(row[a("longitude_deg")])),
    [],
    [],
  ]
  refToCodes.set(row[a("id")], [...(refToCodes.get(row[a("id")]) ?? []), code])
}

// "1L" -> "01L", "13" -> "13"; anything else (helipad H1, N/S, 13W water runways, 10A/28D) is not a runway name.
function runwayName(text) {
  const match = /^(\d{1,2})([LRC])?$/i.exec(text.trim())
  if (!match) return null
  const number = Number(match[1])
  if (number < 1 || number > 36) return null
  return `${String(number).padStart(2, "0")}${(match[2] ?? "").toUpperCase()}`
}

// Opposite ends of one runway: 13R / 31L, 04 / 22, 36 / 18, 09C / 27C.
const OPPOSITE = { "": "", L: "R", R: "L", C: "C" }
const opposite = (le, he) => Math.abs(Number.parseInt(le) - Number.parseInt(he)) === 18 && OPPOSITE[le.slice(2)] === he.slice(2)

// True heading of the first end: the source's own value, else the bearing from the thresholds; null when neither exists or
// the value disagrees with the runway number by more than 45 degrees (runway numbers are magnetic, within a few tens of
// degrees of true everywhere these airports are).
const norm = (degrees) => ((Math.round(degrees) % 360) + 360) % 360
const angleBetween = (x, y) => Math.abs(((x - y + 540) % 360) - 180)
function bearing(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180
  const y = Math.sin((lng2 - lng1) * rad) * Math.cos(lat2 * rad)
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lng2 - lng1) * rad)
  return norm(Math.atan2(y, x) / rad)
}
function trueHeading(row, le, hasEnds, ends) {
  const fromLe = Number.parseFloat(row[r("le_heading_degT")])
  const fromHe = Number.parseFloat(row[r("he_heading_degT")])
  let heading = null
  if (Number.isFinite(fromLe)) heading = norm(fromLe)
  else if (Number.isFinite(fromHe)) heading = norm(fromHe + 180)
  else if (hasEnds) heading = bearing(ends[0], ends[1], ends[2], ends[3])
  if (heading === null) return null
  return angleBetween(heading, Number.parseInt(le) * 10) <= 45 ? heading : null
}

let rows = 0
let named = 0
let notOpposite = 0
let headed = 0
for (const row of rRows) {
  const codes = refToCodes.get(row[r("airport_ref")])
  if (!codes || row[r("closed")] === "1") continue
  const num = (name) => Number.parseFloat(row[r(name)])
  const ends = [num("le_latitude_deg"), num("le_longitude_deg"), num("he_latitude_deg"), num("he_longitude_deg")]
  const hasEnds = ends.every((value) => Number.isFinite(value))
  let le = runwayName(row[r("le_ident")])
  let he = runwayName(row[r("he_ident")])
  if (le && he && !opposite(le, he)) {
    notOpposite++
    le = he = null
  }
  for (const code of codes) {
    if (hasEnds) {
      runways[code][3].push([...ends.map(round), Math.round(num("length_ft")) || 0, Math.round(num("width_ft")) || 0])
      rows++
    }
    if (le && he && !runways[code][4].some(([x, y]) => x === le && y === he)) {
      const heading = trueHeading(row, le, hasEnds, ends)
      runways[code][4].push([le, he, heading])
      named++
      if (heading !== null) headed++
    }
  }
}
for (const entry of Object.values(runways)) entry[4].sort((p, q) => Number.parseInt(p[0]) - Number.parseInt(q[0]) || (p[0] < q[0] ? -1 : 1))

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([x], [y]) => (x < y ? -1 : 1)))
writeFileSync(new URL("../lib/data/airports.json", import.meta.url), JSON.stringify(sorted(airports)))
writeFileSync(new URL("../lib/data/runways.json", import.meta.url), JSON.stringify(sorted(runways)))
console.log(
  `${aRows.length} airport rows -> ${Object.keys(airports).length} ICAO airports; ${rows} runways with both ends, ${named} named runways ` +
    `(${Object.values(runways).filter((entry) => entry[4].length > 0).length} airports with names; ${notOpposite} pairs left out as not opposite ends; ${headed} with a true heading)`,
)
