"use client"

import { useEffect, useState } from "react"

export function CounterDisplay({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Function to fetch the latest count from API
    const fetchCount = async () => {
      try {
        // Always fetch fresh data with cache-busting
        const response = await fetch(`/api/counter?t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        })

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

    // Set up more frequent polling to show real-time updates (every 5 seconds)
    const intervalId = setInterval(fetchCount, 5000)

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
