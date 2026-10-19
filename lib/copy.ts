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
    tabDeparture: "Departure", // PROVISIONAL
    tabCruise: "Cruise", // PROVISIONAL
    tabArrival: "Arrival", // PROVISIONAL
    flightNumbersLabel: "Flight numbers",
    flightNumberPrimary: "Main flight number",
    addFlightNumber: "Add a flight number",
    noFlightNumber: "No flight number",
    flightNumberRemove: "Remove",
    flightNumberPlaceholder: "e.g. AF69",
    flightNumberAddPlaceholder: "Add another",
    flightNumbersHelp: "Optional. Read from the file name when it carries one. Add the other numbers the flight goes by (codeshares), then press Enter. The first is the main one. Letters and digits, up to 12 each, up to 6. Saved with the plan.",
    sheetHandle: "Drag to resize the panel",

    // Ground movements (Options)
    groundWaypoints: "Ground movement waypoints", // PROVISIONAL
    groundHint: "On keeps the taxi before take-off and after landing. Turn off to remove it.",
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

  // Live airport information (editor Options). Every line below waits for Gabriel's approval.
  live: {
    heading: "Live airport info", // PROVISIONAL
    source: "Live from the Infinite Flight Expert Server. Simulation only.", // PROVISIONAL
    departure: "Departure", // PROVISIONAL
    arrival: "Arrival", // PROVISIONAL
    loading: "Looking for the ATIS...", // PROVISIONAL
    atisLetter: "Information", // PROVISIONAL
    windCalm: "Calm", // PROVISIONAL
    windVariable: "Variable", // PROVISIONAL
    noAtis: "No ATIS at this airport right now.", // PROVISIONAL
    unavailable: "Live data isn't available right now.", // PROVISIONAL
    runwaysNotRead: "The runways couldn't be read from this ATIS. Read the text.", // PROVISIONAL
    showText: "Show the ATIS text", // PROVISIONAL
    hideText: "Hide the ATIS text", // PROVISIONAL
    runwayTap: "Tap the runway you'll use.", // PROVISIONAL
    runwayFromAtis: "From the ATIS.", // PROVISIONAL
    runwayYours: "Your choice.", // PROVISIONAL
    runwayYoursNotInAtis: "Your choice. Not in the ATIS now.", // PROVISIONAL
    noAtisShort: "No ATIS", // PROVISIONAL
    runwayIntoWind: "Into the wind.", // PROVISIONAL
    bestHeadwind: "Best headwind:", // PROVISIONAL
    lightWind: "Light wind: any runway.", // PROVISIONAL
    noWeather: "No recent weather report nearby.", // PROVISIONAL
    weatherUnavailable: "Weather isn't available right now.", // PROVISIONAL
    weatherCredit: "NOAA", // PROVISIONAL
    weatherCreditFull: "Weather: NOAA Aviation Weather Center.", // PROVISIONAL
    toneGood: "Best headwind.", // PROVISIONAL
    toneCaution: "Check the wind.", // PROVISIONAL
    toneAvoid: "Tailwind.", // PROVISIONAL
  },

  // Departure guides (editor, Departure tab). Every line below waits for Gabriel's approval.
  guides: {
    heading: "Departure guide", // PROVISIONAL
    save: "Save as guide", // PROVISIONAL
    saving: "Saving...", // PROVISIONAL
    saved: "Saved", // PROVISIONAL
    needsPlan: "Available once your plan is saved.", // PROVISIONAL
    lowConfidence: "Couldn't tell which runway this departure used. Tap the runway above, then save.", // PROVISIONAL
    tapRunway: "Tap a runway above to see your saved guides for it.", // PROVISIONAL
    noGuides: "You have no saved guides for this runway.", // PROVISIONAL
    fitSame: "Same runway", // PROVISIONAL
    fitParallel: "Parallel runway", // PROVISIONAL
    fitSimilar: "Similar heading", // PROVISIONAL
    fitOther: "Other runway", // PROVISIONAL
    preview: "Preview", // PROVISIONAL
    hidePreview: "Hide preview", // PROVISIONAL
    use: "Use", // PROVISIONAL
    remove: "Delete", // PROVISIONAL
    removeConfirm: "Delete?", // PROVISIONAL
    joinWarning: "Different heading: check the terrain and obstacles on the joining leg.", // PROVISIONAL
    needsDraft: "This plan is locked. Duplicate it to use a guide.", // PROVISIONAL
    savedToast: "Guide saved", // PROVISIONAL
    appliedToast: "Departure guide applied", // PROVISIONAL
    errTooMany: "You've reached the limit of 300 saved guides.", // PROVISIONAL
    errNotSaved: "Save the plan first, then try again.", // PROVISIONAL
    errNotDraft: "This plan is locked. Duplicate it to change it.", // PROVISIONAL
    errGeneric: "Something went wrong. Please try again.", // PROVISIONAL
  },
} as const

