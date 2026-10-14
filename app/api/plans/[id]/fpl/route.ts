import { fplFileName, generateFPL } from "@/lib/fpl-generator"
import { json } from "@/lib/flight-plan-server"
import { fetchLibraryLaunched } from "@/lib/library-state"
import { getViewer } from "@/lib/library"
import { getPublicPlanLive, takePublicDownload } from "@/lib/public-plans"

// Never cached: an unpublish has to stop downloads at once.
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Downloads a plan of the library as an .fpl. `id` is the plan's PUBLIC id (the visibility route next to it
// takes the plan's database id: same segment name, because Next needs one name per path).
//   Before the launch: an unlisted plan downloads anonymously, exactly like the old share links;
//     a public one is for admins only.
//   After the launch: signing in is required (per-user download counting arrives with step 2).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const plan = await getPublicPlanLive(params.id)
  if (!plan) return json({ error: "This flight plan isn't available." }, 404)

  const launched = await fetchLibraryLaunched()
  const viewer = launched || plan.visibility === "public" ? await getViewer() : null

  if (!launched && plan.visibility === "public" && !viewer?.isAdmin) {
    return json({ error: "This flight plan isn't available." }, 404)
  }
  if (launched && !viewer?.userId) return json({ error: "Sign in with Discord to download flight plans." }, 401)

  const file = await takePublicDownload(params.id)
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
