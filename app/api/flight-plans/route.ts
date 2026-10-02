import { flightPlanBodySchema, flightPlanColumns, json, requireUser } from "@/lib/flight-plan-server"
import { MAX_FLIGHT_PLANS_PER_USER } from "@/lib/flight-plans"

// Saves a new flight plan for the signed-in user. Called when they export from Convert or Sketch.
export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { supabase, user } = auth

  const parsed = flightPlanBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid flight plan." }, 400)
  }

  const { count } = await supabase.from("flight_plans").select("id", { count: "exact", head: true })
  if ((count ?? 0) >= MAX_FLIGHT_PLANS_PER_USER) {
    return json({ error: `Your history is full (${MAX_FLIGHT_PLANS_PER_USER} flight plans). Delete some to save more.` }, 409)
  }

  const { data, error } = await supabase
    .from("flight_plans")
    .insert({ user_id: user.id, source: parsed.data.source, ...flightPlanColumns(parsed.data) })
    .select("id, created_at")
    .single()

  if (error || !data) {
    console.error("Saving a flight plan failed:", error?.message)
    return json({ error: "Couldn't save the flight plan." }, 500)
  }

  return json({ id: data.id, createdAt: data.created_at }, 201)
}
