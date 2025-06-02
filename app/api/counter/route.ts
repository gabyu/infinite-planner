import { NextResponse } from "next/server"
import { getFlightPlanCount, incrementFlightPlanCounter } from "@/lib/counter-service"

// API route to get the current count (no caching)
export async function GET() {
  try {
    const count = await getFlightPlanCount()

    return NextResponse.json(
      { count },
      {
        headers: {
          // Prevent all caching
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Error in counter GET API:", error)
    return NextResponse.json({ count: 0, error: "Failed to fetch counter" }, { status: 500 })
  }
}

// API route to increment the count (no caching)
export async function POST() {
  try {
    const newCount = await incrementFlightPlanCounter()

    return NextResponse.json(
      { count: newCount },
      {
        headers: {
          // Prevent all caching
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Error in counter POST API:", error)
    return NextResponse.json({ count: 0, error: "Failed to increment counter" }, { status: 500 })
  }
}
