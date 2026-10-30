import { json, requireUser } from "@/lib/flight-plan-server"
import type { StoredWaypoint } from "@/lib/flight-plans"

// How many of the user's latest routes the dashboard map draws, and how many points each keeps.
const MAX_ROUTES = 100
const MAX_POINTS = 60

export interface DashboardRoute {
  origin: string
  destination: string
  /** [lat, lng, altitude in feet], first = departure, last = arrival. */
  path: [number, number, number][]
}

// Every route the signed-in user generated (exported plans), for the dashboard's map tab. Own rows only (RLS).
// Fetched when the tab is opened, not with the page: the waypoints are the heavy part of a plan.
export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error

  const { data, error } = await auth.supabase
    .from("flight_plans")
    .select("origin_airport, destination_airport, waypoints")
    .eq("status", "exported")
    .order("created_at", { ascending: false })
    .limit(MAX_ROUTES * 2)
  if (error) {
    console.error("Loading the dashboard map failed:", error.message)
    return json({ error: "Couldn't load your routes." }, 500)
  }

  // The same flight regenerated several times is drawn once: rows are newest first, so the latest wins.
  const seen = new Set<string>()
  const routes: DashboardRoute[] = []
  for (const row of data as unknown as { origin_airport: string; destination_airport: string; waypoints: StoredWaypoint[] }[]) {
    const pair = `${row.origin_airport}>${row.destination_airport}`
    if (seen.has(pair)) continue
    const points = (Array.isArray(row.waypoints) ? row.waypoints : [])
      .filter((w) => Number.isFinite(w?.lat) && Number.isFinite(w?.lng))
      .map((w) => [Math.round(w.lat * 100) / 100, Math.round(w.lng * 100) / 100, Math.round(w.altitude) || 0] as [number, number, number])
    // Drop stationary repeats (taxi and hold points) so the kept points go to the actual route.
    const moving = points.filter((p, i) => i === 0 || Math.abs(p[0] - points[i - 1][0]) > 0.005 || Math.abs(p[1] - points[i - 1][1]) > 0.005)
    if (moving.length < 2) continue
    seen.add(pair)
    const path =
      moving.length <= MAX_POINTS
        ? moving
        : Array.from({ length: MAX_POINTS }, (_, i) => moving[Math.round((i * (moving.length - 1)) / (MAX_POINTS - 1))])
    routes.push({ origin: row.origin_airport, destination: row.destination_airport, path })
    if (routes.length === MAX_ROUTES) break
  }
  return json({ routes })
}
