// Run with `pnpm test:runway-wind`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { adviseRunways, components, CROSSWIND_CAUTION_KT, endsOf, endTone, LIGHT_WIND_KT, PICK_MARGIN_KT, TAILWIND_AVOID_KT } from "@/lib/runway-wind"
import { effectiveChoice } from "@/lib/runway-choice"

const near = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 0.05, `${message ?? ""} ${actual} vs ${expected}`)

// Components: straight in, from the left, from the right, tail.
{
  const straight = components({ from: 280, speedKt: 10 }, 280)
  near(straight.headwindKt, 10)
  near(straight.crosswindKt, 0)
  const fromLeft = components({ from: 190, speedKt: 10 }, 280) // wind 90 degrees anticlockwise of the heading
  near(fromLeft.headwindKt, 0)
  near(fromLeft.crosswindKt, -10)
  const fromRight = components({ from: 10, speedKt: 10 }, 280) // 90 degrees clockwise (through north)
  near(fromRight.headwindKt, 0)
  near(fromRight.crosswindKt, 10)
  const tail = components({ from: 100, speedKt: 10 }, 280)
  near(tail.headwindKt, -10)
  // 30 degrees off the nose: 8.7 head, 5 cross.
  const off = components({ from: 310, speedKt: 10 }, 280)
  near(off.headwindKt, 8.66)
  near(off.crosswindKt, 5)
  // North wraps: wind 350, heading 010 = 20 degrees to the left.
  near(components({ from: 350, speedKt: 10 }, 10).crosswindKt, -3.42)
}

// A single runway, wind down it: the into-wind end is picked, the reciprocal is a tailwind.
{
  const ends = endsOf([["10", "28", 118]])
  assert.deepEqual(ends, [{ name: "10", headingTrue: 118 }, { name: "28", headingTrue: 298 }])
  const advice = adviseRunways(ends, { from: 290, speedKt: 12 })
  assert.equal(advice.pick, "28")
  assert.deepEqual(advice.best, ["28"])
  assert.equal(advice.ranked[0].name, "28")
  assert.ok(advice.ranked[1].headwindKt < 0)
  assert.equal(advice.light, false)
}

// Parallel runways tie: both ends of the into-wind group are best, nothing is picked.
{
  const kdtw = endsOf([["03L", "21R", 29], ["03R", "21L", 29], ["04L", "22R", 29], ["04R", "22L", 29], ["09L", "27R", 89], ["09R", "27L", 89]])
  const advice = adviseRunways(kdtw, { from: 200, speedKt: 5 })
  assert.deepEqual(advice.best.sort(), ["21L", "21R", "22L", "22R"])
  assert.equal(advice.pick, null)
}

// Several different runways, close: marked, not picked (EHAM, wind 100 at 9: runway 09 leads 06 by only 2 kt).
{
  const eham = endsOf([["04", "22", 41], ["06", "24", 58], ["09", "27", 87], ["18C", "36C", 183], ["18L", "36R", 183], ["18R", "36L", 183]])
  const advice = adviseRunways(eham, { from: 100, speedKt: 9 })
  assert.equal(advice.ranked[0].name, "09")
  assert.equal(advice.pick, null)
  assert.ok(advice.ranked[0].headwindKt - advice.ranked[1].headwindKt < PICK_MARGIN_KT)
}

// A clear winner among several runways is picked (wind straight down 09, the others are far off).
{
  const eham = endsOf([["04", "22", 41], ["09", "27", 87], ["18C", "36C", 183]])
  const advice = adviseRunways(eham, { from: 90, speedKt: 15 })
  assert.equal(advice.pick, "09")
}

