import { getActiveAdmin } from "@/lib/admin/auth"
import { isSameOrigin, json } from "@/lib/flight-plan-server"
import { allowAction } from "@/lib/rate-limit"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"

// Staging only: replaces this environment's airport procedures with production's. One direction: staging reads
// production's export (with the sync token) and never writes there. The database function refuses unless its safety catch
// row exists, which is created by hand on staging only.
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENV !== "staging") return json({ error: "Not available here." }, 404)
  if (!isSameOrigin(request)) return json({ error: "Forbidden." }, 403)
  const admin = await getActiveAdmin()
  if (!admin) return json({ error: "Forbidden." }, 403)
  if (!allowAction(`procedures-copy:${admin.user.id}`, 6)) return json({ error: "Too many requests. Wait a minute." }, 429)

  const base = process.env.PROCEDURES_SYNC_URL
  const token = process.env.PROCEDURES_SYNC_TOKEN
  if (!base || !token) return json({ error: "The copy is not configured on this environment." }, 503)
  let url: URL
  try {
    url = new URL("/api/procedures-sync/export", base)
  } catch {
    return json({ error: "The copy is not configured on this environment." }, 503)
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV !== "development") return json({ error: "The copy is not configured on this environment." }, 503)

  let data: unknown
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) })
    if (response.status === 507) return json({ error: "Production's data is too large for one copy." }, 502)
    if (!response.ok) return json({ error: `Production refused the copy (${response.status}).` }, 502)
    data = await response.json()
  } catch {
    return json({ error: "Could not reach production." }, 502)
  }
  const shape = data as { flights?: unknown; marks?: unknown } | null
  if (!shape || !Array.isArray(shape.flights) || !Array.isArray(shape.marks)) return json({ error: "Production sent something unexpected." }, 502)

  const service = getServiceRoleSupabase()
  if (!service) return json({ error: "The copy is not configured on this environment." }, 503)
  const { data: result, error } = await service.rpc("procedure_sync_import", { p_data: data })
  if (error) {
    if (error.message.includes("sync_not_allowed")) return json({ error: "This database is not set up to receive a copy." }, 403)
    return json({ error: "The copy failed." }, 500)
  }
  return json({ ok: true, flights: (result as { flights?: number } | null)?.flights ?? shape.flights.length })
}
