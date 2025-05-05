"use client"

import { useEffect, useState } from "react"

export function StatsLoader() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/stats")
        const data = await response.json()

        // Update statistics in the DOM
        if (data.monthlyPlans) {
          document.getElementById("monthly-plans")!.textContent = data.monthlyPlans.toString()
        }

        if (data.totalPlans) {
          document.getElementById("total-plans")!.textContent = data.totalPlans.toString()
        }

        if (data.totalWaypoints) {
          document.getElementById("total-waypoints")!.textContent =
            data.totalWaypoints > 1000000
              ? (data.totalWaypoints / 1000000).toFixed(1) + "M+"
              : data.totalWaypoints.toString()
        }

        if (data.topRoutes && data.topRoutes.length > 0) {
          const topRoutesElement = document.getElementById("top-routes")
          if (topRoutesElement) {
            topRoutesElement.innerHTML = ""
            data.topRoutes.forEach((route) => {
              const li = document.createElement("li")
              li.textContent = route
              topRoutesElement.appendChild(li)
            })
          }
        }

        // Store the last updated timestamp
        if (data.lastUpdated) {
          setLastUpdated(data.lastUpdated)
        }
      } catch (error) {
        console.error("Failed to load statistics:", error)
      }
    }

    loadStats()
  }, [])

  return (
    <>
      {lastUpdated && (
        <div className="text-xs text-gray-500 text-center mt-2" id="last-updated">
          Stats last updated: {new Date(lastUpdated).toLocaleString()}
        </div>
      )}
    </>
  )
}
