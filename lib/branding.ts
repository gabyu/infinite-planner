// The "Made with Infinite Planner" waypoint names. Pure functions: the editor and the export both use them.
import { BRAND_NAMES, BRANDING_MIN_WAYPOINTS } from "@/lib/flight-plans"

export interface Brandable {
  name: string
  locked?: boolean
  // Set on the four MADE/WITH/INFINITE/PLANNER waypoints, with the name each one had before.
  branded?: boolean
  unbrandedName?: string
}

// The branding block is the four waypoints just before the destination.
export function isBrandingSlot(index: number, total: number) {
  return total >= BRANDING_MIN_WAYPOINTS && index >= total - 5 && index <= total - 2
}

// Puts the MADE/WITH/INFINITE/PLANNER block on (or takes it off) without touching any other
// name. Idempotent: it first restores every branded waypoint, then re-brands the current
// last-four-before-the-destination, so it also repairs a block that edits have shifted.
export function applyBrandingOverlay<T extends Brandable>(waypoints: T[], include: boolean): T[] {
  const restored = waypoints.map((wp, index) =>
    wp.branded
      ? { ...wp, name: wp.unbrandedName ?? String(index).padStart(3, "0"), locked: false, branded: false, unbrandedName: undefined }
      : wp,
  )
  if (!include) return restored
  return restored.map((wp, index) =>
    isBrandingSlot(index, restored.length)
      ? { ...wp, unbrandedName: wp.name, name: BRAND_NAMES[index - (restored.length - 5)], locked: true, branded: true }
      : wp,
  )
}
