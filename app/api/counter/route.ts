import { NextResponse } from "next/server"
import { getCount, incrementCount } from "@/lib/counter-storage"

// API route to get the current count
export async function GET() {
  const count = getCount()
  // Set cache headers to ensure the response is not cached
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
  const newCount = incrementCount()
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
