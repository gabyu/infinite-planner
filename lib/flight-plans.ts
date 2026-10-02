// Shared (client + server) types and helpers for saved flight plans.
// The table and its access rules: supabase/migrations/20261003000000_flight_plans.sql.

export const FLIGHT_PLAN_SOURCES = ["FlightRadar24", "FlightAware", "Sketch"] as const
export type FlightPlanSource = (typeof FLIGHT_PLAN_SOURCES)[number]

// What is stored in flight_plans.waypoints: just what the FPL needs, never editor state.
export interface StoredWaypoint {
  name: string
  lat: number
  lng: number
  altitude: number // feet
}

// A history row as the History page reads it. `waypoints` is left out of the list query
// (it can be large); a plan's file is rebuilt on the server when it is exported.
export interface FlightPlanSummary {
  id: string
  source: FlightPlanSource
  created_at: string
  flight_number: string | null
  origin_airport: string
  destination_airport: string
  origin_airport_name: string | null
  destination_airport_name: string | null
  includes_branding: boolean
  flight_time_minutes: number | null
  share_token: string | null
}

export const FLIGHT_PLAN_SUMMARY_COLUMNS =
  "id, source, created_at, flight_number, origin_airport, destination_airport, origin_airport_name, destination_airport_name, includes_branding, flight_time_minutes, share_token"

// How many history rows are loaded at a time ("Load more" fetches the next page).
export const HISTORY_PAGE_SIZE = 50

// Anyone can hold on to this many plans; past it, saving asks them to delete some.
// Keeps one account from filling the database (a plan is at most ~200 KB, usually far less).
export const MAX_FLIGHT_PLANS_PER_USER = 500

// The branding block needs the origin, the four MADE/WITH/INFINITE/PLANNER waypoints and
// the destination, so a plan shorter than this can't carry it.
export const BRANDING_MIN_WAYPOINTS = 6
export const BRAND_NAMES = ["MADE", "WITH", "INFINITE", "PLANNER"] as const

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "2h 05m", "45m". Flight time is stored as whole minutes.
export function formatFlightTime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, "0")}m`
}

export function sourceLabel(source: FlightPlanSource): string {
  return source === "Sketch" ? "Route Sketch" : source
}
