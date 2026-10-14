import { Download } from "lucide-react"
import { AltitudeGraph } from "@/components/plans/altitude-graph"
import { RouteMap } from "@/components/plans/route-map"
import { Button } from "@/components/ui/button"
import { RouteArrow } from "@/components/route-arrow"
import { formatFlightTime, sourceLabel } from "@/lib/flight-plans"
import { describeEnd } from "@/lib/plan-meta"
import type { PublicPlan } from "@/lib/public-plans"
import { formatAltitude, formatDistanceNm } from "@/lib/route-render"

// The server-rendered content of a plan page: the same for everyone (it is cached), with no
// per-viewer state. The actions that depend on who is looking (like, import, sign-up block) are a
// client island added in step 2.
export function PlanView({ plan }: { plan: PublicPlan }) {
  const from = describeEnd(plan.origin, plan.originName)
  const to = describeEnd(plan.destination, plan.destinationName)
  const flightTime = formatFlightTime(plan.flightTimeMinutes)
  const generated = new Date(plan.createdAt).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const figures: { label: string; value: string | null }[] = [
    { label: "Distance", value: plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null },
    { label: "Max altitude", value: plan.maxAltitudeFt > 0 ? formatAltitude(plan.maxAltitudeFt) : null },
    { label: "Waypoints", value: String(plan.waypoints.length) },
    { label: "Flight time", value: flightTime },
  ]

  return (
    <article className="container mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pt-16">
      <header>
        <p className="font-mono text-sm uppercase tracking-wide text-muted-foreground">
          {plan.flightNumber ? `Flight ${plan.flightNumber}` : "Flight plan"}
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          {from.label}
          <RouteArrow className="mx-[0.25em] text-primary" />
          {to.label}
        </h1>
        {(from.name || to.name) && (
          <p className="mt-4 text-[17px] text-muted-foreground">
            {from.name ?? from.icao}
            <RouteArrow className="mx-1" />
            {to.name ?? to.icao}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            {plan.authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={plan.authorAvatarUrl}
                alt=""
                width={24}
                height={24}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full"
              />
            ) : null}
            <span>{plan.authorName}</span>
          </span>
          <span>{sourceLabel(plan.source)}</span>
          <span>Generated on {generated}</span>
          {plan.includesBranding && <span>Made with Infinite Planner</span>}
        </div>
        <div className="mt-8">
          <Button asChild size="lg" className="rounded-full px-6">
            <a href={`/api/plans/${plan.publicId}/fpl`} download>
              <Download />
              Download .fpl
            </a>
          </Button>
        </div>
      </header>

      <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-border ring-1 ring-border sm:grid-cols-4">
        {figures.map(({ label, value }) => (
          <div key={label} className="bg-card px-5 py-5">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-2 font-mono text-xl font-medium">{value ?? <span className="text-muted-foreground">—</span>}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-6" aria-label="Route">
        <RouteMap
          waypoints={plan.waypoints}
          label={`Route from ${from.label} to ${to.label}, ${plan.waypoints.length} waypoints`}
        />
      </section>
      <section className="mt-6" aria-label="Altitude profile">
        <AltitudeGraph waypoints={plan.waypoints} />
      </section>

    </article>
  )
}
