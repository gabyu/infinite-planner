import assert from "node:assert/strict"
import { aircraftCode, searchAircraft } from "../lib/aircraft"

const names = ["Airbus A350-900", "Airbus A350-1000", "Boeing 737-8 MAX", "Boeing 737-800", "Challenger 350", "Boeing 777-300ER", "Cessna 172"]

assert.equal(aircraftCode("Airbus A350-900"), "A359")
assert.equal(aircraftCode("Boeing 777-300ER"), "B77W")
assert.equal(aircraftCode("Piper Seneca"), "Seneca", "unknown names lose the manufacturer only")
assert.equal(aircraftCode("My own jet"), "My own jet")

assert.deepEqual(searchAircraft(names, "359"), ["Airbus A350-900"])
assert.deepEqual(searchAircraft(names, "a350"), ["Airbus A350-900", "Airbus A350-1000"])
assert.ok(searchAircraft(names, "350").includes("Challenger 350"))
assert.ok(searchAircraft(names, "350").includes("Airbus A350-1000"))
assert.deepEqual(searchAircraft(names, "737 max"), ["Boeing 737-8 MAX"])
assert.deepEqual(searchAircraft(names, "b77w"), ["Boeing 777-300ER"])
assert.deepEqual(searchAircraft(names, "900 airbus"), ["Airbus A350-900"])
assert.equal(searchAircraft(names, "").length, names.length)
assert.deepEqual(searchAircraft(names, "zzz"), [])
console.log("aircraft: ok")
