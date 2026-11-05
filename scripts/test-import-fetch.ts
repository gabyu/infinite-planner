// Run with `pnpm test:import-fetch`. Plain asserts: the project has no test runner.
// The import path with fetch mocked: fetch limits (redirect, 403/410, timeout, size, type) and the parser behind it.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { getPartner } from "@/config/partners"
import { parseAeroHubKml } from "@/lib/partners/aerohub-parser"
import { fetchPartnerKml } from "@/lib/partners/fetch-kml"

const partner = { ...getPartner("aerohubradar")!, fetchTimeoutMs: 80, maxFileSizeBytes: 20_000 }
const url = new URL("https://aerohubradar.com/api/kml/QR520/qr520.kml?exp=1&sig=x")
const KML = "application/vnd.google-earth.kml+xml; charset=utf-8"
const fixture = readFileSync("scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml", "utf8")

const respond = (body: BodyInit | null, init: ResponseInit = {}) => (async () => new Response(body, init)) as unknown as typeof fetch
const run = (impl: typeof fetch) => fetchPartnerKml(partner, url, impl)

async function main() {
  // Success, and the request asked for no redirect.
  {
    let seen: RequestInit | undefined
    const impl = (async (_u: string, init: RequestInit) => {
      seen = init
      return new Response(fixture, { status: 200, headers: { "content-type": KML } })
    }) as unknown as typeof fetch
    const r = await run(impl)
    assert.equal(r.ok, true)
    assert.equal(seen?.redirect, "manual")
    assert.ok(seen?.signal)
    if (r.ok) {
      const parsed = parseAeroHubKml(r.text, partner.flightUrlHosts)
      assert.equal(parsed.ok && parsed.meta.departure, "YPPH")
      assert.equal(parsed.ok && parsed.meta.arrival, "EGLL")
    }
  }

  // Content type: must START with the KML type, charset or not.
  assert.equal((await run(respond(fixture, { headers: { "content-type": "application/vnd.google-earth.kml+xml" } }))).ok, true)
  for (const type of ["text/html", "application/xml", "text/xml", "application/octet-stream", "application/vnd.google-earth.kmz", "text/plain; application/vnd.google-earth.kml+xml"]) {
    const r = await run(respond(fixture, { headers: { "content-type": type } }))
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "wrong_type"], type)
  }
  assert.equal((await run(respond(fixture))).ok, false) // no content type at all

  // Expired link: 403 or 410.
  for (const status of [403, 410]) {
    const r = await run(respond("", { status, headers: { "content-type": KML } }))
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "expired"], String(status))
  }

  // Other failures: network-ish.
  for (const status of [404, 500, 502]) {
    const r = await run(respond("", { status }))
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "network"], String(status))
  }
  {
    const r = await run((async () => { throw new TypeError("fetch failed") }) as unknown as typeof fetch)
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "network"])
  }

  // Redirects are never followed.
  for (const status of [301, 302, 307, 308]) {
    const r = await run(respond(null, { status, headers: { location: "https://evil.com/x", "content-type": KML } }))
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "redirect"], String(status))
  }

  // Timeout: connection that never answers, and a body that stalls.
  {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch
    const r = await run(hang)
    assert.deepEqual([r.ok, !r.ok && r.code], [false, "timeout"])

    const stall = ((_u: string, init: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("<kml>"))
          init.signal!.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")))
        },
      })
      return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": KML } }))
    }) as unknown as typeof fetch
    const r2 = await run(stall)
    assert.deepEqual([r2.ok, !r2.ok && r2.code], [false, "timeout"])
  }

  // Size: the limit holds with a lying Content-Length, with none, and for an honest declaration.
  {
    const big = "x".repeat(partner.maxFileSizeBytes + 1)
    const honest = await run(respond(big, { headers: { "content-type": KML, "content-length": String(big.length) } }))
    assert.deepEqual([honest.ok, !honest.ok && honest.code], [false, "too_large"])

    let pulled = 0
    const endless = ((_u: string, init: RequestInit) => {
      const body = new ReadableStream({
        pull(controller) {
          pulled++
          controller.enqueue(new Uint8Array(4096))
          if (pulled > 1000) controller.close()
        },
      })
      return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": KML, "content-length": "10" } }))
    }) as unknown as typeof fetch
    const lying = await run(endless)
    assert.deepEqual([lying.ok, !lying.ok && lying.code], [false, "too_large"])
    assert.ok(pulled < 50, `stopped reading early (pulled ${pulled} chunks)`)
  }

  // Missing airport, end to end: fetched fine, refused by the parser.
  {
    const noArrival = fixture.replace(/<Data name="arrival"><value>[^<]*<\/value><\/Data>/, "")
    const r = await run(respond(noArrival, { headers: { "content-type": KML } }))
    assert.equal(r.ok, true)
    if (r.ok) {
      const parsed = parseAeroHubKml(r.text, partner.flightUrlHosts)
      assert.deepEqual([parsed.ok, !parsed.ok && parsed.code], [false, "invalid_airports"])
    }
  }

  console.log("import-fetch: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
