import { generateFPL, fplFileName } from "@/lib/fpl-generator"
import { isUuid, json, requireUser } from "@/lib/flight-plan-server"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Re-export from the history: rebuilds the .fpl from the saved waypoints. Owner only (RLS).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { data } = await auth.supabase
    .from("flight_plans")
    .select("origin_airport, destination_airport, waypoints")
    .eq("id", params.id)
    .maybeSingle()
  if (!data) return json({ error: "Flight plan not found." }, 404)

  return new Response(generateFPL(data.waypoints as StoredWaypoint[]), {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${fplFileName(data.origin_airport, data.destination_airport)}"`,
      "Cache-Control": "no-store",
    },
  })
}
