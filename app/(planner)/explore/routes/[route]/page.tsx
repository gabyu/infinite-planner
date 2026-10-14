import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BreadcrumbJsonLd } from "@/components/explore/breadcrumb-json-ld"
import { PlanGrid } from "@/components/explore/plan-card"
import { PrelaunchBanner } from "@/components/explore/prelaunch-banner"
import { Button } from "@/components/ui/button"
import { getAirportInfo } from "@/lib/airports"
import { BRAND_NAME, LIBRARY_NAME, LIBRARY_PATH } from "@/lib/brand"
import { requireLibraryAccess } from "@/lib/library-access"
import { getLibraryLaunched } from "@/lib/library"
import { decodeCursor, encodeCursor, listPlans } from "@/lib/library-listing"
import { describeEnd } from "@/lib/plan-meta"
import { locationPath, routeHubPath } from "@/lib/plan-slug"

// /explore/routes/lfpg-klax: every public plan of one origin-destination pair. Indexable only while it has
// at least one plan; an empty hub is a 404 with noindex.
export const dynamic = "force-dynamic"

function parse(route: string) {
  const match = /^([a-z0-9]{4})-([a-z0-9]{4})$/.exec(route)
  if (!match) return null
  const from = match[1].toUpperCase()
  const to = match[2].toUpperCase()
  return getAirportInfo(from) && getAirportInfo(to) ? { from, to } : null
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { route: string }
  searchParams: { cursor?: string }
}): Promise<Metadata> {
  const ends = parse(params.route)
  if (!ends) return { robots: { index: false, follow: false } }
  const { plans } = await listPlans({ filters: { origins: [ends.from], destinations: [ends.to] }, limit: 1 })
  const from = describeEnd(ends.from, null)
  const to = describeEnd(ends.to, null)
  const title = `${from.city ?? ends.from} (${from.iata ?? ends.from}) to ${to.city ?? ends.to} (${to.iata ?? ends.to}) flight plans | ${BRAND_NAME}`
  const description = `Flight plans from ${from.name ?? ends.from} (${ends.from}) to ${to.name ?? ends.to} (${ends.to}) for Infinite Flight. Download one, or import it and adjust the route.`
  const launched = await getLibraryLaunched()
  const indexable = launched && plans.length > 0 && !searchParams.cursor
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: routeHubPath(ends.from, ends.to) },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: "website", title, description, siteName: BRAND_NAME },
  }
}

export default async function RouteHubPage({
  params,
  searchParams,
}: {
  params: { route: string }
  searchParams: { cursor?: string }
}) {
  const { prelaunch } = await requireLibraryAccess()
  const ends = parse(params.route)
  if (!ends) notFound()
  const { plans, next } = await listPlans({
    filters: { origins: [ends.from], destinations: [ends.to] },
    cursor: decodeCursor(searchParams.cursor),
  })
  if (plans.length === 0) notFound()

  const from = describeEnd(ends.from, null)
  const to = describeEnd(ends.to, null)
  const path = routeHubPath(ends.from, ends.to)

  return (
    <>
      {prelaunch && <PrelaunchBanner />}
      <BreadcrumbJsonLd
        items={[
          { name: LIBRARY_NAME, path: LIBRARY_PATH },
          { name: `${ends.from} to ${ends.to}`, path },
        ]}
      />
      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href={LIBRARY_PATH} className="no-underline hover:text-foreground">
            {LIBRARY_NAME}
          </Link>
          <span aria-hidden> / </span>
          <span>
            {ends.from} to {ends.to}
          </span>
        </nav>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          {from.label} to {to.label}
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] text-muted-foreground">
          Flight plans from {from.name ?? ends.from} to {to.name ?? ends.to}, ready for Infinite Flight.
        </p>
        <div className="mt-10">
          <PlanGrid plans={plans} label={`Flight plans from ${ends.from} to ${ends.to}`} />
          {next && (
            <div className="mt-10 text-center">
              <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                <Link href={`${path}?cursor=${encodeCursor(next)}`} rel="next" className="no-underline">
                  Show more
                </Link>
              </Button>
            </div>
          )}
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          <Link href={locationPath(ends.from)} className="underline underline-offset-2">
            More from {from.city ?? ends.from}
          </Link>
          {" · "}
          <Link href={locationPath(ends.to)} className="underline underline-offset-2">
            More to {to.city ?? ends.to}
          </Link>
        </p>
      </div>
    </>
  )
}
