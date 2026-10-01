import { getSupabaseClient } from "./supabase"

const COUNTER_ID = "flight_plans"

export async function getFlightPlanCount(): Promise<number> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning default count")
      return 0
    }

    const supabase = getSupabaseClient()

    // Count flight_statistics rows in Postgres (the public key can't read rows directly)
    const { data, error } = await supabase.rpc("get_flight_count")

    if (error) {
      console.error("Error fetching flight count:", error)
      return 0
    }

    return Number(data) || 0
  } catch (error) {
    console.error("Exception fetching flight count:", error)
    return 0
  }
}

// The counter now automatically increments when a new row is inserted into flight_statistics
