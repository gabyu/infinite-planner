"use client"

import { useEffect, useState } from "react"
import { getFlightPlanCount } from "@/lib/counter-service"

export function CounterDisplay({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Function to fetch the latest count
    const fetchCount = async () => {
      try {
        // Get count from the service
        const latestCount = await getFlightPlanCount()
        setCount(latestCount)
        setError(null)
      } catch (error) {
        console.error("Error fetching count:", error)
        setError("Failed to fetch counter")
      }
    }

    // Fetch immediately on mount
    fetchCount()

    // Set up polling to refresh the count every 30 seconds
    const intervalId = setInterval(fetchCount, 30000)

    // Clean up on unmount
    return () => clearInterval(intervalId)
  }, [])

  // If there's an error, still display the initial count
  return <span className="font-bold">{count.toLocaleString()}</span>
}
