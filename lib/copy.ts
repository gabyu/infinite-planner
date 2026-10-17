/**
 * Every new user-facing string of the editor revamp and the Explore launch lives here, grouped by screen.
 * Components never hard-code these. A line ending in `// PROVISIONAL` is the "Calm" option waiting for
 * Gabriel's approval (see copy-review-step-N.md); `pnpm check:copy` fails while any remain, and the
 * production build runs it.
 */

export const copy = {
  editor: {
    // Panel
    panelCollapse: "Hide panel", // PROVISIONAL
    panelExpand: "Show panel", // PROVISIONAL
    statsDistance: "Distance", // PROVISIONAL
    statsWaypoints: "Waypoints", // PROVISIONAL
    statsMaxAltitude: "Max altitude", // PROVISIONAL
    statsFlightTime: "Flight time", // PROVISIONAL
    detailsHeading: "Flight details", // PROVISIONAL
    waypointsHeading: "Waypoints", // PROVISIONAL
    selectAll: "Select all waypoints", // PROVISIONAL
    deleteSelected: "Delete selected waypoints", // PROVISIONAL
    clearAltitudes: "Clear altitudes of selected waypoints", // PROVISIONAL
    waypointName: "Waypoint name", // PROVISIONAL
    waypointAltitude: "Altitude in feet", // PROVISIONAL
    waypointLatitude: "Latitude", // PROVISIONAL
    waypointLongitude: "Longitude", // PROVISIONAL
    waypointLimit: "Over the 250 waypoint limit", // PROVISIONAL
    optionsHeading: "Options", // PROVISIONAL
    tabWaypoints: "Waypoints", // PROVISIONAL
    flightNumbersLabel: "Flight numbers", // PROVISIONAL
    flightNumberPrimary: "Main flight number", // PROVISIONAL
    flightNumberRemove: "Remove", // PROVISIONAL
    flightNumberPlaceholder: "e.g. AF69", // PROVISIONAL
    flightNumberAddPlaceholder: "Add another", // PROVISIONAL
    flightNumbersHelp: "Optional. Read from the file name when it carries one. Add the other numbers the flight goes by (codeshares), then press Enter. The first is the main one. Letters and digits, up to 12 each, up to 6. Saved with the plan.", // PROVISIONAL
    signedOutNote: "Flight number and flight time are saved with the plan once you sign in.", // PROVISIONAL
    sheetHandle: "Drag to resize the panel", // PROVISIONAL

    // Ground movements (Options)
    groundHeading: "Ground movements", // PROVISIONAL
    groundHint: "On keeps the taxi before take-off and after landing. Turn off to remove it.", // PROVISIONAL
    trimDeparture: "Departure", // PROVISIONAL
    trimArrival: "Arrival", // PROVISIONAL
    trimApply: "Apply", // PROVISIONAL
    trimCancel: "Cancel", // PROVISIONAL
    trimApproximate: "Approximate", // PROVISIONAL
    trimNone: "No ground movements found", // PROVISIONAL
    trimLoading: "Looking at the runways...", // PROVISIONAL
    trimUndo: "Undo", // PROVISIONAL
    trimBrandingNote: "The plan is now too short for Made with Infinite Planner, so it was left out.", // PROVISIONAL

    // Going back to the Convert start screen
    leaveTitle: "Are you sure you want to go back?", // PROVISIONAL
    leaveBody: "This flight plan hasn't been exported or saved. Going back erases everything you created.", // PROVISIONAL
    leaveStay: "Stay", // PROVISIONAL
    leaveConfirm: "Go back and erase", // PROVISIONAL

    // Map toolbar
    editWaypoints: "Edit waypoints", // PROVISIONAL
    doneEditing: "Done editing", // PROVISIONAL
    selectPoints: "Select points", // PROVISIONAL
    doneSelecting: "Done selecting", // PROVISIONAL
    deleteWaypoints: "Delete", // PROVISIONAL
    fitRoute: "Fit route", // PROVISIONAL
    zoomIn: "Zoom in", // PROVISIONAL
    zoomOut: "Zoom out", // PROVISIONAL
    zoomToDeparture: "Zoom to departure", // PROVISIONAL
    zoomToArrival: "Zoom to arrival", // PROVISIONAL
    mapLoading: "Loading map...", // PROVISIONAL
    mapStyle: "Map style", // PROVISIONAL
    styleAuto: "Auto", // PROVISIONAL
    styleLight: "Light", // PROVISIONAL
    styleDark: "Dark", // PROVISIONAL
    styleColour: "Colour", // PROVISIONAL
    altitudeColours: "Altitude colours", // PROVISIONAL

    // Altitude strip
    altitudeHeading: "Altitude profile", // PROVISIONAL
    altitudeShow: "Show altitude profile", // PROVISIONAL
    altitudeHide: "Hide altitude profile", // PROVISIONAL
    altitudeNone: "No altitude data in this plan yet.", // PROVISIONAL
  },
} as const

/** "12 waypoints will be removed" while previewing a trim. */
export function trimPreviewText(count: number, end: "departure" | "arrival") {
  const where = end === "departure" ? "before take-off" : "after landing"
  return `${count} waypoint${count === 1 ? "" : "s"} will be removed ${where}` // PROVISIONAL
}

/** "12 waypoints removed" in the toast after applying. */
export function trimRemovedText(count: number) {
  return `${count} waypoint${count === 1 ? "" : "s"} removed` // PROVISIONAL
}

/** "Altitude profile: cruises at FL370 over 5,420 NM" for the screen reader label of the strip. */
export function altitudeLabel(cruise: string, distance: string) {
  return `Altitude profile: cruises at ${cruise} over ${distance}` // PROVISIONAL
}
