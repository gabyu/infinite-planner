import { Suspense } from "react"
import { ActivityHeatmapSection } from "@/components/admin/activity-heatmap-section"
import { PageHeader } from "@/components/admin/page-header"
import { requireAdmin } from "@/lib/admin/auth"

export default async function DashboardHome() {
  await requireAdmin()

  return (
    <>
      <PageHeader title="Overview" description="Activity across Infinite Planner." />
      <Suspense fallback={<div className="h-[260px] animate-pulse rounded-lg border bg-card" />}>
        <ActivityHeatmapSection />
      </Suspense>
    </>
  )
}
