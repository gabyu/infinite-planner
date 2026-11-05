import { z } from "zod"
import { getActiveAdmin } from "@/lib/admin/auth"
import { isSameOrigin, json, RUNWAY_PATTERN } from "@/lib/flight-plan-server"
import { airportFor } from "@/lib/procedure-analysis"
import { allowAction } from "@/lib/rate-limit"
import { findRunwayEnd } from "@/lib/runway-guide"

// The second half of an import: saves the procedures the admin reviewed (see /analyze), with the runway and the direction they
// chose. The rows come back from the browser, so every field is checked here and again by the database (CHECK constraints and
// admin_add_procedure_flights, which verifies is_admin() itself).
export const dynamic = "force-dynamic"

const rowSchema = z.object({
  airport: z.string().regex(/^[A-Z]{4}$/),
  kind: z.enum(["arrival", "departure"]),
  runway: z.string().regex(RUNWAY_PATTERN).nullable(),
  needs_check: z.boolean(),
  route: z.string().regex(/^[A-Z?]{4}-[A-Z?]{4}$/),
  bearing: z.number().int().min(0).max(359).nullable(),
  turn_nm: z.number().int().min(0).max(2000).nullable(),
  established_nm: z.number().min(0).max(99.9).nullable(),
  alt_profile: z.record(z.string().regex(/^\d{1,3}$/), z.number().min(-1000).max(60000)),
  track: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-1000).max(60000)])).min(2).max(140),
  flags: z.array(z.string().max(120)).max(10),
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
})
const bodySchema = z.object({ rows: z.array(rowSchema).min(1).max(100) })

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden." }, 403)
  const admin = await getActiveAdmin()
  if (!admin) return json({ error: "Forbidden." }, 403)
  if (!allowAction(admin.user.id, 60)) return json({ error: "Too many requests. Wait a minute." }, 429)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Invalid request." }, 400)

  // A runway the admin picked must exist at that airport.
  for (const row of parsed.data.rows) {
    const airport = airportFor(row.airport)
    if (!airport || (row.runway && !findRunwayEnd(airport, row.runway))) return json({ error: `${row.runway ?? "That runway"} is not a runway of ${row.airport}.` }, 400)
  }

  // One row per call, so each answer says exactly what happened to that row (the function only counts what it added).
  const results: { content_hash: string; airport: string; added: boolean; error?: string }[] = []
  for (const row of parsed.data.rows) {
    const { data, error } = await admin.supabase.rpc("admin_add_procedure_flights", { p_rows: [row] })
    if (error) {
      results.push({ content_hash: row.content_hash, airport: row.airport, added: false, error: error.message.includes("too_many_rows") ? "The database is full." : "Could not be saved." })
      continue
    }
    const added = ((data as { added?: number } | null)?.added ?? 0) > 0
    results.push({ content_hash: row.content_hash, airport: row.airport, added, ...(added ? {} : { error: "Already in the database." }) })
  }
  return json({ results })
}
