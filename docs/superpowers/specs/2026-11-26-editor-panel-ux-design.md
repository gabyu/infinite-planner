# Editor panel: less clutter, a two-step airport flow

Date: 2026-11-26. Status: waiting for Gab's approval.

## Intent
The left panel is overloaded while editing: texts repeat, the airport card and the waypoint list scroll separately
(about 1.5 rows of waypoints visible), and the export block takes about 280 px. Make the flow read in order:
pick the runway from the ATIS and wind, then load or save a procedure, then everything folds away.

Not a goal: changing what is exported, saved or published, the database, or the map.

## Approaches
1. **Rework the existing components, add a small step wrapper** (chosen): keeps the tested logic in `AirportCard`,
   `RunwayGuides` and the export hooks. Smallest risk.
2. New panel component, rewritten: cleaner file, but `flight-plan-editor.tsx` carries too much state to move safely now.
3. Tighter spacing and fewer texts only: quick, but no two-step flow.

## Departure and Arrival tabs (same behaviour)
```
OPEN                              DONE
┌──────────────────────────┐      ┌──────────────────────────────┐
│ LFPG                   ^ │      │ ✓ LFPG 08R · 164 NM · 132° v │
│ 1 Runway                 │      └──────────────────────────────┘
│  [08R] [09L]             │       Waypoints · 35
│  08R: headwind 8 kt, …   │
│  Show the ATIS text      │
│ 2 Procedure              │
└──────────────────────────┘
After the runway tap:
│ ✓ 1 Runway  08R   change │
│ 2 Procedure              │
│  Yours  East 164 NM [Save]│
│  ─────                   │
│  East   151 NM · 140°  ✓ │
│  South  151 NM · 178°    │
│                Keep mine │
```
- One step open at a time. Step 1 closes when the pilot taps a runway tile, including one the ATIS or wind
  pre-selected. `change` reopens it.
- The block folds after Apply, Save or Keep mine. The chevron reopens it. The state survives tab switches, is reset when
  the airport or the runway changes, and is not kept after a reload. On a phone the block starts folded, as today.
- Procedure rows: one line, `Direction · NM · bearing`, check mark when it is the one in the plan. No runway pill, no
  date, no "Suggested procedures for" heading.
- A row tap previews on the map and shows Delete and Apply. Apply acts at once (the confirmation box goes; the toast
  keeps Undo). The "Original · Restore" row stays.
- No access to procedures (signed out or role gate): step 1 only, no step numbers.

Texts kept: wind components (rounded to whole knots; fixes `8.166687797910065 kt`), "Show the ATIS text",
runway-not-in-ATIS warning (shortened), "Tap a runway.", the different-heading warning, and the state messages
(loading, no ATIS, data unavailable, runways not read, no weather, plan must be saved, plan locked).

Texts removed: ATIS letter and wind in the title line, "From the ATIS.", "Best headwind." and the other tone sentences
on screen (tooltips keep them), "Light wind", "Not in the ATIS now.", the METAR/NOAA line and the "Live from the
Infinite Flight Expert Server" line.

## Waypoint list
One line per point (number, name, altitude). Latitude and longitude appear on the selected or focused row. The airport
block and the list scroll together; the "Waypoints · N" bar stays stuck at the top.

## Options tab
- **Flight** (open): Flight numbers, Aircraft, Flight time.
- **Waypoints** (folded): Departure taxi and Arrival taxi switches (moved from the two tabs, preview with Apply/Cancel
  under the switch), Import TXT, Waypoint prefix, Made with Infinite Planner.
- The header chips "#" and "AC" still open the Flight group and focus the field.

## Bottom block
```
Without arrival (?)   Move cut point  (●)
Publish on Explore (?)                ( )
[            ↓ Export FPL               ]
```
- (?) opens a popover: the AI ATC sentence; for publishing, the current visibility or why the switch is off.
- The "N waypoints removed" summary goes from the screen (kept for screen readers). "Click the last waypoint to keep",
  "No arrival to remove…" and "Looking at the runways..." still show, in place of Move cut point.
- A tracker-derived plan shows the publish switch disabled, with the existing legal sentence in its (?).
- The save status line goes. Save errors still show. An exported plan shows a lock next to the route; it opens
  "Exported and saved: this plan is locked." with the dashboard link.
- Sketch shares this block, so it gets the same two rows; its lock sits next to Export FPL.

## Messages
In the Convert panel, success messages and "Waypoint simplification applied" become toasts. Errors stay in the panel.

## New or changed UI copy (approval of this document approves it)
`Without arrival` · `Runway` · `Procedure` · `change` · `Yours` · `Keep mine` · `Flight` · `Waypoints` ·
`Departure taxi` · `Arrival taxi` · `Plan lands on 26L; the ATIS uses 08R.` /
`Plan departs 26L; the ATIS uses 08R.` · `Exported and saved: this plan is locked.`

## Retouches after the first staging test (2026-11-26, Gab's answers)
- Map: only square runway-number tags (no runway drawing), one per end, for the open Departure or Arrival tab, shown
  from zoom 13. With an ATIS only its runways are coloured (wind verdict), others grey; without, all follow the wind.
  A click chooses the runway. Opening the tab zooms to the airport.
- No procedure for the runway: "No suggested procedures" and "Use current".
- Options fields share one height.
- Publish on Explore: hidden for tracker-derived plans. Before export it is a stored wish (last choice of the browser,
  off the first time), confirmed in the publish dialog on Export; "Not now" exports privately and switches it off.
- Export FPL: edge to edge at the bottom of the panel; "Exporting...", then "Downloaded", then the button again. The
  export success messages go.

## Checks and delivery
`pnpm lint`, `pnpm check:copy`, runway/export tests, a local browser pass (desktop and phone width). Then merge into
`staging` and push, so Gab tests there. No migration. `main` and production are not touched.
