import {
  flightPlanBodySchema,
  flightPlanColumns,
  isLockedError,
  isUuid,
  json,
  LOCKED_MESSAGE,
  requireUser,
} from "@/lib/flight-plan-server"

// A flight plan of the signed-in user, in full (waypoints included): used to reopen a draft in
// Convert/Sketch and to view a plan from the dashboard. RLS only lets the owner see the row, so
// someone else's id looks like a missing one.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { data } = await auth.supabase
    .from("flight_plans")
    .select(
      "id, status, source, created_at, flight_number, origin_airport, destination_airport, origin_airport_name, destination_airport_name, waypoints, includes_branding, flight_time_minutes, share_token",
    )
    .eq("id", params.id)
    .maybeSingle()
  if (!data) return json({ error: "Flight plan not found." }, 404)

  return json(data)
}

// Saves the plan again: an autosave of a draft, or the export that locks it. An exported plan
// can't be changed any more (409).
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { supabase } = auth

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const parsed = flightPlanBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid flight plan." }, 400)
  }

  const { data, error } = await supabase
    .from("flight_plans")
    .update(flightPlanColumns(parsed.data))
    .eq("id", params.id)
    .select("id, status, created_at")
    .maybeSingle()

  if (isLockedError(error)) return json({ error: LOCKED_MESSAGE, code: "locked" }, 409)
  if (error) {
    console.error("Updating a flight plan failed:", error.message)
    return json({ error: "Couldn't save the flight plan." }, 500)
  }
  if (!data) return json({ error: "Flight plan not found." }, 404)

  return json({ id: data.id, status: data.status, createdAt: data.created_at })
}
