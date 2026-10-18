import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { BreadcrumbJsonLd } from "@/components/explore/breadcrumb-json-ld"
import { PlanGrid } from "@/components/explore/plan-card"
import { PrelaunchBanner } from "@/components/explore/prelaunch-banner"
import { Button } from "@/components/ui/button"
import { getAirportInfo } from "@/lib/airports"
import { BRAND_NAME, LIBRARY_NAV_LABEL, LIBRARY_PATH } from "@/lib/brand"
import { requireLibraryAccess } from "@/lib/library-access"
import { getLibraryLaunched } from "@/lib/library"
import { listPlans } from "@/lib/library-listing"
import { describeEnd } from "@/lib/plan-meta"
import { flightNumberPath, locationPath } from "@/lib/plan-slug"
import { buildMetadata } from "@/lib/seo"

// /explore/location/KPHX: the departures and arrivals of one airport. Same indexing rule as the route hubs.
export const dynamic = "force-dynamic"

const HUB_SIZE = 12

function parse(icao: string) {
  if (!/^[a-z0-9]{4}$/i.test(icao)) return null
  return getAirportInfo(icao.toUpperCase())
}

export async function generateMetadata({ params }: { params: { icao: string } }): Promise<Metadata> {
  const airport = parse(params.icao)
  if (!airport) return { robots: { index: false, follow: false } }
  const { plans } = await listPlans({ filters: { airports: [airport.icao] }, limit: 1 })
  const place = airport.city.replace(/\s*\(.*$/, "").split(",")[0].trim()
  const codes = airport.iata ? `${airport.icao}/${airport.iata}` : airport.icao
  const title = `Flight plans from and to ${place} (${codes}) | ${BRAND_NAME}`
  const description = `Departing from or arriving at ${airport.name} (${codes})? Find flight plans shared by fellow pilots and download them for Infinite Flight.`
  const launched = await getLibraryLaunched()
  return buildMetadata({
    title,
    description,
    path: locationPath(airport.icao),
    indexable: false,
    follow: true,
  })
}

export default async function AirportHubPage({ params }: { params: { icao: string } }) {
  const { prelaunch } = await requireLibraryAccess()
  const airport = parse(params.icao)
  if (!airport) notFound()
  // One spelling per airport: KPHX.
  if (params.icao !== airport.icao) permanentRedirect(locationPath(airport.icao))

  const [departures, arrivals] = await Promise.all([
    listPlans({ filters: { origins: [airport.icao] }, limit: HUB_SIZE }),
    listPlans({ filters: { destinations: [airport.icao] }, limit: HUB_SIZE }),
  ])
  if (departures.plans.length === 0 && arrivals.plans.length === 0) notFound()

  const end = describeEnd(airport.icao, airport.name)
  const path = locationPath(airport.icao)

  return (
    <>
      {prelaunch && <PrelaunchBanner />}
      <BreadcrumbJsonLd
        items={[
          { name: LIBRARY_NAV_LABEL, path: LIBRARY_PATH },
          { name: airport.icao, path },
        ]}
      />
      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href={LIBRARY_PATH} className="no-underline hover:text-foreground">
            {LIBRARY_NAV_LABEL}
          </Link>
          <span aria-hidden> / </span>
          <span>{airport.icao}</span>
        </nav>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          {end.label}
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] text-muted-foreground">
          Flight plans departing from and arriving at {airport.name}, ready for Infinite Flight.
        </p>

        {departures.plans.length > 0 && (
          <section className="mt-12" aria-labelledby="departures">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="departures" className="font-display text-2xl font-semibold tracking-tight">
                Departures
              </h2>
              {departures.next && (
                <Link href={`${LIBRARY_PATH}?from=${airport.icao}`} className="text-sm link text-muted-foreground hover:text-foreground">
                  See all departures
                </Link>
              )}
            </div>
            <PlanGrid plans={departures.plans} label={`Flight plans departing from ${airport.icao}`} />
          </section>
        )}
        {arrivals.plans.length > 0 && (
          <section className="mt-12" aria-labelledby="arrivals">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="arrivals" className="font-display text-2xl font-semibold tracking-tight">
                Arrivals
              </h2>
              {arrivals.next && (
                <Link href={`${LIBRARY_PATH}?to=${airport.icao}`} className="text-sm link text-muted-foreground hover:text-foreground">
                  See all arrivals
                </Link>
              )}
            </div>
            <PlanGrid plans={arrivals.plans} label={`Flight plans arriving at ${airport.icao}`} />
          </section>
        )}
        <div className="mt-12">
          <Button asChild variant="outline" className="rounded-full">
            <Link href={LIBRARY_PATH} className="no-underline">
              Browse all of {LIBRARY_NAV_LABEL}
            </Link>
          </Button>
        </div>
      </div>
    </>
  )
}
