import Link from "next/link"
import { AltitudeGraph } from "@/components/plans/altitude-graph"
import { RouteMap } from "@/components/plans/route-map"
import { AuthorLink } from "@/components/plans/author-link"
import { PlanActions } from "@/components/plans/plan-actions"
import { RouteArrow } from "@/components/route-arrow"
import { formatFlightTime, sourceLabel } from "@/lib/flight-plans"
import { describeEnd, type PlanEnd } from "@/lib/plan-meta"
import { PlanGrid } from "@/components/explore/plan-card"
import type { PlanCardData } from "@/lib/library-listing"
import { flightNumberPath, locationPath, planPath, routeHubPath } from "@/lib/plan-slug"
import type { PublicPlan } from "@/lib/public-plans"
import { formatAltitude, formatDistanceNm, hasAltitudeData } from "@/lib/route-render"

// The server-rendered content of a plan page: the same for everyone (it is cached), with no
// per-viewer state. The actions that depend on who is looking (like, import, sign-up block) are a
// client island added in step 2.
// "(KPHX/PHX)" at half the size of the city name, linking to everything that departs from or arrives at the airport.
function AirportCodes({ end }: { end: PlanEnd }) {
  return (
    <Link
      href={locationPath(end.icao)}
      title={`Flight plans from and to ${end.name ?? end.icao}`}
      className="font-mono text-[0.5em] font-medium text-muted-foreground no-underline transition-colors hover:text-primary motion-reduce:transition-none"
    >
      ({end.icao}
      {end.iata ? `/${end.iata}` : ""})
    </Link>
  )
}

export function PlanView({
  plan,
  sameRoute = [],
  sameAuthor = [],
}: {
  plan: PublicPlan
  sameRoute?: PlanCardData[]
  sameAuthor?: PlanCardData[]
}) {
  const from = describeEnd(plan.origin, plan.originName)
  const to = describeEnd(plan.destination, plan.destinationName)
  const flightTime = formatFlightTime(plan.flightTimeMinutes)
  const generated = new Date(plan.createdAt).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // A plan with no altitude at all has no altitude figure and no altitude graph.
  const hasAltitude = hasAltitudeData(plan.waypoints)
  const figures: { label: string; value: string | null }[] = [
    { label: "Distance", value: plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null },
    ...(hasAltitude ? [{ label: "Max altitude", value: formatAltitude(plan.maxAltitudeFt) }] : []),
    { label: "Waypoints", value: String(plan.waypoints.length) },
    { label: "Flight time", value: flightTime },
  ]

  return (
    <article className="container mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pt-16">
      <header>
        <p className="font-mono text-sm uppercase tracking-wide text-muted-foreground">
          {plan.flightNumber ? (
            <Link href={flightNumberPath(plan.flightNumber)} className="no-underline hover:text-primary" title={`All flight plans of ${plan.flightNumber}`}>
              Flight {plan.flightNumber}
            </Link>
          ) : (
            "Flight plan"
          )}
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          {from.city ?? from.name ?? from.icao} <AirportCodes end={from} />
          <RouteArrow className="mx-[0.25em] text-primary" />
          {to.city ?? to.name ?? to.icao} <AirportCodes end={to} />
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
            <AuthorLink name={plan.authorName} profilePublicId={plan.authorPublicId} />
          </span>
          <span>{sourceLabel(plan.source)}</span>
          <span>Generated on {generated}</span>
          {plan.includesBranding && <span>Made with Infinite Planner</span>}
        </div>
        <PlanActions
          publicId={plan.publicId}
          path={planPath(plan)}
          initial={{ likeCount: plan.likeCount, importCount: plan.importCount, downloadCount: plan.downloadCount }}
          origin={plan.origin}
          destination={plan.destination}
          flightNumber={plan.flightNumber}
        />
      </header>

      <dl
        className={`mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-border ring-1 ring-border ${figures.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
      >
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
      {hasAltitude && (
        <section className="mt-6" aria-label="Altitude profile">
          <AltitudeGraph waypoints={plan.waypoints} />
        </section>
      )}


      {sameRoute.length > 0 && (
        <section className="mt-16" aria-labelledby="more-route">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="more-route" className="font-display text-2xl font-semibold tracking-tight">
              More from {plan.origin} to {plan.destination}
            </h2>
            <Link href={routeHubPath(plan.origin, plan.destination)} className="text-sm text-muted-foreground underline underline-offset-2">
              See all
            </Link>
          </div>
          <PlanGrid plans={sameRoute} />
        </section>
      )}
      {sameAuthor.length > 0 && (
        <section className="mt-16" aria-labelledby="more-author">
          <h2 id="more-author" className="mb-4 font-display text-2xl font-semibold tracking-tight">
            More by {plan.authorName}
          </h2>
          <PlanGrid plans={sameAuthor} />
        </section>
      )}
    </article>
  )
}
