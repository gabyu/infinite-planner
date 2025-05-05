"use client"

import { identifyRoute } from "@/lib/route-identifier"

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
}

/**
 * Tracks a flight route by sending it to the API for statistics
 */
export async function trackRoute(waypoints: Waypoint[]) {
  try {
    // Only try to identify and track routes with sufficient waypoints
    if (!waypoints || waypoints.length < 2) return

    // Identify the route
    const route = identifyRoute(waypoints)
    if (!route) return

    // Send to API for counting
    await fetch("/api/track-route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ route }),
    })
  } catch (error) {
    // Silent fail - route tracking should never impact the main app functionality
    console.error("Error tracking route:", error)
  }
}
