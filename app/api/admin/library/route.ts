import { revalidateTag } from "next/cache"
import { z } from "zod"
import { getActiveAdmin } from "@/lib/admin/auth"
import { isUuid, json, isSameOrigin } from "@/lib/flight-plan-server"

// The moderation actions of the admin Routes section. Each one runs a database function that checks is_admin()
// itself; the cached pages and listings of the plan concerned are dropped at once.
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("moderate"), planId: z.string(), status: z.enum(["ok", "hidden"]) }),
  z.object({ action: z.literal("resolve"), reportId: z.string(), hide: z.boolean() }),
  z.object({ action: z.literal("block"), userId: z.string(), blocked: z.boolean() }),
])

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden." }, 403)
  const admin = await getActiveAdmin()
  if (!admin) return json({ error: "Forbidden." }, 403)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Invalid request." }, 400)
  const body = parsed.data
  const { supabase } = admin

  if (body.action === "moderate") {
    if (!isUuid(body.planId)) return json({ error: "Invalid request." }, 400)
    const { data, error } = await supabase.rpc("admin_set_plan_moderation", { p_plan_id: body.planId, p_status: body.status })
    if (error) return fail(error)
    if (typeof data === "string") revalidateTag(`plan:${data}`)
  } else if (body.action === "resolve") {
    if (!isUuid(body.reportId)) return json({ error: "Invalid request." }, 400)
    const { data, error } = await supabase.rpc("admin_resolve_report", { p_report_id: body.reportId, p_hide: body.hide })
    if (error) return fail(error)
    if (body.hide && typeof data === "string") revalidateTag(`plan:${data}`)
  } else {
    if (!isUuid(body.userId)) return json({ error: "Invalid request." }, 400)
    const { error } = await supabase.rpc("admin_set_publishing_blocked", { p_user_id: body.userId, p_blocked: body.blocked })
    if (error) return fail(error)
  }

  revalidateTag("library-index")
  return json({ ok: true })
}

function fail(error: { message: string }) {
  console.error("Admin library action failed:", error.message)
  return json({ error: "That didn't work. Please try again." }, 500)
}
