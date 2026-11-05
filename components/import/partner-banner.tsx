import { ExternalLink } from "lucide-react"
import { partnerImportCopy } from "@/lib/copy"
import type { PreloadedImport } from "@/lib/partners/preloaded"

// Shown in the editor for a plan opened from a partner link. The AeroHub ID is labelled as such: it is not an official
// flight number and is never put where one goes.
export function PartnerBanner({ banner }: { banner: PreloadedImport["banner"] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{banner.attribution}</span>
      {banner.aerohubId && (
        <span>
          {partnerImportCopy.idLabel} <span className="font-mono text-foreground">{banner.aerohubId}</span>
        </span>
      )}
      {banner.flightUrl && (
        <a
          href={banner.flightUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {partnerImportCopy.viewOnPartner}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </div>
  )
}
