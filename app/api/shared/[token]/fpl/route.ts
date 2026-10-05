import { generateFPL, fplFileName } from "@/lib/fpl-generator"
import { json } from "@/lib/flight-plan-server"
import { takeSharedDownload } from "@/lib/shared-plans"

// Never cached: a cached response would outlive "Stop sharing".
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Public (no sign-in): downloads the shared plan as an .fpl and counts the download
// (share_download_count, stored but not shown anywhere yet).
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const plan = await takeSharedDownload(params.token)
  if (!plan) return json({ error: "This link isn't available." }, 404)

  return new Response(generateFPL(plan.waypoints), {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${fplFileName(plan.origin_airport, plan.destination_airport)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
