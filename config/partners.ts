// Partner content sources for /import. Code only: no database, no admin screen (phase 2).
// A partner link is `/import?src=<id>&kml=<signed URL>`; the server fetches that URL, so everything below is the allowlist
// that keeps the fetch from being turned against us (SSRF). Details: lib/partners/validate-url.ts.

export interface Partner {
  id: string
  name: string
  /** Kill switch: a disabled partner is rejected as if it did not exist. */
  enabled: boolean
  /** Exact hostnames the KML may be fetched from (no wildcard, no subdomain match). */
  allowedHosts: readonly string[]
  allowedPathPrefix: string
  /** Hostnames the "View on …" link may point to. */
  flightUrlHosts: readonly string[]
  maxFileSizeBytes: number
  fetchTimeoutMs: number
  attribution: string
  /** Local testing only: allows http and one port on a host from allowedHosts. Never set on a real partner. */
  devOnly?: { port: number }
}

export const partners: readonly Partner[] = [
  {
    id: "aerohubradar",
    name: "AeroHub Radar",
    enabled: true,
    allowedHosts: ["aerohubradar.com"],
    allowedPathPrefix: "/api/kml/",
    flightUrlHosts: ["aerohubradar.com"],
    maxFileSizeBytes: 1_048_576,
    fetchTimeoutMs: 5000,
    attribution: "Imported from AeroHub Radar",
  },
  // Serves the committed fixture from this app's own dev server (app/api/dev/aerohub-fixture). Only on `next dev`:
  // on Vercel (staging and production) NODE_ENV is "production", so this entry is off.
  {
    id: "aerohubradar-dev",
    name: "AeroHub Radar",
    enabled: process.env.NODE_ENV === "development",
    allowedHosts: ["localhost"],
    allowedPathPrefix: "/api/dev/aerohub-fixture/",
    flightUrlHosts: ["aerohubradar.com"],
    maxFileSizeBytes: 1_048_576,
    fetchTimeoutMs: 5000,
    attribution: "Imported from AeroHub Radar",
    devOnly: { port: 3000 },
  },
]

export function getPartner(id: string | null | undefined): Partner | null {
  if (!id) return null
  const partner = partners.find((p) => p.id === id)
  return partner && partner.enabled ? partner : null
}
