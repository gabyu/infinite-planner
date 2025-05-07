import { supabase } from "./supabase"

const COUNTER_ID = "flight_plans"

// Get the current count from Supabase
export async function getFlightPlanCount(): Promise<number> {
  try {
    const { data, error } = await supabase.from("counters").select("count").eq("id", COUNTER_ID).single()

    if (error) {
      console.error("Error fetching counter:", error)
      return 0
    }

    return data?.count || 0
  } catch (error) {
    console.error("Error fetching counter:", error)
    return 0
  }
}

// Increment the counter in Supabase
export async function incrementFlightPlanCounter(): Promise<number> {
  try {
    // First get the current count
    const currentCount = await getFlightPlanCount()
    const newCount = currentCount + 1

    // Update the counter in Supabase
    const { error } = await supabase.from("counters").update({ count: newCount }).eq("id", COUNTER_ID)

    if (error) {
      console.error("Error incrementing counter:", error)
      return currentCount
    }

    return newCount
  } catch (error) {
    console.error("Error incrementing counter:", error)
    return await getFlightPlanCount()
  }
}
