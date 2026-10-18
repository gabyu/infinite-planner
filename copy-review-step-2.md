# Copy review, step 2: editor workspace

All keys are in `lib/copy.ts` under `editor`. The text in the catalog is the **Calm** option. On 2026-10-18 Gabriel approved the Calm text as it stands for the first production release (the `// PROVISIONAL` markers were removed); the other options below stay here to switch to later.
Reply with a choice per row (or per block), e.g. "Panel: Short, Toolbar: Calm, Altitude: Fun".
Most strings here are short UI labels, so the options differ mostly in wording and length. Nothing here is consent, privacy or data-loss text, so no option is marked not recommended except where noted.

Character limits: buttons and toolbar labels ≤ 24, tooltips ≤ 40, aria-labels ≤ 60.

## Panel

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `panelCollapse` | Handle on the panel's right edge, panel open (tooltip + aria-label) | Collapse the side panel | Hide panel | Hide | Clear the cockpit |
| `panelExpand` | Same handle, panel hidden | Expand the side panel | Show panel | Show | Back to the cockpit |
| `statsDistance` | Panel header, stats row | Route distance | Distance | Dist. | Distance flown |
| `statsWaypoints` | Same | Waypoint count | Waypoints | Points | Waypoints |
| `statsMaxAltitude` | Same | Maximum altitude | Max altitude | Max alt. | Peak altitude |
| `statsFlightTime` | Same, only when a flight time is set | Flight duration | Flight time | Time | Time in the air |
| `detailsHeading` | Reserved (flight number and time block heading, not shown yet) | Flight information | Flight details | Details | Flight deck |
| `waypointsHeading` | Header of the waypoint list | Waypoint list | Waypoints | Route | Along the route |
| `selectAll` | aria-label of the select-all checkbox | Select all waypoints in the list | Select all waypoints | Select all | Select the whole route |
| `deleteSelected` | Trash button of the list, tooltip + aria-label | Delete the selected waypoints | Delete selected waypoints | Delete | Remove selected waypoints |
| `clearAltitudes` | Mountain button of the list | Reset the altitude of the selected waypoints to zero | Clear altitudes of selected waypoints | Clear altitudes | Bring selected waypoints down to earth |
| `waypointName` | aria-label of a row's name field | Name of the waypoint | Waypoint name | Name | What do we call this one? |
| `waypointAltitude` | aria-label of a row's altitude field | Altitude in feet | Altitude in feet | Alt. (ft) | How high? (ft) |
| `waypointLatitude` / `waypointLongitude` | aria-labels of the coordinate fields | Latitude / Longitude | Latitude / Longitude | Lat / Lng | Latitude / Longitude |
| `waypointLimit` | Reserved (warning past 250 waypoints, not shown yet) | The plan exceeds the 250 waypoint limit | Over the 250 waypoint limit | Max 250 waypoints | That's a lot of waypoints: 250 is the limit |
| `optionsHeading` | Collapsible row above Export, holding flight number, flight time, TXT import, the prefix tool and the Made with option | More settings | Options | Options | Under the hood |
| `optionsHint` | Grey text on that row while it is closed, so it is clear it opens | Flight number, flight time and ground movements | Flight number, flight time, ground movements | Number, time, ground | Callsign, time in the air, taxi trimming |
| `sheetHandle` | Phone only: aria-label of the bottom sheet handle | Drag to resize the panel, or press Enter to change its height | Drag to resize the panel | Resize | Drag to pull the panel up |


## Leaving the editor (Convert link in the header, plan not exported or saved)

Shown when the person clicks Convert in the site header while a plan that is neither exported, downloaded nor saved as a draft is on screen. It warns about lost work: **Fun** is not recommended for any of these.

