// Simple in-memory counter for demo purposes
// In a production app, this would connect to a real database
let flightPlanCounter = 0

export async function incrementFlightPlanCounter(): Promise<number> {
  flightPlanCounter += 1
  return flightPlanCounter
}

export async function getFlightPlanCount(): Promise<number> {
  return flightPlanCounter
}
