import { ExternalLink } from "lucide-react"
import { partnerImportCopy } from "@/lib/copy"
import type { PreloadedImport } from "@/lib/partners/preloaded"

type Logo = NonNullable<PreloadedImport["banner"]["logo"]>

// The partner's logo, exactly as supplied: the black file on light backgrounds, the white one on dark (switched with the
// theme), never recoloured, cropped, redrawn or paired with another logo. Sized by height only, so its proportions
// hold (the files are 200x30). At least `minHeightPx` tall so the tagline stays legible; on a very narrow panel it is
// left out and the text line below still names the source.
export function PartnerLogo({ logo }: { logo: Logo }) {
  const height = logo.minHeightPx
  const width = Math.round((height * 200) / 30)
  const common = { alt: logo.alt, height, width, style: { height, width: "auto" } } as const
  return (
    <span className="hidden shrink-0 min-[340px]:block" data-partner-logo>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.lightBg} {...common} className="block dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.darkBg} {...common} className="hidden dark:block" />
    </span>
  )
}

// One quiet line under the route. The AeroHub ID is labelled as such: it is not an official flight number and is never
// put where one goes. No wording that suggests an endorsement or an official status.
export function PartnerBanner({ banner }: { banner: PreloadedImport["banner"] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
