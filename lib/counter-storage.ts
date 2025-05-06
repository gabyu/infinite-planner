// This file handles the counter storage in a way that works in production environments

import fs from "fs"
import path from "path"
import os from "os"

// Define a path that will work in both development and production
// In production on Vercel, we'll use the /tmp directory which is writable
const COUNTER_FILE =
  process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "flight-plan-counter.txt")
    : path.join(process.cwd(), "data", "counter.txt")

// Initialize the counter file if it doesn't exist
export function initializeCounter(): void {
  try {
    // In development, ensure the directory exists
    if (process.env.NODE_ENV !== "production") {
      const dir = path.dirname(COUNTER_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    // Create the file if it doesn't exist
    if (!fs.existsSync(COUNTER_FILE)) {
      fs.writeFileSync(COUNTER_FILE, "0", "utf8")
    }
  } catch (error) {
    console.error("Error initializing counter file:", error)
  }
}

// Get the current count
export function getCount(): number {
  try {
    initializeCounter()
    const data = fs.readFileSync(COUNTER_FILE, "utf8")
    return Number.parseInt(data, 10) || 0
  } catch (error) {
    console.error("Error reading counter file:", error)
    return 0
  }
}

// Increment the count and return the new value
export function incrementCount(): number {
  try {
    initializeCounter()
    const currentCount = getCount()
    const newCount = currentCount + 1
    fs.writeFileSync(COUNTER_FILE, newCount.toString(), "utf8")
    return newCount
  } catch (error) {
    console.error("Error incrementing counter:", error)
    return getCount() // Return current count if increment fails
  }
}
