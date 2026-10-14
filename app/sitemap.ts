import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"
import { getLibraryLaunched } from "@/lib/library"
import { planPath } from "@/lib/plan-slug"
import { SITE_URL } from "@/lib/site-url"
import { getCachedServiceRoleSupabase } from "@/lib/supabase/admin"

// The library's public pages. Refreshed hourly and whenever a plan is published or unpublished
// (tag `library-index`) or the library is launched (tag `library`). Before the launch it is empty:
// nothing from the library may be discoverable.
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await getLibraryLaunched())) return []
  const stubs = await loadStubs()
  return stubs.map((stub) => ({
    url: `${SITE_URL}${planPath({
      origin: stub.origin_airport,
      destination: stub.destination_airport,
      flightNumber: stub.flight_number,
      publicId: stub.public_id,
    })}`,
    lastModified: stub.published_at ?? undefined,
  }))
}
