import { revalidateTag } from "next/cache"
import { json, requireLibraryUser } from "@/lib/flight-plan-server"
import { isPublicId } from "@/lib/plan-slug"

// Copies a plan of the library into a new draft of the signed-in user (idempotent: a second call
// returns the existing copy). `id` is the plan's PUBLIC id. The copy opens in Convert's map view.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireLibraryUser(request)
  if (auth.error) return auth.error
  if (!isPublicId(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { data, error } = await auth.supabase.rpc("import_flight_plan", { p_public_id: params.id })
  if (error) {
    if (error.message.includes("plan_not_found")) return json({ error: "Flight plan not found." }, 404)
    if (error.message.includes("own_plan")) return json({ error: "This is already your flight plan." }, 409)
    if (error.message.includes("dashboard_full")) return json({ error: "Your dashboard is full. Delete some flight plans first." }, 409)
    console.error("Importing a plan failed:", error.message)
    return json({ error: "Couldn't import this flight plan. Please try again." }, 500)
  }
  const row = (data as { plan_id: string; created: boolean }[] | null)?.[0]
  if (!row) return json({ error: "Couldn't import this flight plan." }, 500)

  // The imports counter is part of the cached page.
  if (row.created) revalidateTag(`plan:${params.id}`)
  return json({ planId: row.plan_id, created: row.created, editPath: `/convert?draft=${row.plan_id}&fork=1` })
}
