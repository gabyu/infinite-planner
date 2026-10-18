import { isUuid, json, requireUser } from "@/lib/flight-plan-server"

// Records that the owner of an Imported plan (a file that doesn't come from a tracker we recognise) declared the right to
// share it. Asked the first time they publish that plan; the database refuses to publish it without. `id` is the plan's id.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { error } = await auth.supabase.rpc("declare_import_rights", { p_plan_id: params.id })
  if (error) {
    if (error.message.includes("plan_not_found")) return json({ error: "Flight plan not found." }, 404)
    console.error("Recording the declaration failed:", error.message)
    return json({ error: "Couldn't save your choice. Please try again." }, 500)
  }
  return json({ ok: true })
}
