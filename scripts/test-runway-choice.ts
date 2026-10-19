// Run with `pnpm test:runway-choice`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { chipRunways, effectiveChoice, tapRunway, type HandChoice } from "@/lib/runway-choice"

// The ATIS names one runway: that is the choice, until the pilot taps.
assert.deepEqual(effectiveChoice(null, "EHAM", ["18R"]), { runway: "18R", by: "atis", inAtis: true })

// Several runways, or none: nothing is chosen for the pilot.
assert.equal(effectiveChoice(null, "KDTW", ["22L", "21R"]), null)
assert.equal(effectiveChoice(null, "KDTW", []), null)

// The pilot's tap beats the ATIS, even when the ATIS names a different single runway.
{
  const hand: HandChoice = { icao: "EHAM", runway: "06" }
  assert.deepEqual(effectiveChoice(hand, "EHAM", ["18R"]), { runway: "06", by: "hand", inAtis: false })
  assert.deepEqual(effectiveChoice(hand, "EHAM", ["06"]), { runway: "06", by: "hand", inAtis: true })
  // The ATIS changing, or disappearing, never moves it.
  assert.deepEqual(effectiveChoice(hand, "EHAM", ["27"]), { runway: "06", by: "hand", inAtis: false })
  assert.deepEqual(effectiveChoice(hand, "EHAM", []), { runway: "06", by: "hand", inAtis: false })
}

// A choice for another airport does not count (the pilot changed the airport on that end).
assert.deepEqual(effectiveChoice({ icao: "EHAM", runway: "06" }, "KSFO", ["28L"]), { runway: "28L", by: "atis", inAtis: true })
assert.equal(effectiveChoice({ icao: "EHAM", runway: "06" }, "KSFO", ["28L", "28R"]), null)

// Taps: choose, change, tap the same again to clear.
{
  const first = tapRunway(null, "KDTW", "22L")
  assert.deepEqual(first, { icao: "KDTW", runway: "22L" })
  assert.deepEqual(tapRunway(first, "KDTW", "21R"), { icao: "KDTW", runway: "21R" })
  assert.equal(tapRunway(first, "KDTW", "22L"), null)
  // Back to the ATIS's single runway after clearing.
  assert.deepEqual(effectiveChoice(tapRunway(first, "KDTW", "22L"), "KDTW", ["22L"]), { runway: "22L", by: "atis", inAtis: true })
  // A stale choice from another airport is replaced, not cleared.
  assert.deepEqual(tapRunway({ icao: "EHAM", runway: "06" }, "KDTW", "06"), { icao: "KDTW", runway: "06" })
}

// Chips: the ATIS's runways, plus the pilot's own when the ATIS no longer lists it.
assert.deepEqual(chipRunways(effectiveChoice({ icao: "X", runway: "06" }, "X", ["18R", "18L"]), ["18R", "18L"]), ["18R", "18L", "06"])
assert.deepEqual(chipRunways(effectiveChoice({ icao: "X", runway: "18L" }, "X", ["18R", "18L"]), ["18R", "18L"]), ["18R", "18L"])
assert.deepEqual(chipRunways(null, ["18R", "18L"]), ["18R", "18L"])

console.log("runway-choice: all checks passed")
