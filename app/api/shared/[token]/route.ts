import { json } from "@/lib/flight-plan-server"
import { getSharedPlan } from "@/lib/shared-plans"

// Never cached: a cached response would outlive "Stop sharing".
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Public (no sign-in): the flight plan behind a share link, as JSON. Looked up on the
// server by token, and only while the owner is still sharing it. Never cached: a "Stop
// sharing" has to cut the link off immediately, and a live link serves the current state.
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const plan = await getSharedPlan(params.token)
  if (!plan) return json({ error: "This link isn't available." }, 404)
  return json(plan)
}
