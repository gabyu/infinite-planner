"use client"

import { useEffect, useState } from "react"
import { resolveTimezone } from "@/lib/admin/timezone"

// Renders a timestamp in the viewing admin's timezone (their saved override, else the
// browser's). Before hydration it shows the UTC date, which is what the server knows.
export function LocalDate({ iso, timezone }: { iso: string; timezone: string | null }) {
  const [text, setText] = useState(iso.slice(0, 10))

  useEffect(() => {
    const tz = resolveTimezone(timezone)
    setText(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: tz }).format(new Date(iso)))
  }, [iso, timezone])

  return (
    <time dateTime={iso} title={iso}>
      {text}
    </time>
  )
}
