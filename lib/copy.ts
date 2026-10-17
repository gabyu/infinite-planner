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
    optionsHint: "Flight number, flight time, names, Made with", // PROVISIONAL
    sheetHandle: "Drag to resize the panel", // PROVISIONAL

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

    // Altitude strip
    altitudeHeading: "Altitude profile", // PROVISIONAL
    altitudeShow: "Show altitude profile", // PROVISIONAL
    altitudeHide: "Hide altitude profile", // PROVISIONAL
    altitudeNone: "No altitude data in this plan yet.", // PROVISIONAL
  },
} as const

/** "Altitude profile: cruises at FL370 over 5,420 NM" for the screen reader label of the strip. */
export function altitudeLabel(cruise: string, distance: string) {
  return `Altitude profile: cruises at ${cruise} over ${distance}` // PROVISIONAL
}
