import { Suspense } from "react"
import { ActivityFeedSection } from "@/components/admin/activity-feed-section"
import { ActivityHeatmapSection } from "@/components/admin/activity-heatmap-section"
import { PageHeader } from "@/components/admin/page-header"
import { UsersSection } from "@/components/admin/users-section"
import { requireAdmin } from "@/lib/admin/auth"

// One page for what happened (heatmap, then the latest flight plans) and who joined (members list).
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; sort?: string; dir?: string }
}) {
  await requireAdmin()
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  return (
    <>
      <PageHeader title="Activity" description="Flight plans exported on Infinite Planner, and who joined." />

      <div className="space-y-10">
        <Suspense fallback={<div className="h-[260px] animate-pulse rounded-lg border bg-card" />}>
          <ActivityHeatmapSection />
        </Suspense>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Latest flight plans</h2>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border bg-card" />}>
            <ActivityFeedSection />
          </Suspense>
        </section>

        <section id="members" className="scroll-mt-24 space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">New members</h2>
          <UsersSection page={page} search={searchParams.q ?? ""} sort={searchParams.sort} dir={searchParams.dir} />
        </section>
      </div>
    </>
  )
}