| Key | Where / when | Serious | Calm (current) | Short | Fun (not recommended) |
|---|---|---|---|---|---|
| `leaveTitle` | Dialog title | Discard this flight plan? | Are you sure you want to go back? | Go back? | Leaving so soon? |
| `leaveBody` | Dialog text | This flight plan has not been exported or saved. Going back permanently discards your work. | This flight plan hasn't been exported or saved. Going back erases everything you created. | Unsaved work will be lost. | Your flight plan hasn't landed anywhere yet: going back wipes it. |
| `leaveStay` | Button that closes the dialog | Keep editing | Stay | Stay | Keep flying |
| `leaveConfirm` | Destructive button | Discard and go back | Go back and erase | Erase | Scrap the flight |

## Map toolbar (top right of the map)

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `editWaypoints` | Button, map not in edit mode | Edit waypoints | Edit waypoints | Edit | Take the controls |
| `doneEditing` | Same button in edit mode | Finish editing | Done editing | Done | Hands off |
| `selectPoints` | Button, edit mode only | Select multiple points | Select points | Select | Lasso points |
| `doneSelecting` | Same button in select mode | Finish selecting | Done selecting | Done | Release the lasso |
| `deleteWaypoints` | Button, select mode with a selection | Delete selected | Delete | Delete | Drop them |
| `fitRoute` | Icon tooltip + aria-label | Fit the route to the view | Fit route | Fit | Show the whole flight |
| `zoomIn` / `zoomOut` | Icon tooltips + aria-labels | Zoom in / Zoom out | Zoom in / Zoom out | + / - | Closer / Farther |
| `zoomToDeparture` | Icon tooltip | Zoom to the departure airport | Zoom to departure | To departure | Back to the gate |
| `zoomToArrival` | Icon tooltip | Zoom to the arrival airport | Zoom to arrival | To arrival | Straight to touchdown |
| `mapLoading` | While the map library loads | Loading the map | Loading map... | Loading... | Warming up the engines... |
| `mapStyle` | Menu button (layers icon), tooltip + aria-label, and the menu's title | Choose the map style | Map style | Style | Pick your scenery |
| `styleAuto` | Menu choice: follows the site's light or dark theme | Automatic (follows the site theme) | Auto | Auto | Follow the sun |
| `styleLight` / `styleDark` | Menu choices | Light / Dark | Light / Dark | Light / Dark | Daylight / Night flight |
| `styleColour` | Menu choice: the soft-colour map | Colour | Colour | Colour | Full colour |
| `altitudeColours` | Menu switch: colour the route by altitude | Colour the route by altitude | Altitude colours | Altitude | Paint the climb |

The "Drag to select" banner, "N selected", "Clear" and the edit-mode messages are existing copy and were not touched.

## Altitude strip (under the map, desktop, closed until opened)

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `altitudeHeading` | Strip title | Altitude profile | Altitude profile | Altitude | Climb and descent |
| `altitudeShow` | aria-label, strip collapsed | Show the altitude profile | Show altitude profile | Show | Show the vertical profile |
| `altitudeHide` | aria-label, strip open | Hide the altitude profile | Hide altitude profile | Hide | Hide the vertical profile |
| `altitudeNone` | Strip body when every waypoint is at 0 ft | This plan has no altitude data | No altitude data in this plan yet. | No altitudes yet. | Nothing but runway so far. |
| `altitudeLabel(cruise, distance)` | Screen reader label of the graph | Altitude profile: cruises at FL370 over 5,420 NM | Altitude profile: cruises at FL370 over 5,420 NM | FL370, 5,420 NM | (same as Calm: accessibility text stays literal) |

## Not covered yet

Strings for the later steps (ground movements, export and result screen, sign-in card) come with their steps.
Existing strings the new layout still shows are untouched: "Made with", "Flight number", "Flight time" help texts, "Export FPL", the save status line (one sentence changed: "Your draft starts saving as soon as the plan is imported", which replaces "once you close the map" because there is no map to close now), the success and error messages.

