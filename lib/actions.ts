"use server"

import fs from "fs"
import path from "path"

// Define the path to our counter file
const counterFilePath = path.join(process.cwd(), "data", "counter.json")

// Ensure the data directory exists
function ensureDirectoryExists() {
  const dir = path.dirname(counterFilePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Initialize the counter file if it doesn't exist
function initializeCounterFile() {
  ensureDirectoryExists()
  if (!fs.existsSync(counterFilePath)) {
    fs.writeFileSync(counterFilePath, JSON.stringify({ count: 0 }), "utf8")
  }
}

// Get the current count
export async function getCount(): Promise<number> {
  try {
    initializeCounterFile()
    const data = fs.readFileSync(counterFilePath, "utf8")
    return JSON.parse(data).count
  } catch (error) {
    console.error("Error reading counter file:", error)
    return 0
  }
}

// Increment the count and return the new value
export async function incrementCount(): Promise<number> {
  try {
    initializeCounterFile()
    const currentCount = await getCount()
    const newCount = currentCount + 1
    fs.writeFileSync(counterFilePath, JSON.stringify({ count: newCount }), "utf8")
    return newCount
  } catch (error) {
    console.error("Error incrementing counter:", error)
    return getCount() // Return current count if increment fails
  }
}
