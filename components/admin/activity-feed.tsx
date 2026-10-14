"use client"

import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatAgo } from "@/lib/format-ago"

export interface FeedItem {
  origin: string
  destination: string
  originName: string | null
  destinationName: string | null
  createdAt: string
  /** Discord name of whoever exported the plan, null when the account has none. */
  user: string | null
  avatarUrl: string | null
}

// The latest exported flight plans, newest first: same rows as the visualizer's list, plus who made them.
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  // Relative times need the browser clock: empty during the server render, then ticking every minute.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(tick)
  }, [])

  if (items.length === 0) {
    return <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">No flight plan exported yet.</p>
  }

  return (
    <ol className="divide-y rounded-lg border bg-card">
      {items.map((item, i) => (
        <li key={`${item.createdAt}-${i}`} className="flex items-center gap-3 px-4 py-2.5 sm:gap-4">
          <Avatar className="h-7 w-7 shrink-0">
            {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="text-[10px] uppercase">{(item.user ?? "?").slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-mono text-sm font-medium tabular-nums">
              {item.origin}
              <ArrowRight className="size-3.5 opacity-40" aria-hidden />
              {item.destination}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {item.user ?? <span className="italic">Anonymous user</span>}
              {(item.originName || item.destinationName) && (
                <span className="hidden sm:inline">
                  {" · "}
                  {[item.originName, item.destinationName].filter(Boolean).join(" → ")}
                </span>
              )}
            </p>
          </div>
          <time
            dateTime={item.createdAt}
            title={item.createdAt}
            className="shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
          >
            {now === null ? "" : formatAgo(item.createdAt, now)}
          </time>
        </li>
      ))}
    </ol>
  )
}
