import Link from "next/link"
import { PageShell } from "@/components/ds/page-shell"
import { Button } from "@/components/ui/button"
import { partnerImportCopy } from "@/lib/copy"
import type { ImportResult } from "@/lib/partners/import-log"

type ErrorCode = Exclude<ImportResult, "success">

const t = partnerImportCopy
const MESSAGES: Record<ErrorCode, { title: string; body: string }> = {
  unknown_partner: { title: t.unknownPartnerTitle, body: t.unknownPartnerBody },
  invalid_url: { title: t.invalidUrlTitle, body: t.invalidUrlBody },
  redirect: { title: t.invalidUrlTitle, body: t.invalidUrlBody },
  expired: { title: t.expiredTitle, body: t.expiredBody },
  timeout: { title: t.unreachableTitle, body: t.unreachableBody },
  network: { title: t.unreachableTitle, body: t.unreachableBody },
  too_large: { title: t.badFileTitle, body: t.badFileBody },
  wrong_type: { title: t.badFileTitle, body: t.badFileBody },
  invalid_kml: { title: t.invalidKmlTitle, body: t.invalidKmlBody },
  invalid_airports: { title: t.invalidAirportsTitle, body: t.invalidAirportsBody },
  rate_limited: { title: t.tooManyTitle, body: t.tooManyBody },
}

export function ImportError({ code, backUrl }: { code: ErrorCode; backUrl: string | null }) {
  const message = MESSAGES[code]
  return (
    <PageShell title={t.errorPageTitle} description={message.title} noBack>
      <div className="flex max-w-xl flex-col items-start rounded-lg border bg-card px-6 py-8">
        <p className="max-w-sm text-sm text-muted-foreground">{message.body}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {backUrl && (
            <Button asChild>
              <a href={backUrl} rel="noopener noreferrer" className="no-underline">
                {t.backToPartner}
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/" className="no-underline">
              {t.goHome}
            </Link>
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
