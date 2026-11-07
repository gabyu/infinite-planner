"use client"

import { useEffect, useState } from "react"

// The footer total. Fetched once per page view (no polling): the figure is cached for a few minutes
// at the CDN, and every poll was a serverless invocation.
export function CounterDisplay({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    let cancelled = false
    fetch("/api/counter")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.count === "number") setCount(data.count)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return <span className="font-bold">{count.toLocaleString()}</span>
}
