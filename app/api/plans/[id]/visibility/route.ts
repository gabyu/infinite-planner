import { revalidateTag } from "next/cache"
import { z } from "zod"
import { isUuid, json, requireUser } from "@/lib/flight-plan-server"
import { legalCopy } from "@/lib/copy"
import { getViewer, isLibraryOpenFor } from "@/lib/library"

const bodySchema = z.object({ visibility: z.enum(["private", "public"]) })

// What the database says when set_plan_visibility refuses, in words for the person who asked.
function messageFor(error: { code?: string; message?: string }) {
  const text = error.message ?? ""
  if (text.includes("plan_not_exported")) return "Export the flight plan first: only exported plans can be made public."
  // Plans that come from a tracker export are never published; the database decides, whatever the interface shows.
  if (text.includes("tracker_derived")) return legalCopy.publishOnlyOwnDesigns
  if (text.includes("publishing_blocked")) return "Publishing is disabled for your account."
  if (text.includes("unchanged_fork")) return "Change the route before publishing a copy of someone else's flight plan."
  if (text.includes("rate_limited")) return "You've published a lot today. Try again tomorrow."
  if (text.includes("plan_not_found")) return "Flight plan not found."
  return null
}

// Changes who can see one of the signed-in user's exported plans. The rules live in the
// database function; this route adds what only the app knows (is the library open to this user,
// is their Discord account linked) and drops the cached page when the plan changes visibility.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { supabase, user } = auth
  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Invalid visibility." }, 400)
  const { visibility } = parsed.data

  if (visibility === "public") {
    const viewer = await getViewer()
    if (!(await isLibraryOpenFor(viewer))) return json({ error: "Publishing isn't available yet." }, 403)

    // The public page names its author: an account with no Discord name (an admin who didn't link one) can't publish.
    const { data: profile } = await supabase
      .from("profiles")
      .select("discord_username, library_consent_at")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile?.discord_username) return json({ error: "Link your Discord account to publish." }, 403)
    // The first time, the person has to agree to the name and avatar being shown and indexed.
    if (!profile.library_consent_at) return json({ error: "Please confirm before publishing.", code: "consent_required" }, 409)
  }

  const { data, error } = await supabase.rpc("set_plan_visibility", { p_plan_id: params.id, p_visibility: visibility })
  if (error) {
    const message = messageFor(error)
    if (!message) console.error("Changing a plan's visibility failed:", error.message)
    return json({ error: message ?? "Couldn't change the visibility. Please try again." }, message ? 409 : 500)
  }

  const row = (data as { public_id: string | null; visibility: string }[] | null)?.[0]
  if (row?.public_id) revalidateTag(`plan:${row.public_id}`)
  revalidateTag("library-index")

  return json({ publicId: row?.public_id ?? null, visibility: row?.visibility ?? visibility })
}
