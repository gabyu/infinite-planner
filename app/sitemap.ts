import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"
import { getLibraryLaunched } from "@/lib/library"
import { LIBRARY_PATH } from "@/lib/brand"
import { flightNumberPath, locationPath, planPath } from "@/lib/plan-slug"
import { PAGES, absoluteUrl } from "@/lib/seo"
import { SITE_URL } from "@/lib/site-url"
import { getCachedServiceRoleSupabase } from "@/lib/supabase/admin"

// The library's public pages. Refreshed hourly and whenever a plan is published or unpublished
// (tag `library-index`) or the library is launched (tag `library`). Before the launch it lists the site's
// own pages only: nothing from the library may be discoverable.
export const revalidate = 3600

interface Stub {
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  published_at: string | null
}

const loadStubs = unstable_cache(
  async (): Promise<Stub[]> => {
    const service = getCachedServiceRoleSupabase(["library-index", "library"])
    if (!service) return []
    const { data, error } = await service.rpc("list_public_plan_stubs")
    if (error) throw new Error(`Listing public plans for the sitemap failed: ${error.message}`)
    return (data as Stub[] | null) ?? []
  },
  ["sitemap-plan-stubs"],
  { tags: ["library-index", "library"], revalidate: 3600 },
)

// Every indexable page of the registry. The library's front page is listed with the library's pages below,
// and only once it is launched.
const staticPages: MetadataRoute.Sitemap = Object.values(PAGES)
  .filter((page) => page.indexable && page.path !== LIBRARY_PATH)
  .map((page) => ({ url: absoluteUrl(page.path) }))

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await getLibraryLaunched())) return staticPages
  const stubs = await loadStubs()
  if (stubs.length === 0) return staticPages

  // The library's front page and the hubs that have at least one public plan.
  const routes = new Set(stubs.map((stub) => `${stub.origin_airport}-${stub.destination_airport}`))
  const airports = new Set(stubs.flatMap((stub) => [stub.origin_airport, stub.destination_airport]))
  const flights = new Set(stubs.flatMap((stub) => (stub.flight_number ? [stub.flight_number] : [])))
  const hubs: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}${LIBRARY_PATH}` },
    ...[...routes].map((route) => ({ url: `${SITE_URL}/explore/routes/${route.toLowerCase()}` })),
    ...[...airports].map((icao) => ({ url: `${SITE_URL}${locationPath(icao)}` })),
    ...[...flights].map((flight) => ({ url: `${SITE_URL}${flightNumberPath(flight)}` })),
  ]

  return [...staticPages, ...hubs, ...stubs.map((stub) => ({
    url: `${SITE_URL}${planPath({
      origin: stub.origin_airport,
      destination: stub.destination_airport,
      flightNumber: stub.flight_number,
      publicId: stub.public_id,
    })}`,
    lastModified: stub.published_at ?? undefined,
  }))]
}
