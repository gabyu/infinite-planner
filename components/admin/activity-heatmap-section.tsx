import { getSessionContext } from "@/lib/admin/auth"
import { ActivityHeatmap } from "@/components/admin/activity-heatmap"

const PAGE_SIZE = 1000 // PostgREST caps a response at 1000 rows
const MAX_PAGES = 200
// 53 weeks plus a day of slack either way for timezone offsets.
const WINDOW_DAYS = 380

// Fetches the raw export timestamps for the window (admin-only SQL function) and hands them
// to the client component, which draws the day boundaries in the viewer's own timezone.
// Revisit if flight_statistics grows to where fetching raw rows gets slow (13.5k/year now).
export async function ActivityHeatmapSection() {
  const ctx = await getSessionContext()
  if (!ctx) return null

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const exportTimes: number[] = []
  let truncated = false

  for (let page = 0; ; page++) {
    if (page === MAX_PAGES) {
      truncated = true
      break
    }
    const from = page * PAGE_SIZE
    const { data, error } = await ctx.supabase
      .rpc("admin_flight_export_times", { since })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("admin_flight_export_times failed:", error.message)
      return (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          Couldn't load export activity right now.
        </div>
      )
    }

    const rows = (data ?? []) as string[]
    for (const iso of rows) exportTimes.push(Math.floor(Date.parse(iso) / 1000))
    if (rows.length < PAGE_SIZE) break
  }

  return <ActivityHeatmap exportTimes={exportTimes} timezone={ctx.profile?.timezone ?? null} truncated={truncated} />
}
