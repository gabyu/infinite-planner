import { NextResponse } from "next/server"
import { getTopRoutes } from "../track-route/route"

// In-memory cache for statistics
let statsCache = {
  data: null,
  lastUpdated: 0,
}

// This would be replaced with actual database queries in a real implementation
async function getStats() {
  const currentTime = Date.now()
  const oneHour = 60 * 60 * 1000 // in milliseconds

  // Return cached data if it's less than an hour old
  if (statsCache.data && currentTime - statsCache.lastUpdated < oneHour) {
    return statsCache.data
  }

  // Otherwise, fetch fresh data
  try {
    // This is where you'd query your database or analytics service
    const stats = {
      monthlyPlans: null, // Replace with actual DB query
      totalPlans: null, // Replace with actual DB query
      totalWaypoints: null, // Replace with actual DB query
      topRoutes: getTopRoutes(3), // Will explain this below
      lastUpdated: new Date().toISOString(),
    }

    // Update cache
    statsCache = {
      data: stats,
      lastUpdated: currentTime,
    }

    return stats
  } catch (error) {
    console.error("Error fetching statistics:", error)
    // If there's an error but we have cached data, return it even if it's old
    if (statsCache.data) {
      return { ...statsCache.data, cached: true }
    }
    throw error
  }
}

export async function GET() {
  try {
    const stats = await getStats()
    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
  }
}
