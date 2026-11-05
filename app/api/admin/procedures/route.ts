import { z } from "zod"
import { getActiveAdmin } from "@/lib/admin/auth"
import { isSameOrigin, isUuid, json } from "@/lib/flight-plan-server"
import { airportFor } from "@/lib/procedure-analysis"
import { allowAction } from "@/lib/rate-limit"
import { findRunwayEnd } from "@/lib/runway-guide"

// The small actions of the Procedures section: mark a direction "not needed" or a whole kind "done", remove one row, and remove a procedure a member saved.
// Each one runs a database function that checks is_admin() itself.
export const dynamic = "force-dynamic"

const KEY = /^((arrival|departure)\|\d{2}[LRC]?\|(N|NE|E|SE|S|SW|W|NW)|done\|(arrival|departure))$/
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark"), airport: z.string().regex(/^[A-Z]{4}$/), key: z.string().regex(KEY), on: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string() }),
  // A procedure a member saved from their own plan (runway_guides).
  z.object({ action: z.literal("deleteGuide"), id: z.string() }),
  // Correct a member's procedure: its runway, direction and (when the runway changes) its path in the new runway's frame.
  z.object({
    action: z.literal("updateGuide"),
    id: z.string(),
    airport: z.string().regex(/^[A-Z]{4}$/),
    runway: z.string().regex(/^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$/),
    bearing: z.number().int().min(0).max(359),
    points: z.array(z.tuple([z.number().min(-80000).max(80000), z.number().min(-80000).max(80000), z.number().min(-1000).max(60000)])).min(3).max(60),
  }),
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
  } else if (body.action === "updateGuide") {
    if (!isUuid(body.id)) return json({ error: "Invalid request." }, 400)
    // The heading comes from the airport data here, never from the browser.
    const airport = airportFor(body.airport)
    const end = airport ? findRunwayEnd(airport, body.runway) : null
    if (!end) return json({ error: `${body.runway} is not a runway of ${body.airport}.` }, 400)
    const { error } = await admin.supabase.rpc("admin_update_runway_guide", {
      p_id: body.id,
      p_runway_name: body.runway,
      p_runway_heading: Math.round(end.headingTrue) % 360,
      p_toc_bearing: body.bearing,
      p_points: body.points.map(([along, across, altitude]) => [Math.round(along), Math.round(across), Math.round(altitude)]),
    })
    if (error) return json({ error: error.message.includes("duplicate_guide") ? "The member already has this procedure saved." : "Could not be saved." }, error.message.includes("duplicate_guide") ? 409 : 500)
  } else if (body.action === "deleteGuide") {
    if (!isUuid(body.id)) return json({ error: "Invalid request." }, 400)
    const { error } = await admin.supabase.rpc("admin_delete_runway_guide", { p_id: body.id })
    if (error) return json({ error: "Could not be removed." }, 500)
  } else {
    if (!isUuid(body.id)) return json({ error: "Invalid request." }, 400)
    const { error } = await admin.supabase.rpc("admin_delete_procedure_flight", { p_id: body.id })
    if (error) return json({ error: "Could not be removed." }, 500)
  }
  return json({ ok: true })
}
