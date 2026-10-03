import { isUuid, json, requireUser } from "@/lib/flight-plan-server"
import { MAX_FLIGHT_PLANS_PER_USER } from "@/lib/flight-plans"

// Copies an EXPORTED plan into a new draft: same waypoints, same branding choice, same flight
// time, but a fresh created_at, status 'draft' and never shared (share_token and the download
// counter are left to their defaults, so the copy never inherits the original's link).
// Drafts can't be duplicated: they are still editable.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { supabase, user } = auth

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { data: original } = await supabase
    .from("flight_plans")
    .select(
      "status, source, flight_number, origin_airport, destination_airport, origin_airport_name, destination_airport_name, waypoints, includes_branding, flight_time_minutes",
    )
    .eq("id", params.id)
    .maybeSingle()
  if (!original) return json({ error: "Flight plan not found." }, 404)
  if (original.status !== "exported") {
    return json({ error: "Only exported flight plans can be duplicated. Drafts can be edited." }, 409)
  }

  const { count } = await supabase.from("flight_plans").select("id", { count: "exact", head: true })
  if ((count ?? 0) >= MAX_FLIGHT_PLANS_PER_USER) {
    return json({ error: `Your dashboard is full (${MAX_FLIGHT_PLANS_PER_USER} flight plans). Delete some to save more.` }, 409)
  }

  const { data, error } = await supabase
    .from("flight_plans")
    .insert({ ...original, status: "draft", user_id: user.id })
    .select("id")
    .single()

  if (error || !data) {
    console.error("Duplicating a flight plan failed:", error?.message)
    return json({ error: "Couldn't duplicate the flight plan." }, 500)
  }

  return json({ id: data.id }, 201)
}
