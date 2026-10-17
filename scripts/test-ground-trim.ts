// Run with `pnpm test:ground-trim`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { isOnRunway, planTrim, type RunwayRow, type TrimAirport, type TrimPoint } from "@/lib/ground-trim"

// A 3 km east-west runway at 49N (about 0.041 degrees of longitude long), field elevation 100 ft.
const runway: RunwayRow = [49, 2, 49, 2.041, 9800, 148]
const airport: TrimAirport = { elevationFt: 100, lat: 49.0005, lng: 2.02, runways: [runway] }
const noRunway: TrimAirport = { ...airport, runways: [] }

const at = (lat: number, lng: number, altitude: number): TrimPoint => ({ lat, lng, altitude })

// Gate and taxi (off the runway, on the ground), roll on the runway, then climbing east.
const taxi = [at(49.004, 2.01, 100), at(49.003, 2.012, 100), at(49.002, 2.014, 100), at(49.0012, 2.016, 100)]
const roll = [at(49, 2.001, 100), at(49, 2.01, 110), at(49, 2.02, 120), at(49, 2.03, 130), at(49, 2.04, 140)]
const climb = [at(49.0, 2.06, 600), at(49.0, 2.1, 2000), at(49.0, 2.2, 8000), at(49.0, 2.6, 30000)]

// Departure: everything before the line-up point goes.
{
  const plan = [...taxi, ...roll, ...climb]
  const result = planTrim(plan, airport, "departure")
  assert.deepEqual(result.remove, [0, 1, 2, 3])
  assert.equal(result.approximate, false)
}

// Arrival: the mirror, with the rollout and taxi after touchdown removed.
{
  const approach = [at(49.0, 1.6, 30000), at(49.0, 1.9, 3000), at(49.0, 1.97, 900)]
  const rollout = [at(49, 2.001, 100), at(49, 2.01, 100), at(49, 2.03, 100)]
  const taxiIn = [at(49.0012, 2.034, 100), at(49.003, 2.036, 100), at(49.004, 2.038, 100)]
  const plan = [...approach, ...rollout, ...taxiIn]
  const result = planTrim(plan, airport, "arrival")
  // The first on-runway waypoint of the final run (index 3) is the touchdown point: everything after it goes.
  assert.deepEqual(result.remove, [4, 5, 6, 7, 8])
}

// An already trimmed plan has nothing to remove.
{
  const plan = [...roll, ...climb]
  assert.deepEqual(planTrim(plan, airport, "departure").remove, [])
}

// Never below 2 waypoints.
{
  assert.deepEqual(planTrim([at(49, 2.01, 100), at(49, 2.02, 100)], airport, "departure").remove, [])
  const short = [taxi[0], roll[0], climb[3]]
  const result = planTrim(short, airport, "departure")
  assert.ok(short.length - result.remove.length >= 2)
}

// The line-up point and the waypoint after it stay: waypoint 2 is airborne or still rolling, never removed.
{
  const plan = [...taxi, ...roll, ...climb]
  const kept = plan.filter((_, i) => !planTrim(plan, airport, "departure").remove.includes(i))
  assert.equal(kept[0], roll[0])
}

// No runway data: the fallback removes the slow waypoints near the airport, keeping the last one before the climb,
// and says it is approximate.
{
  const plan = [...taxi, ...roll, ...climb]
  const result = planTrim(plan, noRunway, "departure")
  assert.equal(result.approximate, true)
  assert.ok(result.remove.length > 0)
  assert.ok(!result.remove.includes(plan.indexOf(climb[0])))
}

// Nothing near the airport and nothing slow: nothing found.
{
  const far = [at(40, -70, 30000), at(41, -71, 30000), at(42, -72, 30000)]
  assert.deepEqual(planTrim(far, airport, "departure").remove, [])
}

// Runway tolerance: noisy positions a few metres off the centre line still count, 80 m off does not.
assert.equal(isOnRunway(at(49.00004, 2.01, 100), [runway]), true)
assert.equal(isOnRunway(at(49.0008, 2.01, 100), [runway]), false)

console.log("ground-trim: all tests passed")
