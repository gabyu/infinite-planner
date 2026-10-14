import "server-only"
import { unstable_cache } from "next/cache"
import { findAirportByCode, searchAirports } from "@/lib/airports"
import { FLIGHT_PLAN_SOURCES, type FlightPlanSource } from "@/lib/flight-plans"
import { getCachedServiceRoleSupabase } from "@/lib/supabase/admin"

// The library's listing: what /explore, the route and airport hubs and a plan's "more like this" show.
// Reads go through list_public_plans (service role) and the data cache: tagged `library-index`, which a
// publish, unpublish, delete or moderation action drops, and `library`, which the launch switch drops.

export const SORTS = ["popular", "latest", "imported", "downloaded", "liked"] as const
export type Sort = (typeof SORTS)[number]
export const SORT_LABELS: Record<Sort, string> = {
  popular: "Popular",
  latest: "Latest",
  imported: "Most imported",
  downloaded: "Most downloaded",
  liked: "Most liked",
}

export const PAGE_SIZE = 24

export interface PlanCardData {
  id: string
  publicId: string
  origin: string
  destination: string
  flightNumber: string | null
  source: FlightPlanSource
  distanceNm: number
  flightTimeMinutes: number | null
  likeCount: number
  importCount: number
  downloadCount: number
  publishedAt: string | null
  authorName: string
  authorAvatarUrl: string | null
  authorPublicId: string
  route: { lat: number; lng: number }[]
  sortValue: number
  featured: boolean
}

export interface ListFilters {
  origins?: string[]
  destinations?: string[]
  airports?: string[]
  flight?: string
  source?: FlightPlanSource
  authorPublicId?: string
  excludePublicId?: string
  // Only the plans their author features on their profile.
  featuredOnly?: boolean
}

export interface Cursor {
  v: number
  id: string
  asOf: string
}

export interface ListResult {
  plans: PlanCardData[]
  next: Cursor | null
}

interface Row {
  id: string
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  source: FlightPlanSource
  distance_nm: number | null
  flight_time_minutes: number | null
  like_count: number
  import_count: number
  download_count: number
  published_at: string | null
  author_name: string | null
  author_avatar_url: string | null
  author_public_id: string
  route: { lat: number; lng: number }[] | null
  sort_value: number
  featured: boolean
}

const ADMIN_AUTHOR_NAME = "Infinite Planner admin"

async function load(args: {
  sort: Sort
  filters: ListFilters
  cursor: Cursor | null
  asOf: string
  limit: number
}): Promise<ListResult> {
  const service = getCachedServiceRoleSupabase(["library-index", "library"])
  if (!service) return { plans: [], next: null }
  const { sort, filters, cursor, asOf, limit } = args

  const { data, error } = await service.rpc("list_public_plans", {
    p_sort: sort,
    p_origins: filters.origins ?? null,
    p_destinations: filters.destinations ?? null,
    p_airports: filters.airports ?? null,
    p_flight: filters.flight ?? null,
    p_source: filters.source ?? null,
    p_author_public_id: filters.authorPublicId ?? null,
    p_exclude_public_id: filters.excludePublicId ?? null,
    p_as_of: asOf,
    p_after_value: cursor?.v ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: limit + 1,
    p_featured_only: filters.featuredOnly ?? false,
  })
  // Thrown, so a failed read is never cached as an empty library.
  if (error) throw new Error(`Listing public plans failed: ${error.message}`)

  const rows = (data as Row[] | null) ?? []
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  return {
    plans: page.map((row) => ({
      id: row.id,
      publicId: row.public_id,
      origin: row.origin_airport,
      destination: row.destination_airport,
      flightNumber: row.flight_number,
      source: row.source,
      distanceNm: row.distance_nm ?? 0,
      flightTimeMinutes: row.flight_time_minutes,
      likeCount: row.like_count,
      importCount: row.import_count,
      downloadCount: row.download_count,
      publishedAt: row.published_at,
      authorName: row.author_name || ADMIN_AUTHOR_NAME,
      authorAvatarUrl: row.author_avatar_url,
      authorPublicId: row.author_public_id,
      route: row.route ?? [],
      sortValue: row.sort_value,
      featured: row.featured,
    })),
    next: rows.length > limit && last ? { v: last.sort_value, id: last.id, asOf } : null,
  }
}

