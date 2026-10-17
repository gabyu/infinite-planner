import { json } from "@/lib/flight-plan-server"
import { getViewer, isLibraryOpenFor } from "@/lib/library"
import { isPublicId } from "@/lib/plan-slug"
import { getServerSupabase } from "@/lib/supabase/server"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"

// Never cached: the plan page is, so its counters can be a few minutes old; the page's client island
// refreshes them from here, together with what is true for the signed-in viewer (do they own the plan,
// like it, hold a copy). `id` is the plan's PUBLIC id.
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isPublicId(params.id)) return json({ error: "Flight plan not found." }, 404)
  const viewer = await getViewer()
  if (!(await isLibraryOpenFor(viewer))) return json({ error: "Not found." }, 404)

  const service = getServiceRoleSupabase()
  if (!service) return json({ error: "Not available." }, 503)
  const { data, error } = await service.rpc("get_plan_stats", { p_public_id: params.id })
  const stats = (data as { like_count: number; import_count: number; download_count: number }[] | null)?.[0]
  if (error || !stats) return json({ error: "Flight plan not found." }, 404)

  let me: { planId: string | null; isOwner: boolean; liked: boolean; copyId: string | null } | null = null
  if (viewer.userId) {
    const supabase = getServerSupabase()
    const { data: state } = supabase ? await supabase.rpc("get_plan_viewer_state", { p_public_id: params.id }) : { data: null }
    const row = (state as { plan_id: string | null; is_owner: boolean; liked: boolean; copy_id: string | null }[] | null)?.[0]
    me = row ? { planId: row.plan_id, isOwner: row.is_owner, liked: row.liked, copyId: row.copy_id } : null
  }

  return json({
    likeCount: stats.like_count,
    importCount: stats.import_count,
    downloadCount: stats.download_count,
    signedIn: !!viewer.userId,
    me,
  })
}
