import { NextResponse } from "next/server"
import { getFlightPlanCount } from "@/lib/counter-service"
import { getSupabaseClient } from "@/lib/supabase"

export async function GET() {
  try {
    const count = await getFlightPlanCount()

    return NextResponse.json(
      { count },
      {
        headers: {
          // Shared by every visitor: the CDN serves it for a minute, so the footer's polling costs one
          // function run a minute in total instead of one per visitor every few seconds.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    )
  } catch (error) {
    console.error("Error in counter GET API:", error)
    return NextResponse.json({ count: 0, error: "Failed to fetch counter" }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, cannot increment counter")
      return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })
    }

    const supabase = getSupabaseClient()

    // Insert a new row into flight_statistics to increment the counter
    const { error } = await supabase.from("flight_statistics").insert({
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error("Error inserting flight statistic:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Get the updated count
    const count = await getFlightPlanCount()

    return NextResponse.json(
      { success: true, count },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Error in counter POST API:", error)
    return NextResponse.json({ success: false, error: "Failed to increment counter" }, { status: 500 })
  }
}
