import type { Metadata } from "next"
import { PlanPage, planPageMetadata } from "@/components/plans/plan-page"

// Statically generated on demand and refreshed every 5 minutes; a visibility change, delete,
// moderation action or edit drops it at once through the `plan:{publicId}` cache tag.
export const revalidate = 300

// Nothing is built ahead of time (the library is user content): every page is generated on its first
// request, then served from the cache. This is what makes the route cacheable instead of dynamic.
export function generateStaticParams() {
  return []
}

export function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return planPageMetadata(params.slug, "public")
}

export default function Page({ params }: { params: { slug: string } }) {
  return <PlanPage slug={params.slug} mode="public" />
}
