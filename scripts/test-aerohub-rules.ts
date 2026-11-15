// Run with `pnpm test:aerohub-rules`. Plain asserts: the project has no test runner.
// The rules around an AeroHub plan: it can't be published, the notice names all three trackers, the logo follows the kill
// switch, the logo files are the supplied ones, and the expired-link message.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { getPartner, partners } from "@/config/partners"
import { legalCopy, partnerImportCopy } from "@/lib/copy"
import { FLIGHT_PLAN_SOURCES, SHAREABLE_SOURCES, isTrackerDerived, sourceLabel, sourceShort } from "@/lib/flight-plans"

// Publishing: AeroHub is a tracker-style source, like FlightRadar24 and FlightAware (the database says the same through
// app_settings.shareable_sources = {Sketch, Imported}).
assert.ok(FLIGHT_PLAN_SOURCES.includes("AeroHub"))
assert.ok(!SHAREABLE_SOURCES.includes("AeroHub"))
assert.equal(isTrackerDerived(["AeroHub"]), true)
assert.equal(isTrackerDerived(["AeroHub", "Sketch"]), true, "a copy keeps the origin")
assert.equal(isTrackerDerived(["Sketch"]), false)
assert.equal(isTrackerDerived(["Imported"]), false)
assert.equal(isTrackerDerived([]), true)
assert.equal(sourceLabel("AeroHub"), "AeroHub Radar")
assert.equal(sourceShort("AeroHub"), "AeroHub")

// The notice names the three sources.
assert.equal(
  legalCopy.publishOnlyOwnDesigns,
  "Flight plans converted from FlightRadar24, FlightAware or AeroHub Radar files can't be published.",
)

// Expired link: the page's message.
assert.equal(partnerImportCopy.expiredTitle, "This link has expired")
assert.equal(partnerImportCopy.expiredBody, "Click 'Open in Infinite Planner' again on AeroHub Radar.")

// The logo: configured for the real partner, and gone with the kill switch (getPartner refuses a
// disabled partner, which is what the /import page asks first).
const real = getPartner("aerohubradar")!
assert.ok(real.logo)
assert.equal(real.logo!.heightPx, 20) // chosen by Gab on 2026-11-15; the authorization asks for 24 px or more
assert.equal(real.logo!.alt, "AeroHub Radar")
assert.ok(real.logo!.lightBg.endsWith("logo-light-bg.svg") && real.logo!.darkBg.endsWith("logo-dark-bg.svg"))
const disabled = partners.map((p) => (p.id === "aerohubradar" ? { ...p, enabled: false } : p))
assert.equal(disabled.find((p) => p.id === "aerohubradar")!.enabled, false)
assert.equal(
  [getPartner("aerohubradar-dev")].filter(Boolean).length,
  process.env.NODE_ENV === "development" ? 1 : 0,
  "the dev partner (and its logo) exists only on next dev",
)

// The logo files are the supplied ones: the wordmark with the tagline, 200x30, one in black and one in white, blue in both.
for (const [file, ink] of [
  [real.logo!.lightBg, "black"],
  [real.logo!.darkBg, "white"],
] as const) {
  const svg = readFileSync(`public${file}`, "utf8")
  assert.ok(svg.startsWith('<svg width="200" height="30" viewBox="0 0 200 30"'), file)
  assert.ok(svg.includes(`fill="${ink}"`) && svg.includes('fill="#008BFD"'), file)
  assert.equal(readFileSync(`public${file}`).length, 17121, "unexpected size: was the file changed? " + file) // bytes, as supplied
}

console.log("aerohub-rules: all checks passed")
