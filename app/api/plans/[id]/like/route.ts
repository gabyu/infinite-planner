import { z } from "zod"
import { json, requireLibraryUser } from "@/lib/flight-plan-server"
import { isPublicId } from "@/lib/plan-slug"

const bodySchema = z.object({ liked: z.boolean() })

// Sets the signed-in user's like on a plan (idempotent: the state asked for, not a toggle, so a
// retry or a replayed sign-in intent never flips it back). `id` is the plan's PUBLIC id.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireLibraryUser(request)
  if (auth.error) return auth.error
  if (!isPublicId(params.id)) return json({ error: "Flight plan not found." }, 404)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Invalid request." }, 400)

  const { data, error } = await auth.supabase.rpc("set_plan_like", { p_public_id: params.id, p_liked: parsed.data.liked })
  if (error) {
    if (error.message.includes("plan_not_found")) return json({ error: "Flight plan not found." }, 404)
    if (error.message.includes("own_plan")) return json({ error: "You can't like your own flight plan." }, 409)
    console.error("Liking a plan failed:", error.message)
    return json({ error: "Couldn't save your like. Please try again." }, 500)
  }
  const row = (data as { liked: boolean; like_count: number }[] | null)?.[0]
  return json({ liked: row?.liked ?? parsed.data.liked, likeCount: row?.like_count ?? 0 })
}
