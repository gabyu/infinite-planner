# Copy review, step 2: editor workspace

All keys are in `lib/copy.ts` under `editor`. The text on staging today is the **Calm** option, marked `// PROVISIONAL`.
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
| `optionsHint` | Grey text on that row while it is closed, so it is clear it opens | Flight number, flight time, waypoint names and the Made with option | Flight number, flight time, names, Made with | Details, names, Made with | Flight number, flight time, name tags, our signature |
| `sheetHandle` | Phone only: aria-label of the bottom sheet handle | Drag to resize the panel, or press Enter to change its height | Drag to resize the panel | Resize | Drag to pull the panel up |


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
