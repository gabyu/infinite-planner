import { ExternalLink } from "lucide-react"
import { partnerImportCopy } from "@/lib/copy"
import type { PreloadedImport } from "@/lib/partners/preloaded"

type Logo = NonNullable<PreloadedImport["banner"]["logo"]>

// The partner's logo, exactly as supplied: the black file on light backgrounds, the white one on dark (switched with the
// theme), never recoloured, cropped, redrawn or paired with another logo. Sized by height only, so its proportions
// hold (the files are 200x30). It ends 40 px before the row's right edge so it never runs under the panel's collapse
// button; on a very narrow panel it is left out and the text line below still names the source.
//
// Alignment: the parent row is baseline-aligned, so the image's bottom edge sits on the airports' baseline. The wordmark's
// own baseline is above that edge (the tagline hangs below it), so the image is moved down by the tagline's share of its
// height: the wordmark, not the tagline, lands on the baseline. 20.34 is the wordmark's baseline in the file's 30-unit height.
const WORDMARK_BASELINE = 20.34
const FILE_HEIGHT = 30

export function PartnerLogo({ logo }: { logo: Logo }) {
  const height = logo.heightPx
  const width = Math.round((height * 200) / FILE_HEIGHT)
  const drop = (height * (FILE_HEIGHT - WORDMARK_BASELINE)) / FILE_HEIGHT
  const common = { alt: logo.alt, height, width, style: { height, width: "auto", position: "relative", top: drop } } as const
  return (
    <span className="mr-10 hidden shrink-0 min-[340px]:block" data-partner-logo>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.lightBg} {...common} className="block dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.darkBg} {...common} className="hidden dark:block" />
    </span>
  )
}

// One light line under the route: "Imported from AeroHub Radar • ID MU294". The ID is the AeroHub ID (not an official flight
// number, never put where one goes); when the file gave a valid link, the ID is that link ("View on AeroHub Radar", new tab).
// No wording that suggests an endorsement or an official status.
export function PartnerBanner({ banner }: { banner: PreloadedImport["banner"] }) {
  const id = banner.aerohubId
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{banner.attribution}</span>
      {id && (
        <>
          <span aria-hidden className="mx-1.5">
            &bull;
          </span>
          {partnerImportCopy.idLabel}{" "}
          {banner.flightUrl ? (
            <a
              href={banner.flightUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={partnerImportCopy.viewOnPartner}
              aria-label={`${partnerImportCopy.viewOnPartner}: ${id}`}
              className="inline-flex items-center gap-0.5 font-mono text-primary hover:underline"
            >
              {id}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : (
            <span className="font-mono text-foreground">{id}</span>
          )}
        </>
      )}
    </p>
  )
}
