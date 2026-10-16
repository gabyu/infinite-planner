import { FrontStage, type FrontDisplay } from "@/components/explore/front-stage"
import { formatFlightTime } from "@/lib/flight-plans"
import { listExploreFront } from "@/lib/library-listing"
import { describeEnd } from "@/lib/plan-meta"
import { planPath } from "@/lib/plan-slug"
import { formatDistanceNm } from "@/lib/route-render"

// The top of Explore: the plans an admin pinned (with their notes), then the most popular, as a featured stage and a
// short list. Runs on the server and hands plain values to the client stage; also returns the ids it shows, so the rest of
// the page does not repeat them.
export async function getExploreFront(): Promise<{ node: React.ReactNode; ids: string[] }> {
  const items = await listExploreFront(6)
  if (items.length === 0) return { node: null, ids: [] }

  const display: FrontDisplay[] = items.map((plan) => {
    const from = describeEnd(plan.origin, null)
    const to = describeEnd(plan.destination, null)
    const facts = [
      plan.flightNumber,
      plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null,
      formatFlightTime(plan.flightTimeMinutes),
    ].filter(Boolean)
    return {
      id: plan.id,
      href: planPath(plan),
      cityFrom: from.city ?? plan.origin,
      cityTo: to.city ?? plan.destination,
      codes: `${plan.origin}${from.iata ? `/${from.iata}` : ""} → ${plan.destination}${to.iata ? `/${to.iata}` : ""}`,
      origin: plan.origin,
      destination: plan.destination,
      facts: facts.join(" · "),
      author: plan.authorName,
      avatarUrl: plan.authorAvatarUrl,
      date: plan.createdAt,
      note: plan.note,
      pinned: plan.pinned,
      likeCount: plan.likeCount,
      downloadCount: plan.downloadCount,
      route: plan.route,
      headN: plan.headN,
      tailN: plan.tailN,
    }
  })
  return { node: <FrontStage items={display} />, ids: items.map((plan) => plan.id) }
}
