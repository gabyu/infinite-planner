import { getSessionContext } from "@/lib/admin/auth"
import { ActivityFeed, type FeedItem } from "@/components/admin/activity-feed"

interface Row {
  origin_airport: string
  destination_airport: string
  origin_airport_name: string | null
  destination_airport_name: string | null
  created_at: string
  discord_username: string | null
  avatar_url: string | null
}

// Latest exported plans with their author (admin-only SQL function admin_recent_activity).
export async function ActivityFeedSection() {
  const ctx = await getSessionContext()
  if (!ctx) return null

  const { data, error } = await ctx.supabase.rpc("admin_recent_activity", { p_limit: 30 })
  if (error) {
    console.error("admin_recent_activity failed:", error.message)
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        Couldn't load recent activity right now.
      </div>
    )
  }

  const items: FeedItem[] = ((data ?? []) as Row[]).map((row) => ({
    origin: row.origin_airport,
    destination: row.destination_airport,
    originName: row.origin_airport_name,
    destinationName: row.destination_airport_name,
    createdAt: row.created_at,
    user: row.discord_username,
    avatarUrl: row.avatar_url,
  }))
  return <ActivityFeed items={items} />
}
