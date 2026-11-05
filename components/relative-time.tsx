"use client"

import { useEffect, useState } from "react"

// "just now", "12 min ago", "3 hrs ago", "yesterday", "2 days ago", "3 wks ago", then the date ("12 Oct", "12 Oct 2025").
export function relativeTimeText(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const minutes = Math.floor((now - then) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 35) {
    const weeks = Math.floor(days / 7)
    return `${weeks} ${weeks === 1 ? "wk" : "wks"} ago`
  }
  const date = new Date(then)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })
}

// A short, relative time with the exact one in the tooltip. Until hydration it shows the UTC date (all the server knows), so
// server and client markup match.
export function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso.slice(0, 10))
  const [full, setFull] = useState(iso)
  useEffect(() => {
    setText(relativeTimeText(iso))
    setFull(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)))
    // Keeps "3 min ago" honest while the page stays open.
    const timer = window.setInterval(() => setText(relativeTimeText(iso)), 60_000)
    return () => window.clearInterval(timer)
  }, [iso])
  return (
    <time dateTime={iso} title={full}>
      {text}
    </time>
  )
}
