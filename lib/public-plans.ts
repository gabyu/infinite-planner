import "server-only"
import { unstable_cache } from "next/cache"
import { isPublicId } from "@/lib/plan-slug"
import type { FlightPlanSource, StoredWaypoint } from "@/lib/flight-plans"
import { getCachedServiceRoleSupabase, getServiceRoleSupabase } from "@/lib/supabase/admin"

// The public side of the library: one plan by its public id. No RLS policy lets anyone read a
// flight plan; get_public_plan (service role only) is the way in, and it never returns user_id.

export type SharedVisibility = "public"

export interface PublicPlan {
  publicId: string
  visibility: SharedVisibility
  publishedAt: string | null
  // Time of the export (UTC): "Generated on".
  createdAt: string
  source: FlightPlanSource
  flightNumber: string | null
  origin: string
  destination: string
  originName: string | null
  destinationName: string | null
  flightTimeMinutes: number | null
  includesBranding: boolean
  waypoints: StoredWaypoint[]
  distanceNm: number
  maxAltitudeFt: number
  likeCount: number
  importCount: number
  downloadCount: number
  // Never empty: an account without a Discord name (an admin) shows as ADMIN_AUTHOR_NAME.
  authorName: string
  authorAvatarUrl: string | null
  authorPublicId: string
}

const ADMIN_AUTHOR_NAME = "Infinite Planner admin"

interface PlanRow {
  public_id: string
  visibility: SharedVisibility
  published_at: string | null
  created_at: string
  source: FlightPlanSource
  flight_number: string | null
  origin_airport: string
  destination_airport: string
  origin_airport_name: string | null
  destination_airport_name: string | null
  flight_time_minutes: number | null
  includes_branding: boolean
  waypoints: StoredWaypoint[]
  distance_nm: number | null
  max_altitude_ft: number | null
  like_count: number
  import_count: number
  download_count: number
  author_name: string | null
  author_avatar_url: string | null
  author_public_id: string
}

function fromRow(row: PlanRow): PublicPlan {
  return {
    publicId: row.public_id,
    visibility: row.visibility,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    source: row.source,
    flightNumber: row.flight_number,
    origin: row.origin_airport,
    destination: row.destination_airport,
    originName: row.origin_airport_name,
    destinationName: row.destination_airport_name,
    flightTimeMinutes: row.flight_time_minutes,
    includesBranding: row.includes_branding,
    waypoints: row.waypoints,
    distanceNm: row.distance_nm ?? 0,
    maxAltitudeFt: row.max_altitude_ft ?? 0,
    likeCount: row.like_count,
    importCount: row.import_count,
    downloadCount: row.download_count,
    authorName: row.author_name || ADMIN_AUTHOR_NAME,
    authorAvatarUrl: row.author_avatar_url,
    authorPublicId: row.author_public_id,
  }
}

async function loadPublicPlan(publicId: string, service: ReturnType<typeof getServiceRoleSupabase>): Promise<PublicPlan | null> {
  if (!service) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set: flight plan pages can't be served.")
    return null
  }
  const { data, error } = await service.rpc("get_public_plan", { p_public_id: publicId })
  // Thrown, not turned into "not found": a failed lookup must never be cached as a 404.
  if (error) throw new Error(`Loading a public flight plan failed: ${error.message}`)
  const row = (data as PlanRow[] | null)?.[0]
  return row ? fromRow(row) : null
}

// Looked up through the data cache, tagged so a visibility change, a delete, a moderation action
// or an edit can drop it at once (revalidateTag(`plan:${publicId}`)). `library` is the global tag
// the launch switch flips. A missing plan is cached too (briefly), so a crawler hammering unknown
// ids doesn't reach the database every time.
export function getPublicPlan(publicId: string): Promise<PublicPlan | null> {
  if (!isPublicId(publicId)) return Promise.resolve(null)
  return unstable_cache(
    () => loadPublicPlan(publicId, getCachedServiceRoleSupabase([`plan:${publicId}`, "library"])),
    ["public-plan", publicId],
    {
      tags: [`plan:${publicId}`, "library"],
      revalidate: 300,
    },
  )()
}

// Same lookup, never cached: for the download route, which must see an unpublish at once.
export function getPublicPlanLive(publicId: string): Promise<PublicPlan | null> {
  if (!isPublicId(publicId)) return Promise.resolve(null)
  return loadPublicPlan(publicId, getServiceRoleSupabase())
}
