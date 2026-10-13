// "2 days 3 hours ago": the two largest units, so a plan from this morning reads "5 hours 12 minutes ago".
export function formatAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return "just now"
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
  const parts =
    days > 0
      ? [unit(days, "day"), hours > 0 ? unit(hours, "hour") : ""]
      : hours > 0
        ? [unit(hours, "hour"), mins > 0 ? unit(mins, "minute") : ""]
        : [unit(mins, "minute"), ""]
  return `${parts.filter(Boolean).join(" ")} ago`
}

// "12 Oct 2026 · 14:32 UTC". Fixed to UTC so the server and the browser render the same text.
export function formatUtc(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
  return `${date} · ${time} UTC`
}
