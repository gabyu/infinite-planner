/**
 * Every new user-facing string of the editor revamp and the Explore launch lives here, grouped by screen.
 * Components never hard-code these. The text is the "Calm" option, approved for the first production release (see copy-review-step-N.md for the
 * alternatives). A new string is added with `// PROVISIONAL` at the end of its line until Gabriel approves it: `pnpm
 * check:copy` fails while any remain, and the production build runs it.
 */

import { LIBRARY_NAV_LABEL } from "@/lib/brand"

export const copy = {
  editor: {
    // Panel
    panelCollapse: "Hide panel",
    panelExpand: "Show panel",
    statsDistance: "Distance",
    statsWaypoints: "Waypoints",
    statsMaxAltitude: "Max altitude",
    statsFlightTime: "Flight time",
    detailsHeading: "Flight details",
    waypointsHeading: "Waypoints",
    selectAll: "Select all waypoints",
    deleteSelected: "Delete selected waypoints",
    clearAltitudes: "Clear altitudes of selected waypoints",
    waypointName: "Waypoint name",
    waypointAltitude: "Altitude in feet",
    waypointLatitude: "Latitude",
    waypointLongitude: "Longitude",
    waypointLimit: "Over the 250 waypoint limit",
    optionsHeading: "Options",
    tabWaypoints: "Waypoints",
    flightNumbersLabel: "Flight numbers",
    flightNumberPrimary: "Main flight number",
    flightNumberRemove: "Remove",
    flightNumberPlaceholder: "e.g. AF69",
    flightNumberAddPlaceholder: "Add another",
    flightNumbersHelp: "Optional. Read from the file name when it carries one. Add the other numbers the flight goes by (codeshares), then press Enter. The first is the main one. Letters and digits, up to 12 each, up to 6. Saved with the plan.",
    sheetHandle: "Drag to resize the panel",

    // Ground movements (Options)
    groundHeading: "Ground movements",
    groundHint: "On keeps the taxi before take-off and after landing. Turn off to remove it.",
    trimDeparture: "Departure",
    trimArrival: "Arrival",
    trimApply: "Apply",
    trimCancel: "Cancel",
    trimApproximate: "Approximate",
    trimNone: "No ground movements found",
    trimLoading: "Looking at the runways...",
    trimUndo: "Undo",
    trimBrandingNote: "The plan is now too short for Made with Infinite Planner, so it was left out.",

    // Going back to the Convert start screen
    leaveTitle: "Are you sure you want to go back?",
    leaveBody: "This flight plan hasn't been exported or saved. Going back erases everything you created.",
    leaveStay: "Stay",
    leaveConfirm: "Go back and erase",

    // Map toolbar
    editWaypoints: "Edit waypoints",
    doneEditing: "Done editing",
    selectPoints: "Select points",
    doneSelecting: "Done selecting",
    deleteWaypoints: "Delete",
    fitRoute: "Fit route",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomToDeparture: "Zoom to departure",
    zoomToArrival: "Zoom to arrival",
    mapLoading: "Loading map...",
    mapStyle: "Map style",
    styleAuto: "Auto",
    styleLight: "Light",
    styleDark: "Dark",
    styleColour: "Colour",
    altitudeColours: "Altitude colours",

    // Altitude strip
    altitudeHeading: "Altitude profile",
    altitudeShow: "Show altitude profile",
    altitudeHide: "Hide altitude profile",
    altitudeNone: "No altitude data in this plan yet.",
  },
} as const

/** "12 waypoints will be removed" while previewing a trim. */
export function trimPreviewText(count: number, end: "departure" | "arrival") {
  const where = end === "departure" ? "before take-off" : "after landing"
  return `${count} waypoint${count === 1 ? "" : "s"} will be removed ${where}`
}

/** "12 waypoints removed" in the toast after applying. */
export function trimRemovedText(count: number) {
  return `${count} waypoint${count === 1 ? "" : "s"} removed`
}

/** "Altitude profile: cruises at FL370 over 5,420 NM" for the screen reader label of the strip. */
export function altitudeLabel(cruise: string, distance: string) {
  return `Altitude profile: cruises at ${cruise} over ${distance}`
}

/** The visibility switch (editor, plan page, dashboard): the label says what the switch does, it sits on the left. */
export const visibilityCopy = {
  label: `Publish on ${LIBRARY_NAV_LABEL}`,
  labelShort: "Public",
  helperPrivate: "Only you can see this plan.",
  helperPublic: `Everyone can see it on ${LIBRARY_NAV_LABEL}.`,
  copyLink: "Copy link",
  copied: "Link copied",
}

/**
 * Legal and compliance correctif (copy-review-legal.md has the four options of each string). Calm option, PROVISIONAL
 * until approved: the production build refuses to run while any line below ends with the marker.
 */
export const legalCopy = {
  // Where publishing is refused or switched off (switch helper text, API error). Same sentence everywhere.
  publishOnlyOwnDesigns: "Only flight plans you design in Route Sketch can be published.", // PROVISIONAL
  // A plan an admin took off Explore: the owner sees this, never a reason.
  planNotAvailable: "This flight plan isn't available on Explore right now.", // PROVISIONAL
  // Short tag beside a view or a download of a plan.
  simulationOnly: "Simulation only", // PROVISIONAL
  // Report control and form.
  reportLink: "Report", // PROVISIONAL
  reportTitle: "Report this flight plan", // PROVISIONAL
  reportIntro: "Tell us what's wrong. Only the admins see your report.", // PROVISIONAL
  reportReasonInappropriate: "Inappropriate content", // PROVISIONAL
  reportReasonCopyright: "Copyright infringement", // PROVISIONAL
  reportReasonWrongData: "Wrong or broken data", // PROVISIONAL
  reportReasonSpam: "Spam", // PROVISIONAL
  reportReasonOther: "Something else", // PROVISIONAL
  reportDetailsPlaceholder: "Details (optional)", // PROVISIONAL
  reportSend: "Send report", // PROVISIONAL
  reportThanksTitle: "Thanks for your report", // PROVISIONAL
  reportThanksBody: "An admin will look at it.", // PROVISIONAL
  reportError: "Couldn't send your report. Please try again.", // PROVISIONAL
  reportOwnPlan: "This is your own flight plan.", // PROVISIONAL
} as const
