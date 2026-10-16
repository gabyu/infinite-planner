import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Search } from "lucide-react"
import { getExploreFront } from "@/components/explore/explore-front"
import { PlanGrid } from "@/components/explore/plan-card"
import { PrelaunchBanner } from "@/components/explore/prelaunch-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BRAND_NAME, LIBRARY_NAME, LIBRARY_PATH } from "@/lib/brand"
import { getLibraryLaunched } from "@/lib/library"
import { requireLibraryAccess } from "@/lib/library-access"
import {
  decodeCursor,
  encodeCursor,
  filtersFromParams,
  filtersFromQuery,
  listPlans,
  SORT_LABELS,
  SORTS,
  sortFromParam,
  type ExploreParams,
} from "@/lib/library-listing"
import { flightNumberPath } from "@/lib/plan-slug"

// Read per request (the search form is plain GET parameters); the listing itself comes from the data
// cache, tagged so a publish or unpublish shows up within a minute at most.
export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

function paramsOf(searchParams: SearchParams): ExploreParams {
  const one = (key: string) => {
    const value = searchParams[key]
    return (Array.isArray(value) ? value[0] : value)?.slice(0, 80)
  }
  return { q: one("q"), from: one("from"), to: one("to"), flight: one("flight"), sort: one("sort"), cursor: one("cursor") }
}

const TITLE = `${LIBRARY_NAME}: flight plans for Infinite Flight | ${BRAND_NAME}`
const DESCRIPTION =
  "Browse flight plans built from real flights and hand-drawn routes. Download them for Infinite Flight, or import one and make it yours."

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const hasVariant = Object.values(paramsOf(searchParams)).some(Boolean)
  // Nothing of the library is indexable before the launch.
  const launched = await getLibraryLaunched()
  // Page 1 of the default listing is the indexable one; every filtered, sorted or paginated variant points back at it.
  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical: LIBRARY_PATH },
    robots: !launched ? { index: false, follow: false } : hasVariant ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", title: TITLE, description: DESCRIPTION, siteName: BRAND_NAME, url: LIBRARY_PATH },
  }
}

// A ruled section heading, like the section label of a magazine.
function SectionHeading({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="mb-5 border-t-2 border-foreground pt-3 text-xs font-semibold uppercase tracking-[0.16em]">
      {children}
    </h2>
  )
}

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const { prelaunch } = await requireLibraryAccess()
  const params = paramsOf(searchParams)

  // Searching a flight number goes straight to that flight's page.
  const searched = (params.q ?? "").trim()
  if (searched && !params.from && !params.to && !params.flight && !params.cursor) {
    const parsed = filtersFromQuery(searched)
    if (parsed.flight && Object.keys(parsed).length === 1) redirect(flightNumberPath(parsed.flight))
  }

  const sort = sortFromParam(params.sort)
  const filters = filtersFromParams(params)
  const cursor = decodeCursor(params.cursor)
  const filtered = !!(params.q || params.from || params.to || params.flight)
  // The front page: the default listing, first page. Anything else is a plain list of results.
  const front = !filtered && sort === "popular" && !cursor

  const [{ plans, next }, latest, featured] = await Promise.all([
    listPlans({ sort, filters, cursor }),
    front ? listPlans({ sort: "latest", limit: 6 }) : Promise.resolve(null),
    front ? getExploreFront() : Promise.resolve(null),
  ])
  // What the top of the page already shows is not repeated below it.
  const shown = new Set(featured?.ids ?? [])

  const nextHref = (() => {
    if (!next) return null
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value && key !== "cursor") query.set(key, value)
    query.set("cursor", encodeCursor(next))
    return `${LIBRARY_PATH}?${query.toString()}`
  })()

  const rest = front ? plans.filter((plan) => !shown.has(plan.id)) : plans
  const latestPlans = (latest?.plans ?? []).filter((plan) => !shown.has(plan.id))

  return (
    <>
      {prelaunch && <PrelaunchBanner />}
      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-8 sm:pt-12">
        <header className="border-b pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{BRAND_NAME} · The library</p>
          <h1 className="mt-3 font-display text-[clamp(3rem,9vw,7rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
            {LIBRARY_NAME}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Flight plans from real flights and hand-drawn routes. Download one for Infinite Flight, or import it and
            make it yours.
          </p>

          <form action={LIBRARY_PATH} method="get" className="mt-8" role="search">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  type="search"
                  defaultValue={params.q ?? ""}
                  placeholder="Airport, city or flight number: CDG, Paris, AF65, CDG to LAX"
                  aria-label="Search flight plans"
                  className="h-12 rounded-full pl-11 text-base"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-full px-6">
                Search
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input name="from" defaultValue={params.from ?? ""} placeholder="From (ICAO/IATA)" aria-label="Departure airport" className="rounded-full" />
              <Input name="to" defaultValue={params.to ?? ""} placeholder="To (ICAO/IATA)" aria-label="Arrival airport" className="rounded-full" />
              <Input name="flight" defaultValue={params.flight ?? ""} placeholder="Flight number" aria-label="Flight number" className="rounded-full" />
              <select
                name="sort"
                defaultValue={sort}
                aria-label="Sort by"
                className="h-[var(--control-h,2.5rem)] rounded-full border border-input bg-background px-3 text-sm"
              >
                {SORTS.map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            {(filtered || sort !== "popular") && (
              <p className="mt-3 text-sm">
                <Link href={LIBRARY_PATH} className="text-muted-foreground underline underline-offset-2">
                  Clear filters
                </Link>
              </p>
            )}
          </form>
        </header>

        {plans.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-card px-6 py-14 text-center ring-1 ring-border">
            <h2 className="font-display text-xl font-semibold">
              {filtered ? "No flight plans match your search" : "No flight plans here yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {filtered
                ? "Try an airport code, a city name or a flight number, or clear the filters."
                : "Be the first: export a flight plan from Convert or Sketch and make it public from your dashboard."}
            </p>
            {filtered && (
              <Button asChild variant="outline" className="mt-5 rounded-full">
                <Link href={LIBRARY_PATH} className="no-underline">
                  Clear filters
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            {featured?.node && <section className="mt-10" aria-label="Featured">{featured.node}</section>}

            {latestPlans.length > 0 && (
              <section className="mt-16" aria-labelledby="latest">
                <SectionHeading id="latest">Latest</SectionHeading>
                <PlanGrid plans={latestPlans} />
              </section>
            )}

            {rest.length > 0 && (
              <section className="mt-16" aria-labelledby="all">
                <SectionHeading id="all">
                  {front ? "More flight plans" : filtered ? "Results" : SORT_LABELS[sort]}
                </SectionHeading>
                <PlanGrid plans={rest} />
              </section>
            )}

            {nextHref && (
              <div className="mt-12 text-center">
                <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                  <Link href={nextHref} rel="next" className="no-underline">
                    Show more
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
