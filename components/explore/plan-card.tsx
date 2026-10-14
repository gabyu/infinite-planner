import Link from "next/link"
import { Download, Heart } from "lucide-react"
import { RouteThumbnail } from "@/components/plans/route-thumbnail"
import { RouteArrow } from "@/components/route-arrow"
import { formatFlightTime, sourceLabel } from "@/lib/flight-plans"
import { describeEnd } from "@/lib/plan-meta"
import { planPath } from "@/lib/plan-slug"
import type { PlanCardData } from "@/lib/library-listing"
import { formatDistanceNm } from "@/lib/route-render"

// One plan in a list: the library, the hubs, "more like this", and later the profiles and the dashboard.
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
            <span className="shrink-0 opacity-70">· {sourceLabel(plan.source)}</span>
          </span>
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
        </div>
      </div>
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
