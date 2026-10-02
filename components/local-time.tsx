"use client"

import { useEffect, useState } from "react"

// A timestamp in the viewer's own timezone. Until hydration it shows the UTC date, which is
// all the server knows, so server and client markup match.
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso.slice(0, 10))

  useEffect(() => {
    setText(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)))
  }, [iso])

  return (
    <time dateTime={iso} title={iso}>
      {text}
    </time>
  )
}
