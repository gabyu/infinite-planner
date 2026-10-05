// The dashboard's activity overview, from the export times (epoch seconds, UTC).
// Days are calendar days in the viewer's timezone. Everything covers the current calendar year.

const DAY_MS = 86_400_000
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export interface YearActivity {
  year: number
  /** Day numbers (days since epoch, calendar arithmetic) of Jan 1, today and Dec 31. */
  jan1: number
  today: number
  dec31: number
  /** Flights exported per day number, this year only. */
  perDay: Map<number, number>
  yearTotal: number
  activeDays: number
  longestStreak: number
  /** Consecutive days with a flight up to today (or up to yesterday while today has none yet). */
  currentStreak: number
  busiestWeekday: string | null
}

export const dayNumberToDate = (day: number) => new Date(day * DAY_MS)
/** 0 = Monday ... 6 = Sunday. */
export const mondayIndex = (day: number) => (new Date(day * DAY_MS).getUTCDay() + 6) % 7

export function computeYearActivity(exportTimes: number[], timeZone: string, now = new Date()): YearActivity {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
  const dayOf = (date: Date) => {
    const parts = formatter.formatToParts(date)
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
    return { year: get("year"), day: Math.round(Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS) }
  }

  const { year, day: today } = dayOf(now)
  const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS)
  const dec31 = Math.round(Date.UTC(year, 11, 31) / DAY_MS)

  const perDay = new Map<number, number>()
  let yearTotal = 0
  for (const seconds of exportTimes) {
    const { year: y, day } = dayOf(new Date(seconds * 1000))
    if (y !== year) continue
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
    yearTotal++
  }

  const days = [...perDay.keys()].sort((a, b) => a - b)
  let longestStreak = 0
  let run = 0
  days.forEach((day, i) => {
    run = i > 0 && day === days[i - 1] + 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
  })

  let currentStreak = 0
  for (let day = perDay.has(today) ? today : today - 1; perDay.has(day); day--) currentStreak++

  const perWeekday = new Array(7).fill(0)
  for (const [day, count] of perDay) perWeekday[mondayIndex(day)] += count
  const best = Math.max(...perWeekday)

  return {
    year,
    jan1,
    today,
    dec31,
    perDay,
    yearTotal,
    activeDays: days.length,
    longestStreak,
    currentStreak,
    busiestWeekday: best > 0 ? WEEKDAYS[perWeekday.indexOf(best)] : null,
  }
}
