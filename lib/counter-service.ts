import { getSupabaseClient } from "./supabase"

const COUNTER_ID = "flight_plans"

// Get the current count from Supabase (no caching)
export async function getFlightPlanCount(): Promise<number> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning default count")
      return 0
    }

    const supabase = getSupabaseClient()

    // Always fetch fresh data from database
    const { data, error } = await supabase.from("counters").select("count").eq("id", COUNTER_ID).single() // Use single() to get one record directly

    if (error) {
      console.error("Error fetching counter:", error)

      // If counter doesn't exist, try to create it
      if (error.code === "PGRST116") {
        // No rows returned
        console.log("Counter not found, attempting to create it...")

        const { error: insertError } = await supabase.from("counters").insert({ id: COUNTER_ID, count: 0 })

        if (insertError) {
          console.error("Error creating counter:", insertError)
          return 0
        }

        return 0
      }

      return 0
    }

    return data?.count || 0
  } catch (error) {
    console.error("Exception fetching counter:", error)
    return 0
  }
}

// Increment the counter in Supabase (no caching)
export async function incrementFlightPlanCounter(): Promise<number> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, cannot increment counter")
      return 0
    }

    const supabase = getSupabaseClient()

    // Use Supabase's built-in increment function for atomic updates
    const { data, error } = await supabase.rpc("increment_counter", {
      counter_id: COUNTER_ID,
    })

    if (error) {
      console.error("Error incrementing counter with RPC:", error)

      // Fallback to manual increment if RPC doesn't exist
      const currentCount = await getFlightPlanCount()
      const newCount = currentCount + 1

      const { error: updateError } = await supabase
        .from("counters")
        .update({ count: newCount, updated_at: new Date().toISOString() })
        .eq("id", COUNTER_ID)

      if (updateError) {
        console.error("Error incrementing counter manually:", updateError)
        return currentCount
      }

      return newCount
    }

    return data || 0
  } catch (error) {
    console.error("Exception incrementing counter:", error)
    return 0
  }
}
