import "server-only"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { BreadcrumbJsonLd } from "@/components/explore/breadcrumb-json-ld"
import { PlanView } from "@/components/plans/plan-view"
import { listPlans } from "@/lib/library-listing"
import { BRAND_NAME, LIBRARY_NAV_LABEL, LIBRARY_PATH } from "@/lib/brand"
import { getLibraryLaunched } from "@/lib/library"
import { planMetadata } from "@/lib/plan-meta"
import { planPath, planSlug, publicIdFromSlug, routeHubPath } from "@/lib/plan-slug"
import { getPublicPlan, type PublicPlan } from "@/lib/public-plans"

// One plan page, two ways to reach it:
//   "public"  /explore/plans/{slug}          cached for everyone (ISR). While the library isn't launched it 404s.
//   "preview" /preview/explore/plans/{slug}  per request, admins and contributors only: the middleware sends signed-in ones
//                                    here while the library isn't launched, so they see everything.
export type PlanPageMode = "public" | "preview"

interface Resolved {
  plan: PublicPlan
  // Whether this view may be indexed: once the library is launched.
  indexable: boolean
  prelaunch: boolean
}

async function resolve(slug: string, mode: PlanPageMode): Promise<Resolved | null> {
  const publicId = publicIdFromSlug(slug)
  if (!publicId) return null
  const plan = await getPublicPlan(publicId)
  if (!plan) return null

  const launched = await getLibraryLaunched()
  // Every plan the library knows is public; before the launch only the admins' preview shows them.
  if (mode === "public" && !launched) return null

  return { plan, indexable: false, prelaunch: !launched }
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

  // More from the same route and from the same author: a few each.
  const [sameRoute, sameAuthor] = await Promise.all([
    listPlans({
      filters: { origins: [plan.origin], destinations: [plan.destination], excludePublicId: plan.publicId },
      limit: 4,
    }),
    listPlans({ filters: { authorPublicId: plan.authorPublicId, excludePublicId: plan.publicId }, limit: 4 }),
  ])

  return (
    <>
      {resolved.indexable && (
        <BreadcrumbJsonLd
          items={[
            { name: LIBRARY_NAV_LABEL, path: LIBRARY_PATH },
            { name: `${plan.origin} to ${plan.destination}`, path: routeHubPath(plan.origin, plan.destination) },
            { name: plan.flightNumber ? `${plan.flightNumber}` : "Flight plan", path: planPath(plan) },
          ]}
        />
      )}
      {mode === "preview" && prelaunch && (
        <div className="border-b bg-primary/10 px-4 py-1.5 text-center text-xs text-primary">
          Pre-launch — visible to admins and contributors only
        </div>
      )}
      <PlanView plan={plan} sameRoute={sameRoute.plans} sameAuthor={sameAuthor.plans} />
    </>
  )
}
