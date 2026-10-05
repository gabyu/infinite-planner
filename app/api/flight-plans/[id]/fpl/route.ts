import { generateFPL, fplFileName } from "@/lib/fpl-generator"
import { isUuid, json, requireUser } from "@/lib/flight-plan-server"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Download again from the dashboard: rebuilds the .fpl from the saved waypoints. Owner only (RLS).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { data } = await auth.supabase
    .from("flight_plans")
    .select("status, origin_airport, destination_airport, waypoints")
    .eq("id", params.id)
    .maybeSingle()
  if (!data) return json({ error: "Flight plan not found." }, 404)
  // Exporting is what locks a plan, so a draft is downloaded through the editor's Export, not here.
  if (data.status !== "exported") return json({ error: "Export the draft from the editor first." }, 409)

  return new Response(generateFPL(data.waypoints as StoredWaypoint[]), {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${fplFileName(data.origin_airport, data.destination_airport)}"`,
      "Cache-Control": "no-store",
    },
  })
}
