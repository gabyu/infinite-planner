"use client"

import { useEffect, useState } from "react"
import { getFlightPlanCount } from "@/lib/db-service"

export function SiteFooter() {
  const [flightPlanCount, setFlightPlanCount] = useState<number>(0)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await getFlightPlanCount()
        setFlightPlanCount(count)
      } catch (error) {
        console.error("Failed to fetch flight plan count:", error)
      }
    }

    fetchCount()

    // Set up polling to refresh the count every minute
    const intervalId = setInterval(fetchCount, 60000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <footer className="py-6 border-t">
      <div className="container mx-auto px-4 text-center">
        <p className="text-gray-700 dark:text-gray-300 font-medium mb-3">
          <span className="font-bold">{flightPlanCount.toLocaleString()}</span> flight plans generated so far!
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          Infinite Planner is not affiliated with FlightRadar24, FlightAware, or Infinite Flight.
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
          © {new Date().getFullYear()} Infinite Planner. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
