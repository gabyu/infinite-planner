import type { Metadata } from "next"
import { headers } from "next/headers"
import { randomUUID } from "node:crypto"
import { FlightPlanEditor } from "@/components/flight-plan-editor"
import { ImportError } from "@/components/import/import-error"
import { parseAeroHubKml } from "@/lib/partners/aerohub-parser"
import { fetchPartnerKml } from "@/lib/partners/fetch-kml"
import { logImport, type ImportResult } from "@/lib/partners/import-log"
import { loggablePath, lookupPartner, validatePartnerUrl } from "@/lib/partners/validate-url"
import { allowAction } from "@/lib/rate-limit"

// Partner link: /import?src=aerohubradar&kml=<signed URL>. The KML is fetched here, on the server, never from the browser,
// and only after the URL passed the partner's allowlist. The signed URL is never sent to the client or logged.
// Brief and decisions: see CLAUDE.md ("Partner import").
export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Import",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null)

export default async function ImportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const importId = randomUUID()
  const src = one(searchParams.src)
  const kml = one(searchParams.kml)

  const fail = (result: Exclude<ImportResult, "success">, extra?: { partnerId?: string; path?: string | null; backUrl?: string | null }) => {
    logImport({ partner: extra?.partnerId ? { id: extra.partnerId } : null, importId, result, path: extra?.path })
    return <ImportError code={result} backUrl={extra?.backUrl ?? null} />
  }

  const forwarded = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowAction(`import:${forwarded}`, 20)) return fail("rate_limited")

  const found = lookupPartner(src)
  if (!found.ok) return fail("unknown_partner")
  const { partner } = found
  const backUrl = `https://${partner.flightUrlHosts[0]}/`

  const checked = validatePartnerUrl(partner, kml)
  if (!checked.ok) return fail("invalid_url", { partnerId: partner.id, backUrl })
  const path = loggablePath(checked.url)

  const fetched = await fetchPartnerKml(partner, checked.url)
  if (!fetched.ok) return fail(fetched.code, { partnerId: partner.id, path, backUrl })

  const parsed = parseAeroHubKml(fetched.text, partner.flightUrlHosts)
  if (!parsed.ok) return fail(parsed.code, { partnerId: partner.id, path, backUrl })

  logImport({
    partner,
    importId,
    result: "success",
    path,
    departure: parsed.meta.departure,
    arrival: parsed.meta.arrival,
  })

  return (
    <FlightPlanEditor
      initialMode="import"
      preloaded={{
        importId,
        partnerId: partner.id,
        origin: parsed.meta.departure,
        destination: parsed.meta.arrival,
        route: parsed.route,
        banner: {
          attribution: partner.attribution,
          aerohubId: parsed.meta.aerohubId,
          callsign: parsed.meta.callsign,
          flightUrl: parsed.meta.flightUrl,
        },
      }}
    />
  )
}
