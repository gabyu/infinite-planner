import Link from "next/link"
import { Download, Heart } from "lucide-react"
import { RouteThumbnail } from "@/components/plans/route-thumbnail"
import { RouteArrow } from "@/components/route-arrow"
import { formatFlightTime } from "@/lib/flight-plans"
import { describeEnd } from "@/lib/plan-meta"
import { planPath } from "@/lib/plan-slug"
import type { PlanCardData } from "@/lib/library-listing"
import { formatDistanceNm } from "@/lib/route-render"

// "Oct 2, 2026": when the flight plan was created, in UTC.
export function formatCardDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function Author({ plan }: { plan: PlanCardData }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {plan.authorAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plan.authorAvatarUrl}
          alt=""
          width={18}
          height={18}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-[18px] w-[18px] shrink-0 rounded-full"
        />
      ) : null}
      <span className="truncate">{plan.authorName}</span>
    </span>
  )
}

function Counts({ plan }: { plan: PlanCardData }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <span className="flex items-center gap-1" title="Likes">
        <Heart size={12} strokeWidth={1.5} aria-hidden />
        {plan.likeCount}
        <span className="sr-only"> likes</span>
      </span>
      <span className="flex items-center gap-1" title="Downloads">
        <Download size={12} strokeWidth={1.5} aria-hidden />
        {plan.downloadCount}
        <span className="sr-only"> downloads</span>
      </span>
    </span>
  )
}

// One plan in a list: the library, the hubs, "more like this", and later the profiles and the dashboard.
// The whole card is the link (the stretched link of its title).
export function PlanCard({ plan }: { plan: PlanCardData }) {
  const from = describeEnd(plan.origin, null)
  const to = describeEnd(plan.destination, null)
  const facts = [
    plan.flightNumber,
    plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null,
    formatFlightTime(plan.flightTimeMinutes),
  ].filter(Boolean)

  return (
    <li className="group relative flex flex-col rounded-3xl bg-card p-3 ring-1 ring-border transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      <RouteThumbnail route={plan.route} />
      <div className="px-2 pb-2 pt-4">
        <h3 className="font-mono text-lg font-semibold">
          <Link
            href={planPath(plan)}
            className="no-underline after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {plan.origin}
            <RouteArrow />
            {plan.destination}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {from.city ?? plan.origin}
          <RouteArrow className="mx-1" />
          {to.city ?? plan.destination}
        </p>
        {facts.length > 0 && <p className="mt-2 font-mono text-xs text-muted-foreground">{facts.join(" · ")}</p>}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Author plan={plan} />
          <Counts plan={plan} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground/80">
          <time dateTime={plan.createdAt}>{formatCardDate(plan.createdAt)}</time>
        </p>
      </div>
    </li>
  )
}

// The cover story of Explore: one plan, large, with its route as the picture and the figures set in the margin.
export function PlanCardCover({ plan }: { plan: PlanCardData }) {
  const from = describeEnd(plan.origin, null)
  const to = describeEnd(plan.destination, null)
  const facts = [
    plan.flightNumber,
    plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null,
    formatFlightTime(plan.flightTimeMinutes),
  ].filter(Boolean)

  return (
    <article className="group relative overflow-hidden rounded-[2rem] bg-card p-4 ring-1 ring-border transition-shadow duration-200 hover:shadow-lg motion-reduce:transition-none sm:p-5">
      <RouteThumbnail route={plan.route} size="large" />
      <div className="px-2 pb-2 pt-6 sm:px-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Cover story</p>
        <h2 className="mt-2 font-display text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          <Link
            href={planPath(plan)}
            className="no-underline after:absolute after:inset-0 after:rounded-[2rem] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {from.city ?? plan.origin}
            <RouteArrow className="mx-[0.25em] text-primary" />
            {to.city ?? plan.destination}
          </Link>
        </h2>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {plan.origin}
          <RouteArrow className="mx-1" />
          {plan.destination}
          {facts.length > 0 && <> · {facts.join(" · ")}</>}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <Author plan={plan} />
          <span className="flex items-center gap-4">
            <time dateTime={plan.createdAt}>{formatCardDate(plan.createdAt)}</time>
            <Counts plan={plan} />
          </span>
        </div>
      </div>
    </article>
  )
}

// A line of an editorial list ("Trending"): rank, route, a few figures. No picture.
export function PlanListRow({ plan, rank }: { plan: PlanCardData; rank: number }) {
  const from = describeEnd(plan.origin, null)
  const to = describeEnd(plan.destination, null)
  return (
    <li className="group relative flex items-baseline gap-4 border-t py-4 first:border-t-0">
      <span className="w-7 shrink-0 font-mono text-sm text-muted-foreground" aria-hidden>
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.01em]">
          <Link href={planPath(plan)} className="no-underline after:absolute after:inset-0 hover:text-primary">
            {from.city ?? plan.origin}
            <RouteArrow className="mx-[0.25em]" />
            {to.city ?? plan.destination}
          </Link>
        </h3>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          {plan.origin}-{plan.destination}
          {plan.flightNumber ? ` · ${plan.flightNumber}` : ""} · {formatCardDate(plan.createdAt)}
        </p>
      </div>
      <Counts plan={plan} />
    </li>
  )
}

export function PlanGrid({ plans, label }: { plans: PlanCardData[]; label?: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </ul>
  )
}
