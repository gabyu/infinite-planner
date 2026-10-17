// Rebuilds lib/data/runways.json from OurAirports' airports.csv and runways.csv (public domain,
// https://ourairports.com/data/). Usage:
//   node scripts/build-runways.mjs path/to/airports.csv path/to/runways.csv
// For every airport of lib/data/airports.json (the ICAO codes the site knows) it keeps the field elevation, the
// reference point and the open runways that have both end coordinates:
//   { "LFPG": [392, 49.0097, 2.5479, [[lat1, lng1, lat2, lng2, lengthFt, widthFt], ...]], ... }
// Ground trimming (lib/ground-trim.ts) reads it through /api/airports/{icao}/runways.
import { readFileSync, writeFileSync } from "node:fs"

const [airportsFile, runwaysFile] = process.argv.slice(2)
if (!airportsFile || !runwaysFile) {
  console.error("Usage: node scripts/build-runways.mjs path/to/airports.csv path/to/runways.csv")
  process.exit(1)
}

// Minimal RFC 4180 parser: quoted fields with commas and doubled quotes.
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

const known = new Set(Object.keys(JSON.parse(readFileSync(new URL("../lib/data/airports.json", import.meta.url), "utf8"))))
const round = (n) => Math.round(n * 1e5) / 1e5

const [aHeader, ...aRows] = parseCsv(readFileSync(airportsFile, "utf8"))
const col = (header, name) => header.indexOf(name)
const out = {}
const byRef = new Map()
for (const row of aRows) {
  const ident = row[col(aHeader, "ident")]
  const icao = /^[A-Z]{4}$/.test(ident) ? ident : row[col(aHeader, "icao_code")]
  if (!/^[A-Z]{4}$/.test(icao) || !known.has(icao)) continue
  const elevation = Number.parseFloat(row[col(aHeader, "elevation_ft")])
  out[icao] = [
    Number.isFinite(elevation) ? Math.round(elevation) : null,
    round(Number.parseFloat(row[col(aHeader, "latitude_deg")])),
    round(Number.parseFloat(row[col(aHeader, "longitude_deg")])),
    [],
  ]
  byRef.set(row[col(aHeader, "id")], icao)
}

const [rHeader, ...rRows] = parseCsv(readFileSync(runwaysFile, "utf8"))
let kept = 0
for (const row of rRows) {
  const icao = byRef.get(row[col(rHeader, "airport_ref")])
  if (!icao || row[col(rHeader, "closed")] === "1") continue
  const num = (name) => Number.parseFloat(row[col(rHeader, name)])
  const ends = [num("le_latitude_deg"), num("le_longitude_deg"), num("he_latitude_deg"), num("he_longitude_deg")]
  if (ends.some((value) => !Number.isFinite(value))) continue
  out[icao][3].push([...ends.map(round), Math.round(num("length_ft")) || 0, Math.round(num("width_ft")) || 0])
  kept++
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)))
writeFileSync(new URL("../lib/data/runways.json", import.meta.url), JSON.stringify(sorted))
console.log(`${Object.keys(sorted).length} airports, ${kept} runways with both ends`)
