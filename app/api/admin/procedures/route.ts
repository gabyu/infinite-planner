import { z } from "zod"
import { getActiveAdmin } from "@/lib/admin/auth"
import { isSameOrigin, isUuid, json } from "@/lib/flight-plan-server"
import { allowAction } from "@/lib/rate-limit"

// The small actions of the Procedures section: mark a direction "not needed" or a whole kind "done", and remove one row.
// Each one runs a database function that checks is_admin() itself.
export const dynamic = "force-dynamic"

const KEY = /^((arrival|departure)\|\d{2}\|(N|NE|E|SE|S|SW|W|NW)|done\|(arrival|departure))$/
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark"), airport: z.string().regex(/^[A-Z]{4}$/), key: z.string().regex(KEY), on: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string() }),
])

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden." }, 403)
  const admin = await getActiveAdmin()
  if (!admin) return json({ error: "Forbidden." }, 403)
  if (!allowAction(admin.user.id, 300)) return json({ error: "Too many requests. Wait a minute." }, 429)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Invalid request." }, 400)
  const body = parsed.data

  if (body.action === "mark") {
    const { error } = await admin.supabase.rpc("admin_set_procedure_mark", { p_airport: body.airport, p_key: body.key, p_on: body.on })
    if (error) return json({ error: "Could not be saved." }, 500)
  } else {
    if (!isUuid(body.id)) return json({ error: "Invalid request." }, 400)
    const { error } = await admin.supabase.rpc("admin_delete_procedure_flight", { p_id: body.id })
    if (error) return json({ error: "Could not be removed." }, 500)
  }
  return json({ ok: true })
}
