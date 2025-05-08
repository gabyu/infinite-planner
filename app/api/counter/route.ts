import { NextResponse } from "next/server"
import { getFlightPlanCount, incrementFlightPlanCounter } from "@/lib/counter-service"

// API route to get the current count
export async function GET() {
  try {
    const count = await getFlightPlanCount()

    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Error in counter GET API:", error)
    return NextResponse.json({ count: 0, error: "Failed to fetch counter" }, { status: 500 })
  }
}

// API route to increment the count
export async function POST() {
  try {
    const newCount = await incrementFlightPlanCounter()

    return NextResponse.json(
      { count: newCount },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Error in counter POST API:", error)
    return NextResponse.json({ count: 0, error: "Failed to increment counter" }, { status: 500 })
  }
}
