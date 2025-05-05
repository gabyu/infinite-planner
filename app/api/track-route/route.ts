import { NextResponse } from "next/server"

// In a real implementation, this would use a database
// This is a simplified in-memory solution
const routeCounts: Record<string, number> = {}

export async function POST(request: Request) {
  try {
    const { route } = await request.json()

    if (!route) {
      return NextResponse.json({ error: "No route provided" }, { status: 400 })
    }

    // Increment the route count
    routeCounts[route] = (routeCounts[route] || 0) + 1

    // In a real implementation, you would save this to a database

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to track route" }, { status: 500 })
  }
}

/**
 * Returns the top routes (for internal use by the stats API)
 */
export function getTopRoutes(limit = 3): string[] {
  // Convert the routeCounts object to an array of [route, count] pairs
  const routes = Object.entries(routeCounts)

  // Sort by count in descending order
  routes.sort((a, b) => b[1] - a[1])

  // Return just the route names, limited to the specified number
  return routes.slice(0, limit).map(([route]) => route)
}
