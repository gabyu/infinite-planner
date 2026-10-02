import { flightPlanBodySchema, flightPlanColumns, isUuid, json, requireUser } from "@/lib/flight-plan-server"

// Saves the same plan again (the author exported it a second time after changing it).
// RLS only lets the owner see the row, so someone else's id looks like a missing one.
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
    .select("id, created_at")
    .maybeSingle()

  if (error) {
    console.error("Updating a flight plan failed:", error.message)
    return json({ error: "Couldn't save the flight plan." }, 500)
  }
  if (!data) return json({ error: "Flight plan not found." }, 404)

  return json({ id: data.id, createdAt: data.created_at })
}
