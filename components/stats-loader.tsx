"use client"

import { useEffect } from "react"

export function StatsLoader() {
  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/stats")
        const data = await response.json()

        // Update the DOM with the fetched statistics
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
            data.topRoutes.slice(0, 3).forEach((route) => {
              const li = document.createElement("li")
              li.textContent = route
              topRoutesElement.appendChild(li)
            })
          }
        }
      } catch (error) {
        console.error("Failed to load statistics:", error)
      }
    }

    loadStats()
  }, [])

  return null
}
