"use client"

import { useEffect, useState } from "react"

export function CounterDisplay({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Function to fetch the latest count from API
    const fetchCount = async () => {
      try {
        // No cache-buster: the CDN answers from a one-minute cache (see /api/counter).
        const response = await fetch("/api/counter")

        if (response.ok) {
          const data = await response.json()
          setCount(data.count)
          setError(null)
        } else {
          console.error("Error response from counter API:", response.status)
          setError("Failed to fetch counter")
        }
      } catch (error) {
        console.error("Error fetching count:", error)
        setError("Failed to fetch counter")
      }
    }

    // Fetch immediately on mount to get the latest data
    fetchCount()

    // The server caches the count for a minute, so polling faster would only repeat the same answer.
    // Skipped while the tab is hidden.
    const intervalId = setInterval(() => {
      if (!document.hidden) fetchCount()
    }, 60_000)

    // Also listen for visibility change to refresh when user comes back to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCount()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Clean up on unmount
    return () => {
      clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // If there's an error, still display the current count
  return <span className="font-bold">{count.toLocaleString()}</span>
}
