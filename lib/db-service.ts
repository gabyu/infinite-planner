"use server"

import { incrementCount, getCount } from "./actions"

// Server-side function to increment the flight plan counter
export async function incrementFlightPlanCounter(): Promise<number> {
  return incrementCount()
}

// Server-side function to get the current flight plan count
export async function getFlightPlanCount(): Promise<number> {
  return getCount()
}

// Re-export the server actions for backward compatibility from './actions';
