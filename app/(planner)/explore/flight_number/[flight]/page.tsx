import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { BreadcrumbJsonLd } from "@/components/explore/breadcrumb-json-ld"
import { PlanGrid } from "@/components/explore/plan-card"
import { PrelaunchBanner } from "@/components/explore/prelaunch-banner"
import { Button } from "@/components/ui/button"
import { BRAND_NAME, LIBRARY_NAV_LABEL, LIBRARY_PATH } from "@/lib/brand"
import { getLibraryLaunched } from "@/lib/library"
import { requireLibraryAccess } from "@/lib/library-access"
import { decodeCursor, encodeCursor, listPlans } from "@/lib/library-listing"
import { flightNumberPath } from "@/lib/plan-slug"
import { buildMetadata } from "@/lib/seo"

// /explore/flight_number/AF69: every public plan of one flight number. Indexable while it has at least one plan;
// an empty one is a 404.
export const dynamic = "force-dynamic"

const FLIGHT_PATTERN = /^[A-Za-z0-9]{1,12}$/

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { flight: string }
  searchParams: { cursor?: string }
}): Promise<Metadata> {
  if (!FLIGHT_PATTERN.test(params.flight)) return { robots: { index: false, follow: false } }
  const flight = params.flight.toUpperCase()
  const { plans } = await listPlans({ filters: { flight }, limit: 1 })
  const title = `${flight} flight plans | ${BRAND_NAME}`
  const description = `Want to fly ${flight}? Browse flight plans of ${flight} shared by pilots, from real flights and hand-drawn routes, and download them for Infinite Flight.`
  const launched = await getLibraryLaunched()
  return buildMetadata({
    title,
    description,
    path: flightNumberPath(flight),
    indexable: launched && plans.length > 0 && !searchParams.cursor,
    follow: true,
  })
}

export default async function FlightNumberPage({
  params,
  searchParams,
}: {
  params: { flight: string }
  searchParams: { cursor?: string }
}) {
  const { prelaunch } = await requireLibraryAccess()
  if (!FLIGHT_PATTERN.test(params.flight)) notFound()
  const flight = params.flight.toUpperCase()
  // One spelling per flight number: AF69.
  if (params.flight !== flight) permanentRedirect(flightNumberPath(flight))

  const { plans, next } = await listPlans({ filters: { flight }, cursor: decodeCursor(searchParams.cursor) })
  if (plans.length === 0) notFound()
  const path = flightNumberPath(flight)

  return (
    <>
      {prelaunch && <PrelaunchBanner />}
      <BreadcrumbJsonLd
        items={[
          { name: LIBRARY_NAV_LABEL, path: LIBRARY_PATH },
          { name: flight, path },
        ]}
      />
      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href={LIBRARY_PATH} className="no-underline hover:text-foreground">
            {LIBRARY_NAV_LABEL}
          </Link>
          <span aria-hidden> / </span>
          <span>{flight}</span>
        </nav>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          <span className="font-mono">{flight}</span> flight plans
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] text-muted-foreground">
          Every published flight plan of {flight}, ready for Infinite Flight.
        </p>
        <div className="mt-10">
          <PlanGrid plans={plans} label={`Flight plans of ${flight}`} />
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
      </div>
    </>
  )
}
