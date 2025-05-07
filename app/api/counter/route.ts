import { NextResponse } from "next/server"
import { getFlightPlanCount, incrementFlightPlanCounter } from "@/lib/counter-service"

// API route to get the current count
export async function GET() {
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
}

// API route to increment the count
export async function POST() {
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
}
