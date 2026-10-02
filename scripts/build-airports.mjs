// Rebuilds lib/data/airports.json from OurAirports' airports.csv (public domain,
// https://ourairports.com/data/). Usage:
//   node scripts/build-airports.mjs path/to/airports.csv
// Keeps only entries with a valid 4-letter ICAO code - the `ident` when it is one
// (OurAirports uses the ICAO code as ident whenever it exists), else the separate
// `icao_code` column - and writes a compact { "EHAM": "Amsterdam Airport Schiphol", ... }
// map, sorted by code so diffs stay readable. Local/GPS-only identifiers are skipped.
import { readFileSync, writeFileSync } from "node:fs"

const input = process.argv[2]
if (!input) {
  console.error("Usage: node scripts/build-airports.mjs path/to/airports.csv")
  process.exit(1)
}

// Minimal RFC 4180 parser: the file has quoted fields with commas and doubled quotes.
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

const [header, ...rows] = parseCsv(readFileSync(input, "utf8"))
const identIdx = header.indexOf("ident")
const nameIdx = header.indexOf("name")
const icaoIdx = header.indexOf("icao_code")
if (identIdx < 0 || nameIdx < 0 || icaoIdx < 0) throw new Error("Unexpected CSV header: " + header.join(","))

const ICAO = /^[A-Z]{4}$/
const airports = {}
// Two passes so an `ident` match always wins over another airport's `icao_code` alias.
for (const column of [identIdx, icaoIdx]) {
  for (const row of rows) {
    const code = row[column]?.trim().toUpperCase()
    const name = row[nameIdx]?.trim()
    if (code && name && ICAO.test(code) && !(code in airports)) airports[code] = name
  }
}

const sorted = Object.fromEntries(Object.entries(airports).sort(([a], [b]) => (a < b ? -1 : 1)))
writeFileSync(new URL("../lib/data/airports.json", import.meta.url), JSON.stringify(sorted))
console.log(`${rows.length} raw rows -> ${Object.keys(sorted).length} ICAO airports`)
