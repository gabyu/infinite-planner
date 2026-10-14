import "server-only"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { PlanView } from "@/components/plans/plan-view"
import { BRAND_NAME } from "@/lib/brand"
import { getLibraryLaunched } from "@/lib/library"
import { planMetadata } from "@/lib/plan-meta"
import { planPath, planSlug, publicIdFromSlug } from "@/lib/plan-slug"
import { getPublicPlan, type PublicPlan } from "@/lib/public-plans"

// One plan page, two ways to reach it:
//   "public"  /explore/plans/{slug}          cached for everyone (ISR). While the library isn't launched it
//                                    shows an unlisted plan the legacy way and 404s a public one.
//   "preview" /preview/explore/plans/{slug}  per request, admins only: the middleware sends signed-in admins
//                                    here while the library isn't launched, so they see everything.
export type PlanPageMode = "public" | "preview"

interface Resolved {
  plan: PublicPlan
  // Whether this view may be indexed: public plans, once the library is launched.
  indexable: boolean
  prelaunch: boolean
}

async function resolve(slug: string, mode: PlanPageMode): Promise<Resolved | null> {
  const publicId = publicIdFromSlug(slug)
  if (!publicId) return null
  const plan = await getPublicPlan(publicId)
  if (!plan) return null

  const launched = await getLibraryLaunched()
  if (mode === "public" && !launched && plan.visibility === "public") return null

  return {
    plan,
    indexable: mode === "public" && launched && plan.visibility === "public",
    prelaunch: !launched,
  }
}

export async function planPageMetadata(slug: string, mode: PlanPageMode): Promise<Metadata> {
  const resolved = await resolve(slug, mode)
  // A missing plan is a 404 with noindex.
  if (!resolved) return { title: `Flight plan not found | ${BRAND_NAME}`, robots: { index: false, follow: false } }
  return planMetadata(resolved.plan, { indexable: resolved.indexable })
}

export async function PlanPage({ slug, mode }: { slug: string; mode: PlanPageMode }) {
  const resolved = await resolve(slug, mode)
  if (!resolved) notFound()
  const { plan, prelaunch } = resolved

  // A slug that differs from the canonical one (renamed flight number, wrong airports typed by hand...) redirects.
  if (slug !== planSlug(plan)) permanentRedirect(planPath(plan))

  return (
    <>
      {mode === "preview" && prelaunch && (
        <div className="border-b bg-primary/10 px-4 py-1.5 text-center text-xs text-primary">
          Pre-launch — visible to admins only
        </div>
      )}
      <PlanView plan={plan} />
    </>
  )
}
