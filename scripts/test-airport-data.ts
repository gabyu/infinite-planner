// Run with `pnpm test:airport-data`. Plain asserts: the project has no test runner. Checks the bundled airport data that
// scripts/build-airport-data.mjs wrote (lib/data/airports.json and lib/data/runways.json).
import assert from "node:assert/strict"
import airportsJson from "@/lib/data/airports.json"
import runwaysJson from "@/lib/data/runways.json"

type RunwayEntry = [number | null, number, number, number[][], [string, string][]]
const airports = airportsJson as unknown as Record<string, [string, string, string, string, number]>
const runways = runwaysJson as unknown as Record<string, RunwayEntry>

// Both files cover exactly the same airports, all with 4-letter ICAO codes.
assert.deepEqual(Object.keys(runways).sort(), Object.keys(airports).sort())
assert.ok(Object.keys(airports).every((code) => /^[A-Z]{4}$/.test(code)))
assert.ok(Object.keys(airports).length > 19_000)

// Every entry has the five fields; coordinate rows keep their six-number shape (ground trimming reads them).
for (const [code, entry] of Object.entries(runways)) {
  assert.equal(entry.length, 5, code)
  assert.ok(entry[3].every((row) => row.length === 6 && row.every(Number.isFinite)), code)
}

// Names: two digits (1-36), optional L / R / C, exact opposite ends, no duplicates, sorted by number.
let pairs = 0
for (const [code, entry] of Object.entries(runways)) {
  const seen = new Set<string>()
  for (const [le, he] of entry[4]) {
    pairs++
    assert.match(le, /^(0[1-9]|[12]\d|3[0-6])[LRC]?$/, `${code} ${le}`)
    assert.match(he, /^(0[1-9]|[12]\d|3[0-6])[LRC]?$/, `${code} ${he}`)
    assert.equal(Math.abs(Number.parseInt(le) - Number.parseInt(he)), 18, `${code} ${le}/${he}`)
    const letters = { "": "", L: "R", R: "L", C: "C" } as Record<string, string>
    assert.equal(letters[le.slice(2)], he.slice(2), `${code} ${le}/${he}`)
    assert.ok(!seen.has(`${le}${he}`), `${code} duplicate ${le}/${he}`)
    seen.add(`${le}${he}`)
  }
  const numbers = entry[4].map(([le]) => Number.parseInt(le))
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), `${code} sorted`)
}
assert.ok(pairs > 15_000, `named runways: ${pairs}`)

// The runways that real ATIS texts named (2026-10-18/19) are all in the data: the names the airport panel would offer.
const has = (code: string, ...names: string[]) => {
  const all = new Set(runways[code][4].flat())
  for (const name of names) assert.ok(all.has(name), `${code} should have ${name}, has ${[...all].join(" ")}`)
}
has("KDTW", "21L", "22R", "22L", "21R")
has("MMUN", "12R", "12L")
has("OMDB", "30L", "30R")
has("EHEH", "03")
has("LHBP", "13R")
// Single-digit names are padded to match the ATIS ("1L" in the source, "01L" here).
has("KSFO", "01L", "01R", "19L", "19R")
assert.ok(!runways.KSFO[4].flat().includes("1L"))
// Airports the editor knows well keep their coordinate rows.
assert.equal(runways.KDTW[3].length, 6)
assert.ok(runways.EHAM[3].length >= 6)

// An airport can hold two codes (ident and an alias): the runways are on both.
assert.deepEqual(runways.EGDX[4], runways.EGSY[4])

// The two airports that claim the code BISA: the airport list and the runway data agree on which one it is (the
// elevation of Sanda Airport, 1580 ft, not the other airport's 2200 ft).
assert.equal(airports.BISA[0], "Sandá Airport")
assert.equal(runways.BISA[0], 1580)

console.log(`airport-data: all checks passed (${Object.keys(airports).length} airports, ${pairs} named runways)`)
