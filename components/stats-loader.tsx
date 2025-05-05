"use client"

import { useEffect, useState } from "react"

export function StatsLoader() {
  const [version, setVersion] = useState<string>("loading...")

  useEffect(() => {
    async function loadStats() {
      try {
        // Fetch statistics
        const statsResponse = await fetch("/api/stats")
        const statsData = await statsResponse.json()

        // Update statistics in the DOM
        if (statsData.monthlyPlans) {
          document.getElementById("monthly-plans")!.textContent = statsData.monthlyPlans.toString()
        }

        if (statsData.totalPlans) {
          document.getElementById("total-plans")!.textContent = statsData.totalPlans.toString()

          // Also update the total plans in the footer
          const footerTotalPlans = document.getElementById("footer-total-plans")
          if (footerTotalPlans) {
            footerTotalPlans.textContent = statsData.totalPlans.toString()
          }
        }

        if (statsData.totalWaypoints) {
          document.getElementById("total-waypoints")!.textContent =
            statsData.totalWaypoints > 1000000
              ? (statsData.totalWaypoints / 1000000).toFixed(1) + "M+"
              : statsData.totalWaypoints.toString()
        }

        if (statsData.topRoutes && statsData.topRoutes.length > 0) {
          const topRoutesElement = document.getElementById("top-routes")
          if (topRoutesElement) {
            topRoutesElement.innerHTML = ""
            statsData.topRoutes.forEach((route: string) => {
              const li = document.createElement("li")
              li.textContent = route
              topRoutesElement.appendChild(li)
            })
          }
        }

        // Update the last updated timestamp in the footer
        if (statsData.lastUpdated) {
          const lastUpdatedElement = document.getElementById("stats-last-updated")
          if (lastUpdatedElement) {
            lastUpdatedElement.textContent = new Date(statsData.lastUpdated).toLocaleString()
          }
        }
      } catch (error) {
        console.error("Failed to load statistics:", error)
      }
    }

    async function loadVersion() {
      try {
        const versionResponse = await fetch("/api/version")
        const versionData = await versionResponse.json()

        const versionElement = document.getElementById("app-version")
        if (versionElement && versionData.version) {
          setVersion(versionData.version)
          versionElement.textContent = versionData.version
        }
      } catch (error) {
        console.error("Failed to load version:", error)
      }
    }

    loadStats()
    loadVersion()
  }, [])

  return null
}
