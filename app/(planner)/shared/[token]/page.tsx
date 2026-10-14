import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { planPath } from "@/lib/plan-slug"
import { getPublicPlanLive, publicIdForShareToken } from "@/lib/public-plans"

// Legacy share links (/shared/{token}) now live at the plan page. A token that was revoked
// (the plan went private) or never existed is a 404, as before.
export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function LegacySharedPlan({ params }: { params: { token: string } }) {
  const publicId = await publicIdForShareToken(params.token)
  const plan = publicId ? await getPublicPlanLive(publicId) : null
  if (!plan) notFound()
  permanentRedirect(planPath(plan))
}
