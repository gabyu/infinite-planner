"use client"

import { useEffect, useMemo, useState } from "react"
import { resolveTimezone } from "@/lib/admin/timezone"
import { computeYearActivity, dayNumberToDate, mondayIndex } from "@/lib/activity-stats"
import { cn } from "@/lib/utils"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"]
const labelFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const plural = (n: number, word: string) => `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`

// The dashboard's activity card: four headline numbers on top, then the whole calendar year, one square a
// day (blue = more flights that day), stretching to the card's width. The server sends the raw export
// times; days are drawn here, in the viewer's own timezone.
export function ActivityOverview({ exportTimes }: { exportTimes: number[] }) {
  const [tz, setTz] = useState<string | null>(null)
  useEffect(() => setTz(resolveTimezone(null)), [])

  const model = useMemo(() => {
    if (!tz) return null
    const activity = computeYearActivity(exportTimes, tz)
    const { jan1, dec31, today, perDay } = activity

    // Quartiles of the busy days, so one huge day doesn't wash out all the others.
    const counts = [...perDay.values()].sort((a, b) => a - b)
    const quantile = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))]
    const [t1, t2, t3] = [quantile(0.25), quantile(0.5), quantile(0.75)]
    const levelOf = (c: number) => (c === 0 ? 0 : c <= t1 ? 1 : c <= t2 ? 2 : c <= t3 ? 3 : 4)

    // Weeks run Monday to Sunday; the first and last are padded with days outside the year.
    const firstMonday = jan1 - mondayIndex(jan1)
    const weekCount = Math.floor((dec31 - firstMonday) / 7) + 1
    const cells = Array.from({ length: weekCount }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = firstMonday + w * 7 + d
        if (day < jan1 || day > dec31) return null
        const count = perDay.get(day) ?? 0
        return { day, count, level: levelOf(count), future: day > today, label: labelFormat.format(dayNumberToDate(day)) }
      }),
    )
    const monthStarts = cells.map((week, w) => {
      const first = week.find(Boolean)
      if (!first) return ""
      const month = dayNumberToDate(first.day).getUTCMonth()
      const previous = w > 0 ? cells[w - 1].find(Boolean) : null
      return !previous || dayNumberToDate(previous.day).getUTCMonth() !== month ? MONTHS[month] : ""
    })
    return { activity, cells, monthStarts, weekCount }
  }, [tz, exportTimes])

  const a = model?.activity
  const stats = [
    { label: "Total flights", value: a ? a.yearTotal.toLocaleString("en-GB") : null, unit: a ? `in ${a.year}` : "", accent: true },
    { label: "Active days", value: a ? String(a.activeDays) : null, unit: a ? (a.activeDays === 1 ? "day" : "days") : "" },
    { label: "Longest streak", value: a ? String(a.longestStreak) : null, unit: a ? (a.longestStreak === 1 ? "day" : "days") : "" },
    { label: "Busiest day", value: a ? (a.busiestWeekday ?? "-") : null, unit: "" },
  ]

  return (
    <section aria-label="Activity" className="overflow-hidden rounded-lg border bg-card">
      <dl className="grid grid-cols-2 border-b sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-b border-r px-5 py-4 even:border-r-0 [&:nth-child(n+3)]:border-b-0 sm:border-b-0 sm:border-r sm:even:border-r sm:last:border-r-0"
          >
            <dt className="studio-label">{stat.label}</dt>
            <dd className="mt-3 flex items-baseline gap-2">
              {stat.value === null ? (
                <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <span className={cn("text-3xl font-semibold tabular-nums tracking-tight", stat.accent && "text-primary")}>
                    {stat.value}
                  </span>
                  {stat.unit && <span className="text-sm text-muted-foreground">{stat.unit}</span>}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="p-5">
        {!model ? (
          <div className="h-[220px] animate-pulse rounded-md bg-muted" />
        ) : (
          <div className="overflow-x-auto pb-1">
            <div
              className="grid min-w-[760px] gap-[3px]"
              style={{ gridTemplateColumns: `1.75rem repeat(${model.weekCount}, minmax(0, 1fr))` }}
              role="img"
              aria-label={`${plural(model.activity.yearTotal, "flight")} exported in ${model.activity.year}`}
            >
              <span />
              {model.monthStarts.map((month, w) => (
                <span key={w} className="overflow-visible whitespace-nowrap pb-1 text-[11px] text-muted-foreground">
                  {month}
                </span>
              ))}

              {WEEKDAY_LABELS.map((label, d) => (
                <FragmentRow key={d} label={label} cells={model.cells.map((week) => week[d])} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>{a ? `Current streak: ${plural(a.currentStreak, "day")}` : ""}</p>
          <div className="flex items-center gap-1.5 text-xs" aria-hidden>
            Less
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: `hsl(var(--hm-${level}))` }} />
            ))}
            More
          </div>
        </div>
      </div>
    </section>
  )
}

type Cell = { day: number; count: number; level: number; future: boolean; label: string } | null

// One weekday row: its label, then that weekday's square for every week.
function FragmentRow({ label, cells }: { label: string; cells: Cell[] }) {
  return (
    <>
      <span className="flex items-center text-[11px] text-muted-foreground">{label}</span>
      {cells.map((cell, w) =>
        cell ? (
          <span
            key={w}
            title={`${plural(cell.count, "flight")} on ${cell.label}`}
            className={cn("aspect-square rounded-[3px]", cell.future && "opacity-40")}
            style={{ backgroundColor: `hsl(var(--hm-${cell.level}))` }}
          />
        ) : (
          <span key={w} />
        ),
      )}
    </>
  )
}
