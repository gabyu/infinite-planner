import { revalidateTag } from "next/cache"
import { z } from "zod"
import { isUuid, json, requireUser } from "@/lib/flight-plan-server"

const bodySchema = z.object({ featured: z.boolean() })

// Features (or un-features) one of the signed-in user's public plans on their profile: up to 6, enforced by
// the database function. `id` is the plan's database id (like the visibility route).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Invalid request." }, 400)

  const { error } = await auth.supabase.rpc("set_plan_featured", { p_plan_id: params.id, p_featured: parsed.data.featured })
  if (error) {
    if (error.message.includes("too_many_featured")) return json({ error: "You can feature up to 6 flight plans." }, 409)
    if (error.message.includes("not_public")) return json({ error: "Only a public flight plan can be featured." }, 409)
    if (error.message.includes("plan_not_found")) return json({ error: "Flight plan not found." }, 404)
    console.error("Featuring a plan failed:", error.message)
    return json({ error: "Couldn't update your profile. Please try again." }, 500)
  }
  revalidateTag("library-index")
  return json({ featured: parsed.data.featured })
}