// Light wind (under 3 kt) and variable wind: nothing marked, nothing picked, flagged "any runway".
{
  const ends = endsOf([["10", "28", 118]])
  const light = adviseRunways(ends, { from: 290, speedKt: LIGHT_WIND_KT - 1 })
  assert.deepEqual([light.best, light.pick, light.light], [[], null, true])
  assert.ok(light.ranked.length > 0) // numbers still available
  const variable = adviseRunways(ends, { from: null, speedKt: 8 })
  assert.deepEqual([variable.ranked, variable.best, variable.pick, variable.light], [[], [], null, true])
  const calm = adviseRunways(ends, { from: 0, speedKt: 0 })
  assert.equal(calm.pick, null)
}

// Crosswind-only wind: both ends equal, nothing picked.
{
  const advice = adviseRunways(endsOf([["10", "28", 118]]), { from: 28, speedKt: 10 })
  assert.equal(advice.pick, null)
  assert.equal(advice.best.length, 2)
}

// Ends without a heading are not ranked, never picked, and never break the rest.
{
  const ends = endsOf([["10", "28", null]])
  const advice = adviseRunways(ends, { from: 290, speedKt: 12 })
  assert.deepEqual([advice.ranked, advice.best, advice.pick], [[], [], null])
  const mixed = adviseRunways(endsOf([["10", "28", null], ["04", "22", 41]]), { from: 220, speedKt: 12 })
  assert.deepEqual(mixed.ranked.map((end) => end.name), ["22", "04"])
}

// The choice order: the pilot's tap, then the ATIS's single runway, then the wind; the wind never overrides an ATIS list.
{
  assert.deepEqual(effectiveChoice(null, "EHAM", [], "09"), { runway: "09", by: "wind", inAtis: true })
  assert.deepEqual(effectiveChoice({ icao: "EHAM", runway: "27" }, "EHAM", [], "09"), { runway: "27", by: "hand", inAtis: false })
  assert.deepEqual(effectiveChoice(null, "EHAM", ["18R"], "09"), { runway: "18R", by: "atis", inAtis: true })
  assert.equal(effectiveChoice(null, "EHAM", ["18R", "18L"], "09"), null)
  assert.equal(effectiveChoice(null, "EHAM", [], null), null)
  // A hand choice for another airport does not count; the wind of this airport does.
  assert.deepEqual(effectiveChoice({ icao: "KSFO", runway: "28L" }, "EHAM", [], "09"), { runway: "09", by: "wind", inAtis: true })
}

// Tones, KSFO with wind 270 at 12 (whole knots as the server sends them): 28L/28R green, 19 and the sideways ends yellow, the tailwind ends red.
{
  const ksfo = endsOf([["01L", "19R", 28], ["10L", "28R", 118]])
  const advice = adviseRunways(ksfo, { from: 270, speedKt: 12 })
  const tone = (name: string) => {
    const rank = advice.ranked.find((end) => end.name === name)!
    return endTone({ headwindKt: Math.round(rank.headwindKt), crosswindKt: Math.round(rank.crosswindKt) }, advice.best.includes(name), advice.light)
  }
  assert.equal(tone("28R"), "good") // headwind 11
  assert.equal(tone("19R"), "caution") // headwind 5, crosswind 11: not the best
  assert.equal(tone("01L"), "avoid") // tailwind 5
  assert.equal(tone("10L"), "avoid") // tailwind 11
  // Strong crosswind is never green, even when it is the best headwind; a tailwind stays red.
  assert.equal(endTone({ headwindKt: 8, crosswindKt: CROSSWIND_CAUTION_KT }, true, false), "caution")
  assert.equal(endTone({ headwindKt: 8, crosswindKt: CROSSWIND_CAUTION_KT - 1 }, true, false), "good")
  assert.equal(endTone({ headwindKt: -TAILWIND_AVOID_KT, crosswindKt: 20 }, false, false), "avoid")
  assert.equal(endTone({ headwindKt: -(TAILWIND_AVOID_KT - 1), crosswindKt: 3 }, false, false), "caution")
  // Light wind judges nothing.
  assert.equal(endTone({ headwindKt: 2, crosswindKt: 0 }, true, true), null)
}

console.log("runway-wind: all checks passed")
