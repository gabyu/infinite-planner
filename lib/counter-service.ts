import { supabase } from "./supabase"

const COUNTER_ID = "flight_plans"

// Get the current count from Supabase
export async function getFlightPlanCount(): Promise<number> {
  try {
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
          console.warn("This may be due to Row Level Security (RLS) being enabled on the counters table.")
          console.warn("Please disable RLS for the counters table in your Supabase dashboard.")
        }
      } catch (insertCatchError) {
        console.error("Exception when creating counter:", insertCatchError)
      }

      return 0
    }

    // If we have multiple rows (shouldn't happen, but just in case)
    if (data.length > 1) {
      console.warn("Multiple counter rows found, using the first one")
    }

    // Return the count from the first row
    return data[0]?.count || 0
  } catch (error) {
    console.error("Error fetching counter:", error)
    return 0
  }
}

// Increment the counter in Supabase
export async function incrementFlightPlanCounter(): Promise<number> {
  try {
    // First check if the counter exists
    const { data, error } = await supabase.from("counters").select("count").eq("id", COUNTER_ID)

    // If the counter doesn't exist or there's an error, return 0
    if (error || !data || data.length === 0) {
      console.warn("Counter not found when trying to increment, returning 0")
      return 0
    }

    const currentCount = data[0]?.count || 0
    const newCount = currentCount + 1

    // Update the counter in Supabase
    const { error: updateError } = await supabase.from("counters").update({ count: newCount }).eq("id", COUNTER_ID)

    if (updateError) {
      console.error("Error incrementing counter:", updateError)
      console.warn("This may be due to Row Level Security (RLS) being enabled on the counters table.")
      console.warn("Please disable RLS for the counters table in your Supabase dashboard.")
      return currentCount
    }

    return newCount
  } catch (error) {
    console.error("Error incrementing counter:", error)
    return 0
  }
}
