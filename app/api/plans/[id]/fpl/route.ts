import { fplFileName, generateFPL } from "@/lib/fpl-generator"
import { json } from "@/lib/flight-plan-server"
import { fetchLibraryLaunched } from "@/lib/library-state"
import { getViewer } from "@/lib/library"
import { allowAction } from "@/lib/rate-limit"
import { getPublicPlanLive } from "@/lib/public-plans"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Never cached: making a plan private has to stop downloads at once.
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Downloads a public plan of the library as an .fpl; signing in with Discord is required, and each user counts
// once per plan (never for their own). Before the launch the library is for admins and contributors only. `id` is the plan's PUBLIC
// id (the visibility route next to it takes the plan's database id: same segment name, because Next needs one
// name per path).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const plan = await getPublicPlanLive(params.id)
  if (!plan) return json({ error: "This flight plan isn't available." }, 404)

  const viewer = await getViewer()
  if (!(await fetchLibraryLaunched()) && !viewer.canPreview) return json({ error: "This flight plan isn't available." }, 404)
  if (!viewer.userId) return json({ error: "Sign in with Discord to download flight plans." }, 401)
  if (!allowAction(viewer.userId)) return json({ error: "Too many actions. Try again in a minute." }, 429)

  const service = getServiceRoleSupabase()
  const { data, error } = service
    ? await service.rpc("record_plan_download", { p_public_id: params.id, p_user_id: viewer.userId })
    : { data: null, error: null }
  if (error) console.error("Recording a download failed:", error.message)
  const file = (data as { origin_airport: string; destination_airport: string; waypoints: StoredWaypoint[] }[] | null)?.[0]
  if (!file) return json({ error: "This flight plan isn't available." }, 404)

  return new Response(generateFPL(file.waypoints), {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${fplFileName(file.origin_airport, file.destination_airport)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
