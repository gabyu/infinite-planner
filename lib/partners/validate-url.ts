import { getPartner, type Partner } from "@/config/partners"

// The URL in `?kml=` is chosen by whoever built the link, and our server will fetch it: this is the SSRF gate.
// Everything is checked on the parsed URL (never on the raw string), and the hostname must be an exact entry of the
// partner's allowlist, so `aerohubradar.com.evil.com`, `evil.com/aerohubradar.com` and `aerohubradar.com.` all fail.

export type UrlRejection = "unknown_partner" | "invalid_url"

export type PartnerLookup = { ok: true; partner: Partner } | { ok: false; reason: "unknown_partner" }
export function lookupPartner(src: string | null | undefined): PartnerLookup {
  const partner = getPartner(src)
  return partner ? { ok: true, partner } : { ok: false, reason: "unknown_partner" }
}

const MAX_URL_LENGTH = 2048
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export function validatePartnerUrl(
  partner: Partner,
  raw: string | null | undefined,
): { ok: true; url: URL } | { ok: false; reason: "invalid_url" } {
  const bad = { ok: false, reason: "invalid_url" } as const
  if (!raw || raw.length > MAX_URL_LENGTH) return bad

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return bad
  }

  const dev = partner.devOnly
  if (url.protocol !== "https:" && !(dev && url.protocol === "http:")) return bad
  if (url.username || url.password) return bad
  if (dev ? url.port !== String(dev.port) : url.port !== "") return bad

  const host = url.hostname
  // IP literals (v4, v6 in brackets, and the numeric forms the URL parser normalises to dotted v4).
  if (IPV4.test(host) || host.startsWith("[") || host.includes(":")) return bad
  if (!partner.allowedHosts.includes(host)) return bad

  if (!url.pathname.startsWith(partner.allowedPathPrefix)) return bad
  // The parser has already resolved "." and ".." segments; encoded separators have no business in a KML path.
  if (/%2f|%5c|\\/i.test(url.pathname)) return bad

  return { ok: true, url }
}

/** The path only: no query, so the signature (`exp`, `sig`) never reaches a log. */
export function loggablePath(url: URL | null): string | null {
  return url ? url.pathname : null
}
