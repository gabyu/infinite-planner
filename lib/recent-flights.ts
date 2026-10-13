import "server-only"
import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import type { StoredWaypoint } from "@/lib/flight-plans"

// One flight plan on the homepage globe: the generated route itself, waypoint by waypoint.
// Anonymous by construction: no user id, no share token, no plan id leaves the server.
export interface GlobeFlight {
  origin: string
  destination: string
  originName: string | null
  destinationName: string | null
  createdAt: string // ISO
  /** [lat, lng, altitude in feet], first = departure, last = arrival. */
  path: [number, number, number][]
}

const MAX_POINTS = 90

interface Row {
  origin_airport: string
  destination_airport: string
  origin_airport_name: string | null
  destination_airport_name: string | null
  created_at: string
  waypoints: StoredWaypoint[]
}

// Keeps the first and last waypoint and spreads the rest evenly: a 240-point plan stays smooth
// on the globe and the page payload stays small.
function thin(points: [number, number, number][]) {
  if (points.length <= MAX_POINTS) return points
  const out: [number, number, number][] = []
  for (let i = 0; i < MAX_POINTS; i++) out.push(points[Math.round((i * (points.length - 1)) / (MAX_POINTS - 1))])
  return out
}

async function loadRecentFlights(limit: number): Promise<GlobeFlight[]> {
  try {
    // Not getServiceRoleSupabase(): that client forces no-store fetches, which Next refuses while the
    // homepage is prerendered. This result is cached on purpose, and only anonymous
    // route data leaves this function.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return []
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    // Only plans whose FPL was downloaded ("exported"): finished work, not drafts.
    const { data, error } = await supabase
      .from("flight_plans")
      .select("origin_airport, destination_airport, origin_airport_name, destination_airport_name, created_at, waypoints")
      .eq("status", "exported")
      .order("created_at", { ascending: false })
      .limit(limit * 2)
    if (error || !Array.isArray(data)) return []

    const flights: GlobeFlight[] = []
    for (const row of data as unknown as Row[]) {
      const path = (Array.isArray(row.waypoints) ? row.waypoints : [])
        .filter((w) => Number.isFinite(w?.lat) && Number.isFinite(w?.lng))
        .map((w) => [Math.round(w.lat * 100) / 100, Math.round(w.lng * 100) / 100, Math.round(w.altitude) || 0] as [number, number, number])
      // Drop stationary repeats (taxi/hold points) before thinning, so the 90 points go to actual route.
      const moving = path.filter((p, i) => i === 0 || Math.abs(p[0] - path[i - 1][0]) > 0.005 || Math.abs(p[1] - path[i - 1][1]) > 0.005)
      if (moving.length < 2) continue
      flights.push({
        origin: row.origin_airport,
        destination: row.destination_airport,
        originName: row.origin_airport_name,
        destinationName: row.destination_airport_name,
        createdAt: row.created_at,
        path: thin(moving),
      })
      if (flights.length === limit) break
    }
    return flights
  } catch {
    return []
  }
}

// The latest flight plans, newest first, refreshed at most every hour (homepage). [] on any failure: the
// globe then just turns without routes.
export const getRecentFlights = unstable_cache(loadRecentFlights, ["home-recent-flights"], { revalidate: 3600 })

// Same, refreshed at most every 5 minutes: for the full-screen visualizer, which people leave open.
export const getRecentFlightsLive = unstable_cache(loadRecentFlights, ["visualizer-recent-flights"], { revalidate: 300 })
