// The name a waypoint has of its own, underneath the "Made with Infinite Planner" block. `keepNames`: the plan's
// waypoints carry real names (AeroHub files do); otherwise, and when there is none, it is the position number.
export function ownWaypointName(
  waypoint: { name: string; branded?: boolean; unbrandedName?: string },
  index: number,
  keepNames: boolean,
): string {
  // A waypoint that is already branded shows a branding name: its own one is the remembered one.
  const own = waypoint.branded ? waypoint.unbrandedName : waypoint.name
  return keepNames && own?.trim() ? own : String(index).padStart(3, "0")
}
