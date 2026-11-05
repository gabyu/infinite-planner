// Run with `pnpm test:aerohub-parser`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { parseAeroHubKml } from "@/lib/partners/aerohub-parser"

const HOSTS = ["aerohubradar.com"]
const fixture = readFileSync("scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml", "utf8")

// The fixture: 5 fields, 117 points in the file, YPPH -> EGLL.
{
  const result = parseAeroHubKml(fixture, HOSTS)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error("unreachable")
  assert.deepEqual(result.meta, {
    departure: "YPPH",
    arrival: "EGLL",
    aerohubId: "QR520",
    callsign: "Qatari 300VA",
    flightUrl: "https://aerohubradar.com/QR520/qatari300va",
  })
  assert.equal(result.rawPointCount, 117)
  // TOC and TOD are markers, not places to fly to: left out. Everything else (runway points, oceanic fixes) stays.
  assert.equal(result.droppedMarkers, 2)
  assert.equal(result.route.waypoints.length, 115)
  assert.equal(result.route.source, "AeroHub")
  assert.equal(result.route.waypoints[0].name, "001")
  // First point is YPPH, last is EGLL.
  assert.ok(Math.abs(result.route.waypoints[0].lng - 115.966547) < 1e-9)
  assert.ok(Math.abs(result.route.waypoints.at(-1)!.lat - 51.471226) < 1e-9)
}

// departure / arrival: mandatory, known, 4 letters. No partial import.
{
  const without = (name: string) => fixture.replace(new RegExp(`<Data name="${name}"><value>[^<]*</value></Data>`), "")
  for (const name of ["departure", "arrival"]) {
    const r = parseAeroHubKml(without(name), HOSTS)
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "invalid_airports"], name)
  }
  const unknown = parseAeroHubKml(fixture.replace("<value>EGLL</value>", "<value>ZZZZ</value>"), HOSTS)
  assert.deepEqual([unknown.ok, !unknown.ok && unknown.code], [false, "invalid_airports"])
  const iata = parseAeroHubKml(fixture.replace("<value>EGLL</value>", "<value>LHR</value>"), HOSTS)
  assert.equal(iata.ok, false)
  const lower = parseAeroHubKml(fixture.replace("<value>EGLL</value>", "<value>egll</value>"), HOSTS)
  assert.equal(lower.ok, true)
}

// flightUrl: only https on an allowed host, else dropped (the import still works).
{
  for (const bad of ["http://aerohubradar.com/x", "https://evil.com/x", "https://aerohubradar.com.evil.com/x", "https://u:p@aerohubradar.com/x", "javascript:alert(1)", "not a url"]) {
    const r = parseAeroHubKml(fixture.replace("https://aerohubradar.com/QR520/qatari300va", bad), HOSTS)
    assert.equal(r.ok && r.meta.flightUrl, null, bad)
  }
}

// Safe XML: a DTD or entity is refused, not resolved.
{
  const xxe = fixture.replace('<kml ', '<!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml ')
  const r = parseAeroHubKml(xxe, HOSTS)
  assert.deepEqual([r.ok, !r.ok && r.code], [false, "invalid_kml"])
}

// Broken input.
{
  for (const bad of ["", "not xml", "<kml><Document></kml>", "<html/>", '<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>']) {
    const r = parseAeroHubKml(bad, HOSTS)
    assert.equal(r.ok, false, bad)
  }
  const noRoute = fixture.replace(/<Placemark>\s*<name>Route<\/name>[\s\S]*?<\/Placemark>/, "")
  const r = parseAeroHubKml(noRoute, HOSTS)
  assert.deepEqual([r.ok, !r.ok && r.code], [false, "invalid_kml"])
  const badCoord = parseAeroHubKml(fixture.replace("115.966547,-31.939795,0 ", "abc,def,0 "), HOSTS)
  assert.equal(badCoord.ok, false)
}

// Names that don't line up with the route are ignored: nothing is dropped by mistake.
{
  const noFolder = fixture.replace(/<Folder>[\s\S]*<\/Folder>/, "")
  const r = parseAeroHubKml(noFolder, HOSTS)
  assert.equal(r.ok && r.droppedMarkers, 0)
  assert.equal(r.ok && r.route.waypoints.length, 117)
}

console.log("aerohub-parser: all checks passed")
