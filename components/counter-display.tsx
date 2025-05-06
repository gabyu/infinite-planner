"use client"

import { useEffect, useState } from "react"

export function CounterDisplay({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  // Refresh the count every minute
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/counter", { cache: "no-store" })
        if (response.ok) {
          const data = await response.json()
          setCount(data.count)
        }
      } catch (error) {
        console.error("Error fetching count:", error)
      }
    }

    // Set up polling to refresh the count every minute
    const intervalId = setInterval(fetchCount, 60000)
    return () => clearInterval(intervalId)
  }, [])

  return <span className="font-bold">{count.toLocaleString()}</span>
}
