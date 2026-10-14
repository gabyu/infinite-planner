import { fplFileName, generateFPL } from "@/lib/fpl-generator"
import { json } from "@/lib/flight-plan-server"
import { fetchLibraryLaunched } from "@/lib/library-state"
import { getViewer } from "@/lib/library"
import { allowAction } from "@/lib/rate-limit"
import { getPublicPlanLive, takePublicDownload } from "@/lib/public-plans"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Never cached: an unpublish has to stop downloads at once.
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Downloads a plan of the library as an .fpl. `id` is the plan's PUBLIC id (the visibility route next to
// it takes the plan's database id: same segment name, because Next needs one name per path).
//   Before the launch: an unlisted plan downloads anonymously, exactly like the old share links
//     (counted on the legacy counter); a public one is for admins only.
//   After the launch: signing in is required, and each user counts once per plan (never for their own).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const plan = await getPublicPlanLive(params.id)
  if (!plan) return json({ error: "This flight plan isn't available." }, 404)

  const launched = await fetchLibraryLaunched()
  const viewer = await getViewer()

  if (!launched && plan.visibility === "public" && !viewer.isAdmin) {
    return json({ error: "This flight plan isn't available." }, 404)
  }
  if (launched && !viewer.userId) return json({ error: "Sign in with Discord to download flight plans." }, 401)
  if (viewer.userId && !allowAction(viewer.userId)) return json({ error: "Too many actions. Try again in a minute." }, 429)

  let file: { origin_airport: string; destination_airport: string; waypoints: StoredWaypoint[] } | null = null
  if (viewer.userId) {
    const service = getServiceRoleSupabase()
    const { data, error } = service
      ? await service.rpc("record_plan_download", { p_public_id: params.id, p_user_id: viewer.userId })
      : { data: null, error: null }
    if (error) console.error("Recording a download failed:", error.message)
    file = (data as typeof file[] | null)?.[0] ?? null
  } else {
    file = await takePublicDownload(params.id)
  }
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