/** "21L · west · 122 NM" for a guide's line: the runway, where it headed, how far to the top of climb. */
export function guideSummaryText(runway: string | null, direction: string, distanceNm: number) {
  return `${runway ?? "?"} · ${direction} · ${distanceNm}\u00A0NM` // PROVISIONAL
}

/** "Your guides for 21R" above the list of saved guides for the runway the pilot tapped. */
export function guidesForText(runway: string) {
  return `Your guides for ${runway}` // PROVISIONAL
}

/** "METAR KSFO, 04:53Z" for the airport's own report, "From KOAK, 12 NM away, 04:53Z" for a neighbouring station. */
export function weatherSourceText(report: { station: string; distanceNm: number; observedAt: string }) {
  const time = `${report.observedAt.slice(11, 16)}Z`
  return report.distanceNm === 0 ? `METAR ${report.station}, ${time}` : `From ${report.station}, ${report.distanceNm}\u00A0NM away, ${time}` // PROVISIONAL
}

/** "28R: headwind 5 kt, crosswind 3 kt from the right." (tailwind and left likewise). */
export function runwayComponentsText(runway: string, headwindKt: number, crosswindKt: number) {
  // Non-breaking spaces keep each word with its number and unit when the line wraps.
  const head = headwindKt >= 0 ? `headwind\u00A0${headwindKt}\u00A0kt` : `tailwind\u00A0${-headwindKt}\u00A0kt`
  const cross = crosswindKt === 0 ? "no crosswind" : `crosswind\u00A0${Math.abs(crosswindKt)}\u00A0kt from the ${crosswindKt > 0 ? "right" : "left"}`
  return `${runway}: ${head}, ${cross}.` // PROVISIONAL
}

/** "240° at 5 kt", "Variable at 5 kt", "240° at 12 kt, gusting 25 kt", or "Calm", for the ATIS wind. */
export function atisWindText(wind: { from: number | null; speedKt: number; gustKt: number | null }) {
  if (wind.speedKt === 0) return copy.live.windCalm
  const from = wind.from === null ? copy.live.windVariable : `${String(wind.from).padStart(3, "0")}°`
  const gust = wind.gustKt ? `, gusting\u00A0${wind.gustKt}\u00A0kt` : ""
  // Non-breaking spaces keep a number with its unit (and "at" with the direction) on one line when the text wraps.
  return `${from}\u00A0at\u00A0${wind.speedKt}\u00A0kt${gust}` // PROVISIONAL
}

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
}

/**
 * Legal and compliance correctif (copy-review-legal.md has the four options of each string). Calm option, approved 2026-10-18.
 */
export const legalCopy = {
  // Where publishing is refused or switched off (switch helper text, API error). Same sentence everywhere.
  publishOnlyOwnDesigns: "Flight plans converted from FlightRadar24 or FlightAware files can't be published.",
  // A plan an admin took off Explore: the owner sees this, never a reason.
  planNotAvailable: "This flight plan isn't available on Explore right now.",
  // Short tag beside a view or a download of a plan.
  simulationOnly: "Simulation only: not the published procedure",
  // The publish dialog, the same from every place a plan can be published. Imported plans add the checkbox.
  // Bump the version in DECLARATION_WORDING_KEY below whenever the title, body or checkbox wording changes.
  declarationTitle: "Do you have the right to share this flight plan?",
  declarationBody: "Publishing it shows it to the community.",
  // The checkbox label is this text, then the link, then the full stop.
  declarationCheckbox: "I created this flight plan, or I have the right to share it, and it does not come from a source that forbids sharing. See the",
  declarationTermsLink: "Terms",
  declarationConfirm: "Share it",
  declarationCancel: "Not now",
  declarationRequired: "Confirm you have the right to share this flight plan.",
  // Report control and form.
  reportLink: "Report",
  reportTitle: "Report this flight plan",
  reportIntro: "Tell us what's wrong. Only the admins see your report.",
  reportReasonInappropriate: "Inappropriate content",
  reportReasonCopyright: "Copyright infringement",
  reportReasonWrongData: "Wrong or broken data",
  reportReasonSpam: "Spam",
  reportReasonOther: "Something else",
  reportDetailsPlaceholder: "Details (optional)",
  reportSend: "Send report",
  reportThanksTitle: "Thanks for your report",
  reportThanksBody: "An admin will look at it.",
  reportError: "Couldn't send your report. Please try again.",
  reportOwnPlan: "This is your own flight plan.",
} as const

/** What is stored with each declaration instead of its text: the checkbox key and the version of its wording. */
export const DECLARATION_WORDING_KEY = "declarationCheckbox@1"
