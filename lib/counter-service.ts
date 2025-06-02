import { getSupabaseClient } from "./supabase"

const COUNTER_ID = "flight_plans"

// Fallback to file-based counter if Supabase is not available
let localCounter = 0

// Get the current count from Supabase
export async function getFlightPlanCount(): Promise<number> {
  try {
    // Check if we're in a browser environment
    if (typeof window !== "undefined") {
      // Try to get cached count from localStorage
      const cachedCount = localStorage.getItem("flightPlanCount")
      if (cachedCount) {
        return Number.parseInt(cachedCount, 10)
      }
    }

    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, returning default count")
      return localCounter
    }

    const supabase = getSupabaseClient()

    // First check if the counter exists
    const { data, error } = await supabase.from("counters").select("count").eq("id", COUNTER_ID)

    // If there's an error or no data, try to create the counter
    if (error || !data || data.length === 0) {
      console.log("Counter not found, attempting to create it...")

      try {
        // Insert a new counter with initial value 0
        const { error: insertError } = await supabase.from("counters").insert({ id: COUNTER_ID, count: 0 })

        if (insertError) {
          console.error("Error creating counter:", insertError)
        }
      } catch (insertCatchError) {
        console.error("Exception when creating counter:", insertCatchError)
      }

      return 0
    }

    // Return the count from the first row
    const count = data[0]?.count || 0

    // Cache the count in localStorage if in browser
    if (typeof window !== "undefined") {
      localStorage.setItem("flightPlanCount", count.toString())
    }

    return count
  } catch (error) {
    console.error("Error fetching counter:", error)
    return localCounter
  }
}

// Increment the counter in Supabase
export async function incrementFlightPlanCounter(): Promise<number> {
  try {
    // Check if Supabase is properly configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn("Supabase not configured, using local counter")
      localCounter += 1
      return localCounter
    }

    const supabase = getSupabaseClient()

    // First check if the counter exists
    const { data, error } = await supabase.from("counters").select("count").eq("id", COUNTER_ID)

    // If the counter doesn't exist or there's an error, use local counter
    if (error || !data || data.length === 0) {
      console.warn("Counter not found when trying to increment, using local counter")
      localCounter += 1
      return localCounter
    }

    const currentCount = data[0]?.count || 0
    const newCount = currentCount + 1

    // Update the counter in Supabase
    const { error: updateError } = await supabase.from("counters").update({ count: newCount }).eq("id", COUNTER_ID)

    if (updateError) {
      console.error("Error incrementing counter:", updateError)
      return currentCount
    }

    // Update localStorage if in browser
    if (typeof window !== "undefined") {
      localStorage.setItem("flightPlanCount", newCount.toString())
    }

    return newCount
  } catch (error) {
    console.error("Error incrementing counter:", error)
    localCounter += 1
    return localCounter
  }
}
