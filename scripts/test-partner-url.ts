// Run with `pnpm test:partner-url`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { getPartner } from "@/config/partners"
import { loggablePath, lookupPartner, validatePartnerUrl } from "@/lib/partners/validate-url"

const partner = getPartner("aerohubradar")!
assert.ok(partner)
const ok = (raw: string) => validatePartnerUrl(partner, raw).ok

// The good one.
assert.equal(ok("https://aerohubradar.com/api/kml/DL825/delta9.kml?exp=1&sig=abc"), true)

// Everything the brief lists, plus the usual tricks.
const rejected: Record<string, string> = {
  "wrong host": "https://example.com/api/kml/a.kml",
  "look-alike subdomain": "https://aerohubradar.com.evil.com/api/kml/a.kml",
  "prefix host": "https://evilaerohubradar.com/api/kml/a.kml",
  "subdomain": "https://www.aerohubradar.com/api/kml/a.kml",
  "trailing dot": "https://aerohubradar.com./api/kml/a.kml",
  "host in path": "https://evil.com/aerohubradar.com/api/kml/a.kml",
  "host in query": "https://evil.com/api/kml/a.kml?h=aerohubradar.com",
  http: "http://aerohubradar.com/api/kml/a.kml",
  "ip literal": "https://203.0.113.9/api/kml/a.kml",
  "ip as number": "https://3405803785/api/kml/a.kml",
  ipv6: "https://[::1]/api/kml/a.kml",
  "ipv6 mapped": "https://[::ffff:127.0.0.1]/api/kml/a.kml",
  localhost: "https://localhost/api/kml/a.kml",
  port: "https://aerohubradar.com:8443/api/kml/a.kml",
  "explicit default port is the same host": "https://aerohubradar.com:444/api/kml/a.kml",
  credentials: "https://user:pass@aerohubradar.com/api/kml/a.kml",
  "user only": "https://user@aerohubradar.com/api/kml/a.kml",
  "userinfo trick": "https://aerohubradar.com@evil.com/api/kml/a.kml",
  "wrong path": "https://aerohubradar.com/other/a.kml",
  "path traversal": "https://aerohubradar.com/api/kml/../../admin",
  "encoded slash": "https://aerohubradar.com/api/kml/..%2f..%2fadmin",
  backslash: "https://aerohubradar.com\\@evil.com/api/kml/a.kml",
  "other scheme": "file:///etc/passwd",
  ftp: "ftp://aerohubradar.com/api/kml/a.kml",
  "not a url": "not a url",
  empty: "",
  "too long": "https://aerohubradar.com/api/kml/" + "a".repeat(3000),
}
for (const [name, raw] of Object.entries(rejected)) assert.equal(ok(raw), false, name)
assert.equal(validatePartnerUrl(partner, null).ok, false)
assert.equal(validatePartnerUrl(partner, undefined).ok, false)

// The explicit default port is normalised away by the URL parser, which is fine: it is the same server.
assert.equal(ok("https://aerohubradar.com:443/api/kml/a.kml"), true)

// Partners: unknown or disabled are the same thing. The dev entry is off outside `next dev`.
assert.equal(lookupPartner("nope").ok, false)
assert.equal(lookupPartner("").ok, false)
assert.equal(lookupPartner(null).ok, false)
assert.equal(lookupPartner("AEROHUBRADAR").ok, false)
assert.equal(lookupPartner("aerohubradar").ok, true)
assert.equal(process.env.NODE_ENV === "development" || lookupPartner("aerohubradar-dev").ok === false, true)

// Logs never see the signature.
{
  const url = new URL("https://aerohubradar.com/api/kml/DL825/delta9.kml?exp=1700000000&sig=SECRET")
  const path = loggablePath(url)
  assert.equal(path, "/api/kml/DL825/delta9.kml")
  assert.ok(!path!.includes("SECRET") && !path!.includes("sig="))
  assert.equal(loggablePath(null), null)
}

console.log("partner-url: all checks passed")
