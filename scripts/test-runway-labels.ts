// Run with `pnpm test:runway-labels`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import type { TrimAirport } from "@/lib/ground-trim"
import { runwayLabels } from "@/lib/runway-labels"

const airport: TrimAirport = {
  elevationFt: 0,
  lat: 49,
  lng: 2.5,
  runways: [
    [49, 2.5, 49, 2.54, 12000, 150, "08R", "26L"],
    [49.01, 2.5, 49.01, 2.54, 12000, 150], // no names: nothing to write on the map
  ],
}
const tones = { "08R": "good", "26L": "avoid" } as const
const brief = (labels: ReturnType<typeof runwayLabels>) => labels.map((l) => [l.name, l.tone, l.chosen])

// One label per named end, at its own threshold.
const plain = runwayLabels(airport, { inUse: null, tones: {}, chosen: null })
assert.deepEqual(brief(plain), [["08R", null, false], ["26L", null, false]])
assert.deepEqual([plain[0].lng, plain[1].lng], [2.5, 2.54])
assert.ok(Math.abs(plain[0].headingTrue - 90) < 1)

// Without an ATIS every end takes the colour of the wind.
assert.deepEqual(brief(runwayLabels(airport, { inUse: null, tones, chosen: "08R" })), [["08R", "good", true], ["26L", "avoid", false]])

// With an ATIS only the runways in use are coloured; in light wind (no verdict) they are green.
assert.deepEqual(brief(runwayLabels(airport, { inUse: ["26L"], tones, chosen: null })), [["08R", null, false], ["26L", "avoid", false]])
assert.deepEqual(brief(runwayLabels(airport, { inUse: ["08R"], tones: {}, chosen: null })), [["08R", "good", false], ["26L", null, false]])

// An ATIS whose runways could not be read says nothing: the wind decides.
assert.deepEqual(brief(runwayLabels(airport, { inUse: [], tones, chosen: null })), [["08R", "good", false], ["26L", "avoid", false]])

console.log("runway-labels: all tests passed")