## Ground movements (step 3, in the Options row)

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `groundHeading` | Title of the block in Options | Ground movements | Ground movements | Ground | Taxi time |
| `groundHint` | Line under the title | Removes the waypoints recorded on the ground before take-off and after landing | Remove the taxi before take-off and after landing | Trim taxi and rollout | Skip the taxi, start at the runway |
| `trimDeparture` / `trimArrival` | The two toggle buttons | Departure / Arrival | Departure / Arrival | Takeoff / Landing | Takeoff / Touchdown |
| `trimApply` / `trimCancel` | Bar above the waypoint list during the preview | Apply / Cancel | Apply / Cancel | OK / Cancel | Do it / Never mind |
| `trimApproximate` | Under the count when no runway matched (estimated from the airport area) | Approximate: no runway data matched, estimated near the airport | Approximate | Approx. | Best guess |
| `trimNone` | Toast when there is nothing to remove | No ground movements found in this plan | No ground movements found | Nothing to trim | Already on the runway |
| `trimLoading` | Reserved (not shown yet) | Retrieving runway data | Looking at the runways... | Loading... | Checking the runways... |
| `trimUndo` | Toast button after applying | Undo | Undo | Undo | Undo |
| `trimBrandingNote` | Toast text when trimming dropped the plan under the Made with minimum | The plan is now too short for the Made with Infinite Planner waypoints, which were removed | The plan is now too short for Made with Infinite Planner, so it was left out. | Too short for Made with: removed. | Too short to sign: we left our name off. |
| `trimPreviewText(n, end)` | Count while previewing | 7 waypoints will be removed before take-off | 7 waypoints will be removed before take-off | Remove 7 before take-off | 7 waypoints to shed before take-off |
| `trimRemovedText(n)` | Toast title after applying | 7 waypoints have been removed | 7 waypoints removed | 7 removed | 7 waypoints gone |

## Flight numbers (several per flight)

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `flightNumbersLabel` | Options, title of the field (also its aria-label) | Flight numbers | Flight numbers | Numbers | Callsigns |
| `flightNumberPrimary` | Tooltip on the first chip | Primary flight number | Main flight number | Main | The one on the ticket |
| `flightNumberRemove` | aria-label start of each chip's cross ("Remove AF69") | Remove | Remove | Remove | Drop |
| `flightNumberPlaceholder` | Empty field | e.g. AF69 | e.g. AF69 | AF69 | e.g. AF69 |
| `flightNumberAddPlaceholder` | Field once there is a number | Add a codeshare | Add another | Add | And its codeshares... |
| `flightNumbersHelp` | Help tooltip next to the title | Optional. Read from the file name when it carries one. Enter the other numbers this flight operates under, confirming each with Enter. The first is the primary number. Letters and digits, up to 12 characters each, at most 6. Saved with the plan. | Optional. Read from the file name when it carries one. Add the other numbers the flight goes by (codeshares), then press Enter. The first is the main one. Letters and digits, up to 12 each, up to 6. Saved with the plan. | Optional. Press Enter after each number. First = main. Up to 6, letters and digits. | Same flight, several names? Add the codeshares and press Enter: the first is the star of the show. |

## Visibility switch (editor footer, plan page, dashboard)

The label says what the switch does and sits on the left; the switch is always on the right. One sentence under it says the current state, and "Copy link" sits at the end of that same line once the plan is public, so nothing moves. Keep the two sentences short enough to share a line with "Copy link" in the 328 px panel (about 32 characters).

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `label` | Next to the switch | Publish on Explore | Publish on Explore | Share on Explore | Put it on the map (Explore) |
| `labelShort` | Dashboard table only (the column is already titled Visibility) | Public | Public | Public | On the map |
| `helperPrivate` | Under the label, switch off | Visible only to you | Only you can see this plan. | Only you | Just between us |
| `helperPublic` | Under the label, switch on | Visible to everyone on Explore | Everyone can see it on Explore. | Public on Explore | The whole hangar can see it |
| `copyLink` | End of that line, once public | Copy the link | Copy link | Copy | Grab the link |
| `copied` | Same, for 2 seconds after copying | Link copied to the clipboard | Link copied | Copied | Link on board |

Removed from this place: the star ("feature on my profile"). It stays in the dashboard row menu.
Existing and untouched: the consent dialog on the first publication, and the error messages.
