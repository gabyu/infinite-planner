"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { resolveTimezone, isValidTimezone } from "@/lib/admin/timezone"

const DAY_MS = 86_400_000
const WEEKS = 53
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const CELL = 12 // px
const GAP = 3 // px

interface Props {
  /** One entry per exported flight plan: the export time, in epoch seconds (UTC). */
  exportTimes: number[]
  /** The admin's saved IANA timezone, or null to use the browser's. */
  timezone: string | null
  /** True when the server stopped fetching before reaching the end of the window. */
  truncated?: boolean
  /** Heading of the card. */
  title?: string
  /** What one cell counts, singular ("export", "flight plan"). */
  noun?: string
  /** Where the viewer can change their timezone; omit for no "Change" link (the browser's is used). */
  profileHref?: string | null
}

const pad = (n: number) => String(n).padStart(2, "0")
const utcKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// Flight plan exports per day, GitHub-contributions style. The server sends raw export
// times; the day boundaries are drawn here, in the viewing admin's timezone.
export function ActivityHeatmap({
  exportTimes,
  timezone,
  truncated,
  title = "Flight plan exports",
  noun = "export",
  profileHref = "/admin-dashboard/profile",
}: Props) {
  const plural = `${noun}s`
  const [tz, setTz] = useState<string | null>(null)
  const [hover, setHover] = useState<{ label: string; count: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // The browser timezone is only known after hydration.
  useEffect(() => setTz(resolveTimezone(timezone)), [timezone])

  const model = useMemo(() => {
    if (!tz) return null

    // Calendar-day key ("YYYY-MM-DD") of an instant, as seen in `tz`.
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    const dayKey = (date: Date) => {
      const parts = formatter.formatToParts(date)
      const get = (type: string) => parts.find((p) => p.type === type)!.value
      return `${get("year")}-${get("month")}-${get("day")}`
    }

    const counts = new Map<string, number>()
    for (const seconds of exportTimes) {
      const key = dayKey(new Date(seconds * 1000))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    // From here on it's plain calendar arithmetic: days are UTC-midnight stand-ins.
    const [y, m, d] = dayKey(new Date()).split("-").map(Number)
    const today = Date.UTC(y, m - 1, d)
    const mondayIndex = (new Date(today).getUTCDay() + 6) % 7
    const start = today - (mondayIndex + (WEEKS - 1) * 7) * DAY_MS

    const nonZero = [...counts.values()].sort((a, b) => a - b)
    const quantile = (p: number) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))]
    const [t1, t2, t3] = [quantile(0.25), quantile(0.5), quantile(0.75)]
    const levelOf = (c: number) => (c === 0 ? 0 : c <= t1 ? 1 : c <= t2 ? 2 : c <= t3 ? 3 : 4)

    const labelFormat = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })

    const weeks = Array.from({ length: WEEKS }, (_, w) => {
      const days = Array.from({ length: 7 }, (_, i) => {
        const t = start + (w * 7 + i) * DAY_MS
        if (t > today) return null
        const count = counts.get(utcKey(t)) ?? 0
        return { key: utcKey(t), count, level: levelOf(count), label: labelFormat.format(new Date(t)) }
      })
      const first = new Date(start + w * 7 * DAY_MS)
      return { days, month: first.getUTCMonth() }
    })

    let total = 0
    let activeDays = 0
    let best = { count: 0, label: "" }
    const monthly = new Map<string, number>()
    for (const week of weeks) {
      for (const day of week.days) {
        if (!day) continue
        total += day.count
        if (day.count > 0) activeDays++
        if (day.count > best.count) best = { count: day.count, label: day.label }
        const monthKey = day.key.slice(0, 7)
        monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + day.count)
      }
    }

    return { weeks, total, activeDays, best, monthly: [...monthly.entries()].reverse() }
  }, [tz, exportTimes])

  // Start scrolled to the most recent weeks on narrow screens.
  useEffect(() => {
    if (model && scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [model])

  const source = isValidTimezone(timezone) ? "from your profile" : "detected from your browser"
  const gridWidth = WEEKS * CELL + (WEEKS - 1) * GAP

  return (
    <section aria-labelledby="heatmap-title" className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="heatmap-title" className="text-sm font-semibold">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">
          {tz ? (
            <>
              Days in <span className="font-mono">{tz}</span> ({source}).{" "}
              {profileHref && (
                <Link href={profileHref} className="underline underline-offset-2">
                  Change
                </Link>
              )}
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      {!model ? (
        <div className="mt-4 h-[140px] animate-pulse rounded-md bg-muted" />
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{model.total.toLocaleString("en-GB")}</span> {model.total === 1 ? noun : plural} in the last
            12 months across <span className="font-medium text-foreground">{model.activeDays}</span> active days
            {model.best.count > 0 && (
              <>
                . Busiest day: <span className="font-medium text-foreground">{model.best.count}</span> on {model.best.label}
              </>
            )}
            .
          </p>
          {truncated && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Very large dataset: the most recent {plural} may be missing from this view.
            </p>
          )}

          <div ref={scroller} className="mt-4 overflow-x-auto pb-2">
            <div className="flex w-max gap-2">
              {/* Weekday labels */}
              <div className="flex flex-col pt-[18px] text-[10px] text-muted-foreground" style={{ gap: GAP }} aria-hidden>
                {["Mon", "", "Wed", "", "Fri", "", ""].map((label, i) => (
                  <div key={i} style={{ height: CELL, lineHeight: `${CELL}px` }}>
                    {label}
                  </div>
                ))}
              </div>

              <div style={{ width: gridWidth }}>
                {/* Month labels */}
                <div className="flex text-[10px] text-muted-foreground" style={{ gap: GAP, height: 15, marginBottom: 3 }} aria-hidden>
                  {model.weeks.map((week, w) => (
                    <div key={w} className="whitespace-nowrap" style={{ width: CELL }}>
                      {w === 0 || week.month !== model.weeks[w - 1].month ? MONTHS[week.month] : ""}
                    </div>
                  ))}
                </div>

                <div className="flex" style={{ gap: GAP }} onMouseLeave={() => setHover(null)}>
                  {model.weeks.map((week, w) => (
                    <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                      {week.days.map((day, i) =>
                        day ? (
                          <div
                            key={i}
                            role="img"
                            aria-label={`${day.count} ${plural} on ${day.label}`}
                            title={`${day.count} ${day.count === 1 ? noun : plural} on ${day.label}`}
                            onMouseEnter={() => setHover({ label: day.label, count: day.count })}
                            className="rounded-[2px]"
                            style={{ width: CELL, height: CELL, backgroundColor: `hsl(var(--hm-${day.level}))` }}
                          />
                        ) : (
                          <div key={i} style={{ width: CELL, height: CELL }} />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p aria-live="polite" className="min-h-4">
              {hover
                ? `${hover.count} ${hover.count === 1 ? noun : plural} on ${hover.label}`
                : "Hover a day for details."}
            </p>
            <div className="flex items-center gap-1" aria-hidden>
              Less
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className="rounded-[2px]"
                  style={{ width: CELL, height: CELL, backgroundColor: `hsl(var(--hm-${level}))` }}
                />
              ))}
              More
            </div>
          </div>

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">Table view (monthly totals)</summary>
            <table className="mt-2 w-full max-w-xs text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Month</th>
                  <th className="py-1 text-right font-medium capitalize">{plural}</th>
                </tr>
              </thead>
              <tbody>
                {model.monthly.map(([month, count]) => (
                  <tr key={month} className="border-t">
                    <td className="py-1 font-mono text-xs">{month}</td>
                    <td className="py-1 text-right tabular-nums">{count.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  )
}