// One page of public plans. `asOf` is frozen on the first page and carried in the cursor so the popularity
// order stays put while someone pages through. It is rounded to the minute so equal requests share a cache entry.
export function listPlans(args: {
  sort?: Sort
  filters?: ListFilters
  cursor?: Cursor | null
  limit?: number
}): Promise<ListResult> {
  const sort = args.sort ?? "popular"
  const filters = args.filters ?? {}
  const cursor = args.cursor ?? null
  const limit = args.limit ?? PAGE_SIZE
  const asOf = cursor?.asOf ?? new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()
  const key = JSON.stringify({ sort, filters, cursor, asOf, limit })
  return unstable_cache(() => load({ sort, filters, cursor, asOf, limit }), ["library-list", key], {
    tags: ["library-index", "library"],
    revalidate: 60,
  })()
}

// --- Cursors and query strings -------------------------------------------------------------------

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url")
}

export function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (
      typeof parsed?.v === "number" &&
      Number.isFinite(parsed.v) &&
      typeof parsed.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(parsed.id) &&
      typeof parsed.asOf === "string" &&
      !Number.isNaN(Date.parse(parsed.asOf))
    ) {
      return { v: parsed.v, id: parsed.id, asOf: new Date(parsed.asOf).toISOString() }
    }
  } catch {
    // A mangled cursor is the first page.
  }
  return null
}

export interface ExploreParams {
  q?: string
  from?: string
  to?: string
  flight?: string
  source?: string
  sort?: string
  cursor?: string
}

const FLIGHT_PATTERN = /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/

// An exact code, else the airports whose city or name matches.
function airportsFor(text: string): string[] {
  const exact = findAirportByCode(text)
  return exact ? [exact.icao] : searchAirports(text, 8).map((match) => match.icao)
}

// "CDG", "LFPG", "Paris", "AF65", "CDG LAX", "CDG to LAX" -> what to filter on. Two airport tokens read as
// origin then destination; one airport, or a city, matches either end; something shaped like a flight
// number is a flight number.
export function filtersFromQuery(rawQuery: string): ListFilters {
  const q = rawQuery.trim().slice(0, 80)
  if (!q) return {}
  const upper = q.toUpperCase().replace(/\s+/g, "")
  if (FLIGHT_PATTERN.test(upper) && !findAirportByCode(upper)) return { flight: upper }

  // "Paris to Tokyo", "CDG → LAX": an explicit separator splits origin from destination, and each side can be
  // a code or a place name. "CDG LAX" and "LFPG-KLAX" only count when both sides are codes (a name can
  // contain spaces and hyphens).
  const explicit = q.split(/\s+(?:to|→|->)\s+|\s*(?:→|->)\s*/i).filter(Boolean)
  if (explicit.length === 2) {
    const origins = airportsFor(explicit[0])
    const destinations = airportsFor(explicit[1])
    if (origins.length && destinations.length) return { origins, destinations }
  }
  const codes = q.split(/\s*-\s*|\s+/).filter(Boolean)
  if (codes.length === 2) {
    const a = findAirportByCode(codes[0])
    const b = findAirportByCode(codes[1])
    if (a && b) return { origins: [a.icao], destinations: [b.icao] }
  }
  const exact = findAirportByCode(q)
  if (exact) return { airports: [exact.icao] }

  const matches = searchAirports(q, 8).map((match) => match.icao)
  // Nothing matched: an impossible code, so the page says "no results" instead of listing everything.
  return { airports: matches.length ? matches : ["ZZZZ"] }
}

// The filters the explicit fields add on top of the search box.
export function filtersFromParams(params: ExploreParams): ListFilters {
  const filters: ListFilters = filtersFromQuery(params.q ?? "")
  const from = params.from ? findAirportByCode(params.from) : null
  const to = params.to ? findAirportByCode(params.to) : null
  if (params.from) filters.origins = [from?.icao ?? "ZZZZ"]
  if (params.to) filters.destinations = [to?.icao ?? "ZZZZ"]
  const flight = params.flight?.trim().toUpperCase()
  if (flight && /^[A-Z0-9]{1,12}$/.test(flight)) filters.flight = flight
  if (params.source && (FLIGHT_PLAN_SOURCES as readonly string[]).includes(params.source)) {
    filters.source = params.source as FlightPlanSource
  }
  return filters
}

export function sortFromParam(value: string | undefined): Sort {
  return (SORTS as readonly string[]).includes(value ?? "") ? (value as Sort) : "popular"
}
