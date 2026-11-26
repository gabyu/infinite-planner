// How a plan's waypoints are named. Pure functions: the editor applies them whenever the plan changes shape.
import { isBrandingSlot, type Brandable } from "@/lib/branding"
import { BRAND_NAMES } from "@/lib/flight-plans"

export interface Nameable extends Brandable {
  /** Set while a first or last waypoint shows the airport's code: the name it had of its own (kept names only). */
  replacedName?: string
}

// The name a waypoint has of its own, underneath the airport code or the "Made with Infinite Planner" block.
// `keepNames`: the plan's waypoints carry real names (AeroHub files do); otherwise, and when there is none, it is the
// position number.
export function ownWaypointName(waypoint: Nameable, index: number, keepNames: boolean): string {
  // A branded waypoint shows a branding name and an end one an airport code: both remember their own.
  const own = waypoint.branded ? waypoint.unbrandedName : (waypoint.replacedName ?? waypoint.name)
  return keepNames && own?.trim() ? own : String(index).padStart(3, "0")
}

/**
 * The first and last waypoints are locked to the origin and destination, everything else takes its own name (numbered
 * by position unless names are kept), and with `branding` the four waypoints before the destination become
 * MADE / WITH / INFINITE / PLANNER (locked). The same rules for Convert and Sketch.
 */
export function applyNamingRules<T extends Nameable>(
  waypoints: T[],
  { origin, destination, branding, keepNames }: { origin: string; destination: string; branding: boolean; keepNames: boolean },
): T[] {
  return waypoints.map((wp, index) => {
    const isFirst = index === 0
    const isLast = index === waypoints.length - 1
    const ownName = ownWaypointName(wp, index, keepNames)
    const plain = { ...wp, branded: false, unbrandedName: undefined, replacedName: undefined }

    if (isFirst || isLast) {
      return {
        ...plain,
        name: isFirst ? origin || "ORIG" : destination || "DEST",
        replacedName: keepNames ? ownName : undefined,
        locked: true,
      }
    }

    if (branding && isBrandingSlot(index, waypoints.length)) {
      return { ...plain, name: BRAND_NAMES[index - (waypoints.length - 5)], locked: true, branded: true, unbrandedName: ownName }
    }

    return { ...plain, name: ownName, locked: false }
  })
}
