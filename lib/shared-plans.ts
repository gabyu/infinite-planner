import "server-only"
import { UUID_PATTERN, type FlightPlanSource, type StoredWaypoint } from "@/lib/flight-plans"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"

// The public side of sharing. There is deliberately no RLS policy that lets anyone read a
// flight plan: these two functions are the only way in, they run on the server with the
// service role, and they only ever look a row up by its (non-null) share token.

// What the public page may show. No user_id and no download counter: a link doesn't reveal
// who made the plan, and the counter isn't surfaced anywhere yet.
export interface SharedFlightPlan {
  source: FlightPlanSource
  flightNumber: string | null
  origin: string
  destination: string
  originName: string | null
  destinationName: string | null
  flightTimeMinutes: number | null
  waypoints: StoredWaypoint[]
}

export function isShareToken(value: string) {
  return UUID_PATTERN.test(value)
}

// Looks a plan up for display. Does not count as a download. null for a token that doesn't
// exist or was revoked (share_token cleared), so a stopped link fails immediately.
export async function getSharedPlan(token: string): Promise<SharedFlightPlan | null> {
  if (!isShareToken(token)) return null
  const service = getServiceRoleSupabase()
  if (!service) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set: shared flight plans can't be served.")
    return null
  }

  const { data, error } = await service
    .from("flight_plans")
    .select(
      "source, flight_number, origin_airport, destination_airport, origin_airport_name, destination_airport_name, flight_time_minutes, waypoints",
    )
    .eq("share_token", token)
    .maybeSingle()

  if (error) console.error("Loading a shared flight plan failed:", error.message)
  if (!data) return null

  return {
    source: data.source,
    flightNumber: data.flight_number,
    origin: data.origin_airport,
    destination: data.destination_airport,
    originName: data.origin_airport_name,
    destinationName: data.destination_airport_name,
    flightTimeMinutes: data.flight_time_minutes,
    waypoints: data.waypoints as StoredWaypoint[],
  }
}

// Returns what the file needs and counts the download, in one atomic statement
// (record_shared_download). null for an unknown or revoked token.
export async function takeSharedDownload(token: string) {
  if (!isShareToken(token)) return null
  const service = getServiceRoleSupabase()
  if (!service) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set: shared flight plans can't be served.")
    return null
  }

  const { data, error } = await service.rpc("record_shared_download", { p_token: token })
  if (error) console.error("Recording a shared download failed:", error.message)

  const row = (
    data as { origin_airport: string; destination_airport: string; waypoints: StoredWaypoint[] }[] | null
  )?.[0]
  return row ?? null
}
