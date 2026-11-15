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
  /**
   * The partner's logo, as supplied (never recoloured or redrawn). Shown only in the import banner and only while the
   * partner is `enabled`: the kill switch removes it with everything else. `heightPx` is its height (width follows the
   * original proportions). The partner's authorization asks for 24 px or more so the tagline stays legible; Gab chose
   * 20 px on 2026-11-15 because 24 px did not fit beside the panel's collapse button.
   */
  logo?: { lightBg: string; darkBg: string; alt: string; heightPx: number }
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
    logo: {
      lightBg: "/partners/aerohubradar/logo-light-bg.svg",
      darkBg: "/partners/aerohubradar/logo-dark-bg.svg",
      alt: "AeroHub Radar",
      heightPx: 20,
    },
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
    logo: {
      lightBg: "/partners/aerohubradar/logo-light-bg.svg",
      darkBg: "/partners/aerohubradar/logo-dark-bg.svg",
      alt: "AeroHub Radar",
      heightPx: 20,
    },
    devOnly: { port: 3000 },
  },
]

export function getPartner(id: string | null | undefined): Partner | null {
  if (!id) return null
  const partner = partners.find((p) => p.id === id)
  return partner && partner.enabled ? partner : null
}
