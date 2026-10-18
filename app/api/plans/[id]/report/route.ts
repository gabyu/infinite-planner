import { z } from "zod"
import { legalCopy } from "@/lib/copy"
import { json, requireLibraryUser } from "@/lib/flight-plan-server"
import { isPublicId } from "@/lib/plan-slug"

const bodySchema = z.object({
  reason: z.enum(["inappropriate", "copyright", "wrong_data", "spam", "other"]),
  details: z.string().max(500).optional(),
  // The page the report was made from (its path, no query), kept with the report.
  pageUrl: z.string().max(300).optional(),
})

// Reports a plan of the library to the admins. One open report per person and plan (a repeat is accepted
// and ignored). `id` is the plan's PUBLIC id.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireLibraryUser(request)
  if (auth.error) return auth.error
  if (!isPublicId(params.id)) return json({ error: "Flight plan not found." }, 404)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Choose a reason." }, 400)

  const { error } = await auth.supabase.rpc("report_flight_plan", {
    p_public_id: params.id,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? null,
    p_page_url: parsed.data.pageUrl ?? null,
  })
  if (error) {
    if (error.message.includes("plan_not_found")) return json({ error: "Flight plan not found." }, 404)
    if (error.message.includes("own_plan")) return json({ error: legalCopy.reportOwnPlan }, 409)
    console.error("Reporting a plan failed:", error.message)
    return json({ error: legalCopy.reportError }, 500)
  }
  return json({ ok: true })
}
