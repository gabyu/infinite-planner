// Run with `pnpm test:route-phases`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { phaseOf, phaseRange, splitPhases, type PhasePoint } from "@/lib/route-phases"

// A line due east along the equator, `nm` nautical miles between neighbours (about 60.04 NM per degree of longitude there).
const DEGREE_NM = 60.04
const line = (altitudes: number[], nm = 29): PhasePoint[] => altitudes.map((altitude, i) => ({ lat: 0, lng: (i * nm) / DEGREE_NM, altitude }))

// Tracked flight: climb, cruise at FL350, descent. Top of climb (index 4) and top of descent (index 9) are the edges.
{
  const alts = [100, 5000, 15000, 28000, 35000, 35000, 35000, 35000, 35000, 35000, 20000, 8000, 300]
  const split = splitPhases(line(alts))
  assert.deepEqual(split, { departureEnd: 4, arrivalStart: 9 })
  assert.equal(phaseOf(0, split), "departure")
  assert.equal(phaseOf(4, split), "departure")
  assert.equal(phaseOf(5, split), "cruise")
  assert.equal(phaseOf(8, split), "cruise")
  assert.equal(phaseOf(9, split), "arrival")
  assert.equal(phaseOf(12, split), "arrival")
  assert.deepEqual([phaseRange("departure", 13, split), phaseRange("cruise", 13, split), phaseRange("arrival", 13, split)], [[0, 5], [5, 9], [9, 13]])
}

// The slices partition the plan: every index in exactly one part.
{
  const alts = [100, 5000, 15000, 28000, 35000, 35000, 35000, 35000, 35000, 35000, 20000, 8000, 300]
  const split = splitPhases(line(alts))
  const seen = new Array(alts.length).fill(0)
  for (const phase of ["departure", "cruise", "arrival"] as const) {
    const [from, to] = phaseRange(phase, alts.length, split)
    for (let i = from; i < to; i++) seen[i]++
  }
  assert.deepEqual(seen, new Array(alts.length).fill(1))
}

// A single waypoint at cruise level: nothing between departure and arrival.
{
  const split = splitPhases(line([100, 12000, 35000, 12000, 100]))
  assert.deepEqual(split, { departureEnd: 2, arrivalStart: 3 })
  const [from, to] = phaseRange("cruise", 5, split)
  assert.equal(to - from, 0)
}

// No altitudes (a Route Sketch drawing): distance rule. 21 points 29 NM apart = 580 NM; ends are 25% = 145 NM capped at 60 NM (two legs).
{
  const split = splitPhases(line(new Array(21).fill(0)))
  assert.deepEqual(split, { departureEnd: 2, arrivalStart: 18 })
}

// Low altitudes only (a short hop below the cruise threshold) also use distance.
{
  const split = splitPhases(line([100, 2000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 2000, 100]))
  // 290 NM total: ends are min(60, 25% = 72) = 60 NM = two legs of 29 NM.
  assert.deepEqual(split, { departureEnd: 2, arrivalStart: 8 })
}

// A very short plan: the two ends meet without overlapping, and cruise is empty.
{
  const split = splitPhases(line(new Array(6).fill(0), 5))
  assert.ok(split.arrivalStart > split.departureEnd)
  assert.ok(split.departureEnd >= 0 && split.arrivalStart <= 5)
}

// Tiny plans never crash.
assert.deepEqual(splitPhases([]), { departureEnd: -1, arrivalStart: 0 })
assert.deepEqual(splitPhases(line([0])), { departureEnd: 0, arrivalStart: 1 })
assert.deepEqual(splitPhases(line([0, 0])), { departureEnd: 0, arrivalStart: 1 })
{
  const three = splitPhases(line([0, 0, 0]))
  assert.ok(three.departureEnd >= 0 && three.arrivalStart > three.departureEnd && three.arrivalStart <= 2)
}

// Overlap is impossible whatever the shape: sweep plan sizes with and without altitudes.
for (let n = 3; n <= 40; n++) {
  for (const withAltitude of [false, true]) {
    const alts = Array.from({ length: n }, (_, i) => (withAltitude ? Math.min(35000, (i + 1) * 4000, (n - i) * 4000) : 0))
    const split = splitPhases(line(alts, 20))
    assert.ok(split.departureEnd >= 0, `n=${n}`)
    assert.ok(split.arrivalStart > split.departureEnd, `n=${n}`)
    assert.ok(split.arrivalStart <= n - 1, `n=${n}`)
  }
}

console.log("route-phases: all checks passed")
