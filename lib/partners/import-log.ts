import type { Partner } from "@/config/partners"

// One structured log line per partner import (Vercel runtime logs). The signed URL is never logged: the caller passes
// the path only (loggablePath), so `exp` and `sig` stay out. `importId` ties the later "downloaded" line to the import.

export type ImportResult =
  | "success"
  | "unknown_partner"
  | "invalid_url"
  | "expired"
  | "timeout"
  | "network"
  | "redirect"
  | "too_large"
  | "wrong_type"
  | "invalid_kml"
  | "invalid_airports"
  | "rate_limited"

export function logImport(event: {
  partner: Pick<Partner, "id"> | null
  src?: string | null
  importId: string
  result: ImportResult
  path?: string | null
  departure?: string | null
  arrival?: string | null
}) {
  console.log(
    JSON.stringify({
      event: "partner_import",
      at: new Date().toISOString(),
      partner: event.partner?.id ?? "unknown",
      importId: event.importId,
      result: event.result,
      path: event.path ?? null,
      departure: event.departure ?? null,
      arrival: event.arrival ?? null,
    }),
  )
}

export function logImportDownloaded(partnerId: string, importId: string) {
  console.log(JSON.stringify({ event: "partner_import_downloaded", at: new Date().toISOString(), partner: partnerId, importId }))
}
