import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/ds/page-shell"
import { RouteArrow } from "@/components/route-arrow"
import { SharedPlanMap } from "@/components/shared-plan-map"
import { formatFlightTime, sourceLabel } from "@/lib/flight-plans"
import { getSharedPlan } from "@/lib/shared-plans"

// A shared link is a live view of the plan, and "Stop sharing" has to cut it off at once:
// never cached, never indexed.
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const FALLBACK_TITLE = "Shared flight plan - Infinite Planner"

// What a pasted link unfurls to (Discord, Slack, X...): the route in the title, the airports,
// flight and duration in the description, and the generated route image (opengraph-image.tsx).
// The root layout sets openGraph/twitter titles, so they have to be overridden here too.
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const plan = await getSharedPlan(params.token)
  const robots = { index: false, follow: false }
  if (!plan) return { title: FALLBACK_TITLE, robots }

  const title = `${plan.origin} → ${plan.destination} - Flight plan by ${plan.authorName} | Infinite Planner`
  const description = [
    `${plan.originName ?? plan.origin} → ${plan.destinationName ?? plan.destination}`,
    plan.flightNumber,
    formatFlightTime(plan.flightTimeMinutes),
    `${plan.waypoints.length} waypoints`,
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    title,
    description,
    robots,
    openGraph: { type: "website", title, description, siteName: "Infinite Planner" },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function SharedPlanPage({ params }: { params: { token: string } }) {
  const plan = await getSharedPlan(params.token)
  if (!plan) notFound()

  const flightTime = formatFlightTime(plan.flightTimeMinutes)
  const details: { label: string; value: string | null }[] = [
    { label: "Flight", value: plan.flightNumber },
    { label: "Flight time", value: flightTime },
    { label: "Waypoints", value: String(plan.waypoints.length) },
  ]

  return (
    <PageShell
      title="Shared flight plan"
      description={`${plan.authorName} shared this flight plan with you.`}
    >
      <div className="max-w-3xl overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b p-4">
          <div className="min-w-0">
            <h2 className="font-mono text-xl font-semibold">
              {plan.origin}
              <RouteArrow />
              {plan.destination}
            </h2>
            {(plan.originName || plan.destinationName) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.originName ?? plan.origin}
                <RouteArrow className="mx-1" />
                {plan.destinationName ?? plan.destination}
              </p>
            )}
          </div>
          <Button asChild>
            <a href={`/api/shared/${params.token}/fpl`} download>
              <Download />
              Download FPL
            </a>
          </Button>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
          {details.map(({ label, value }) => (
            <div key={label} className="px-4 py-3">
              <dt className="studio-label">{label}</dt>
              <dd className="mt-2 font-mono text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
          ))}
          <div className="px-4 py-3">
            <dt className="studio-label">Source</dt>
            <dd className="mt-2">
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {sourceLabel(plan.source)}
              </Badge>
            </dd>
          </div>
        </dl>

        <div className="h-[360px] w-full">
          <SharedPlanMap waypoints={plan.waypoints} />
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        This link always shows the plan as its author has it now. Import it into Infinite Flight from the downloaded
        .fpl file.
      </p>
    </PageShell>
  )
}
