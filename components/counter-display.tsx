"use client"

import { useEffect, useState } from "react"

export function CounterDisplay({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Function to fetch the latest count
    const fetchCount = async () => {
      try {
        // Add a cache-busting query parameter to prevent caching
        const response = await fetch(`/api/counter?t=${Date.now()}`, {
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

    // Fetch immediately on mount
    fetchCount()

    // Set up polling to refresh the count every 10 seconds
    const intervalId = setInterval(fetchCount, 10000)

    // Clean up on unmount
    return () => clearInterval(intervalId)
  }, [])

  // If there's an error, still display the initial count
  return <span className="font-bold">{count.toLocaleString()}</span>
}
