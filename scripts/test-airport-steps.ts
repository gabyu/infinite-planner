// Run with `pnpm test:airport-steps`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { clearResult, confirmRunway, finishFlow, flowFor, reopenRunway, setFlowOpen } from "@/lib/airport-steps"
import { planRunwayMismatchText, runwayComponentsText } from "@/lib/copy"

// Nothing confirmed, not done, no opening chosen yet.
const start = flowFor(null, "LFPG")
assert.deepEqual(start, { icao: "LFPG", runway: null, done: null, open: null })

// Tapping a runway closes step 1 and opens the block.
const tapped = confirmRunway(start, "08R")
assert.equal(tapped.runway, "08R")
assert.equal(tapped.done, null)

// Apply, Save or Keep mine folds the block and remembers what to show on the one line.
const done = finishFlow(tapped, "08R", "164 NM · 132°")
assert.deepEqual(done, { icao: "LFPG", runway: "08R", done: { runway: "08R", leg: "164 NM · 132°" }, open: false })

// Keeping a procedure flown on another runway than the one tapped shows the plan's own, and leaves step 1 as it was.
assert.deepEqual(finishFlow(tapped, "26R", null), { icao: "LFPG", runway: "08R", done: { runway: "26R", leg: null }, open: false })

// The chevron reopens without losing it; "change" reopens step 1 and keeps the result until another runway is tapped.
assert.deepEqual(setFlowOpen(done, true).done, done.done)
assert.equal(reopenRunway(done).runway, null)
assert.deepEqual(confirmRunway(reopenRunway(done), "08R").done, done.done)
assert.equal(confirmRunway(reopenRunway(done), "09L").done, null)

// Undo or Restore: the plan no longer flies what the folded line said, so the block opens again without it.
assert.deepEqual(clearResult(done), { icao: "LFPG", runway: "08R", done: null, open: true })
assert.equal(clearResult(null), null)

// Another airport starts over; the same one keeps its state.
assert.deepEqual(flowFor(done, "EGLL"), { icao: "EGLL", runway: null, done: null, open: null })
assert.equal(flowFor(done, "LFPG"), done)

// Wind components are whole knots, however precise the maths.
assert.equal(
  runwayComponentsText("08R", 8.166687797910065, -5.771066661499144).replace(/ /g, " "),
  "08R: headwind 8 kt, crosswind 6 kt from the left.",
)
assert.equal(runwayComponentsText("26L", -0.2, 0.3).replace(/ /g, " "), "26L: headwind 0 kt, no crosswind.")

assert.equal(planRunwayMismatchText("arrival", "26L", ["08R"]), "Plan lands on 26L; the ATIS uses 08R.")
assert.equal(planRunwayMismatchText("departure", "26L", ["08R", "09L"]), "Plan departs 26L; the ATIS uses 08R, 09L.")

console.log("airport-steps: all tests passed")
