# Export without arrival: design and implementation plan

Date: 2026-11-26. Status: **approved by Gab and built on 2026-11-26** (results and known limits at the end).

## Goal

Infinite Flight's AI ATC rejects custom arrival paths at the destination and asks for a published approach.
Let the pilot download a plan without the airborne arrival, keeping the destination as the last element, so
STAR and approach can be added inside Infinite Flight. Arrival ground movements stay in the file unless the
pilot already removed them with the existing switch. The plan in the editor is never modified.

Out of scope: trimming the departure (the API leaves room for it), generating or suggesting STARs/approaches.

## What the code does today

| Topic | Fact |
|---|---|
| Export | `performExport` in `components/flight-plan-editor.tsx`: branding overlay, `generateFPL` (`lib/fpl-generator.ts`), `saveFplInBrowser`, then saves the plan as `exported` (locked) |
| Export dialog | **None.** "Export FPL" downloads at once; options sit on the page (Options tab in Convert, row under the table in Sketch) |
| Other downloads | Dashboard, share link and library rebuild the `.fpl` server-side from the saved waypoints (3 routes under `app/api/`) |
| Convert map and list | `components/map-preview.tsx`, `components/editor/waypoint-list.tsx` |
| Sketch map and list | `components/draw-map.tsx` (via `drawing-board.tsx`), `components/waypoint-table.tsx` |
| Existing preview style | Ground trim already greys and dashes "will be removed" waypoints (`ghostIds`) |
| Phase split | `lib/route-phases.ts` decides the Departure / Cruise / Arrival tabs from level stretches |
| Branding | MADE / WITH / INFINITE / PLANNER are always the four waypoints before the destination |
| Ground movements | `planTrim` (`lib/ground-trim.ts`) finds the rollout and taxi points; the switch removes them, and the touchdown point then becomes the destination |

## Checked on real files (2026-11-26)

- `scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml`: **every altitude is 0**, so it uses the fallback. The 120 NM
  rule picks KEGIT, 141 NM along the route (134 NM direct). Ground detection (approximate) keeps RW09L, so the
  file ends KEGIT, RW09L, EGLL and 8 waypoints are removed.
- `test-kml/` LFPG to KIAH: cruises at FL340, steps down to FL320 at 268 NM, holds it from 250 to 200 NM, then
  descends. The original rule (last point within 1,000 ft of the highest altitude) puts TOD at 268 NM; the rule
  below puts it at 200 NM, cut at 127 NM / 28,450 ft. There is no waypoint between 200 and 127 NM. Ground
  detection keeps 21 points from touchdown (1.4 NM from KIAH), so 30 waypoints are removed.
- On both files, detection finds nothing more to remove once the ground switch has been applied.

## Decisions

| # | Topic | Decision | State |
|---|---|---|---|
| 1 | Toggle placement (there is no export dialog) | On the page, just above "Export FPL" (panel footer in Convert, export block in Sketch), so the map stays visible while moving the cut | Proposed |
| 2 | Dashboard, share link, library | The entire plan, never trimmed. Only the file downloaded from the editor is trimmed. No migration | Confirmed by Gab |
| 3 | "Made with Infinite Planner" | The usual rule on whatever is exported: the last four waypoints before the destination. So on the taxi points when they are kept, otherwise just before the cut | Confirmed by Gab |
| 4 | Top of descent | From the altitudes of the imported plan: where it leaves its last cruise level (rules below). Replaces the "highest altitude minus 1,000 ft" rule of the request | Proposed |
| 5 | Arrival ground movements | Never removed by this feature. Kept in the file unless the pilot removed them with the switch. The gap is between the cut point and the first ground waypoint (touchdown) | Confirmed by Gab |

With fewer than four ground points, the names spill onto the waypoints before the gap (AeroHub sample: the two
before KEGIT, KEGIT and RW09L). On AeroHub plans the four real names are replaced, as in a full export today.

## Approaches considered

- **A. Pure trim function applied at export time, browser only (chosen, decision 2).** Small, testable, no
  database change. Re-downloads elsewhere give the entire plan, which is what Gab wants.
- **B. Persist the cut with the saved plan** so re-downloads are trimmed too. Rejected by decision 2.
- **C. An editor edit like ground trimming.** Rejected: the editor plan must stay intact.

## Trim logic: `lib/export-trim.ts` (new, pure, no React)

```ts
export const TOD_BAND_FT = 1000        // points this close together are "level"
export const CRUISE_LEVEL_MIN_NM = 40  // a level stretch this long counts as cruise
export const CRUISE_FLOOR_SHARE = 0.6  // ...if it is this high, as a share of the highest altitude
export const FALLBACK_DISTANCE_NM = 120

// Functions and signatures: see docs/superpowers/plans/2026-11-26-export-without-arrival.md
```

Rules:

1. Only altitudes above 0 are used (dragged or inserted points have 0). Distances are along the route.
2. Cruise level = a stretch of waypoints within `TOD_BAND_FT` of each other, at least `CRUISE_LEVEL_MIN_NM` long
   (10% of the route if that is shorter) and above `CRUISE_FLOOR_SHARE` of the highest altitude.
3. TOD = the last waypoint of the last cruise level: after it the plan only descends, apart from shorter or lower
   level-offs. Step climbs and step downs in cruise are therefore handled wherever they happen. If there is no
   cruise level at all: the last point within `TOD_BAND_FT` of the highest altitude.
4. Ground start comes from `planTrim(points, airport, "arrival")`: the waypoint before the first one it would
   remove (touchdown), or the destination if it would remove nothing. Everything from there on is kept. A ground start
   above 15,000 ft is ignored: it is a file that stops in cruise, with no runway data.
5. Default cut = first waypoint after TOD. If none lies before the ground start, the TOD waypoint.
6. Altitudes unusable (fewer than 3 usable points, spread under 1,000 ft, or nothing below the TOD altitude minus the band after TOD):
   last waypoint at least `FALLBACK_DISTANCE_NM` from the destination **along the route**, flagged estimated.
7. Allowed range: from the end of the departure (`splitPhases`) to the waypoint before the ground start. The
   default is clamped into it, so a short hop keeps its departure. Empty range: the summary says there is no
   arrival to remove and the entire plan is exported.
8. The summary counts the waypoints between the cut and the ground start; its distance is along the original
   route from the cut to the destination.

`lib/route-phases.ts` already finds level stretches (15 NM) for the Arrival tab. Its finder is exported with the
minimum length as a parameter and reused, so there is one detector; the tabs keep 15 NM and their tests must still
pass. The tab and the cut can differ when a 15 to 40 NM level-off sits in the descent.

Branding moves unchanged from the editor to `lib/branding.ts`. A trimmed export is: remove branding, trim,
apply branding. `generateFPL` is not touched.

## State: `hooks/use-arrival-cut.ts` (new)

- Loads the destination's runway data (the editor's `loadAirport`) while enabled; if that fails it uses the same
  fallback as the ground switch. Export waits until it is ready.
- `enabled`: default off, remembered in `localStorage` (`infinite-planner:export-without-arrival`), in try/catch.
- Hand-picked cut stored as a waypoint id; none means the default, recomputed as the plan changes.
- A picked waypoint that is deleted or leaves the range falls back to the default. A new import or cleared sketch resets it.
- A hand-picked cut drops the "estimated" flag.
- The toggle is not part of the save fingerprint: after a full export, a trimmed one downloads without a new dashboard row.

## UI

- `components/editor/export-without-arrival.tsx` (new): switch, summary line ("14 waypoints removed · 62 NM before
  LFPG", plus "estimated"), and "Move cut point".
- "Move cut point" arms a pick mode: the next click on a map point or list row sets the cut; Cancel or Escape leaves.
  Normal clicks (select, scroll to row, drag) are unchanged outside it. It turns off map editing while armed, and
  on a phone the sheet drops to its low position.
- Strings go in `lib/copy.ts` marked `// PROVISIONAL` until Gab gives final copy (this blocks production builds).

## Map marker

- `map-preview.tsx`: new props `cutId` and `pickingCut`. Its own effect keeps one non-interactive Leaflet `divIcon`
  marker (`.ip-cut`, scissors badge above the dot) on the last kept waypoint. Removed waypoints reuse the ghost
  style, merged with any ground-trim preview; kept ground points and the destination stay normal. The cut point, and every point
  while picking, are exempt from dot thinning.
- `draw-map.tsx`: same marker; removed points use a grey icon; picking suspends the drawing tools.
- Lists: a "cut" badge on the cut row, removed rows dimmed.
- No change to the altitude strip.

## Files

New: `lib/export-trim.ts`, `lib/branding.ts`, `hooks/use-arrival-cut.ts`,
`components/editor/export-without-arrival.tsx`, `scripts/test-export-trim.ts`.

Edited: `components/flight-plan-editor.tsx`, `components/map-preview.tsx`, `components/draw-map.tsx`,
`components/draw-map-wrapper.tsx`, `components/drawing-board.tsx`, `components/editor/waypoint-list.tsx`,
`components/waypoint-table.tsx`, `components/editor/workspace.tsx`, `lib/route-phases.ts`, `app/globals.css`, `lib/copy.ts`, `package.json` (`test:export-trim`), `CHANGELOG.md`.

Not touched: `lib/fpl-generator.ts`, `lib/ground-trim.ts` (reused as is), API routes, Supabase.

## Tests

`pnpm test:export-trim`: normal profile; step climbs; step down in cruise (near and far); step descents with
level-offs, including one over 40 NM (documents that it moves TOD later); the LFPG-KIAH shape; short hop; TOD with only the destination after it; missing, flat and all-zero altitudes (fallback);
route shorter than 120 NM; arrival ground points kept, already removed, and absent; fewer than four ground points
with branding; branding on and off; toggle off gives byte-identical XML to today's pipeline.

In the browser (dev server): both Convert and Sketch, desktop and phone width.

In Infinite Flight (Gab): YPPH-EGLL, a European short haul, a KJFK arrival, each **with and without arrival
ground points**. Import, add STAR and ILS, check they attach in the gap after the cut with no backtracking, and
that AI ATC accepts the approach request.

## Order of work

Branch `feature/export-without-arrival` from `staging`.

0. **In-game proof first:** produce trimmed `.fpl` files by script (both variants), before any UI, and Gab tests
   them. If Infinite Flight does not attach the procedures, the design changes here. Needs a European short haul and a KJFK KML.
1. Trim library and tests.
2. State, toggle, export.
3. Maps and lists.
4. Copy, changelog, browser check. Pull request to `staging`.

## Assumptions to verify

- ASSUMPTION, **highest risk**: with ground points kept, Infinite Flight lets the STAR and approach go into the gap
  before them (not after them), and AI ATC does not treat them as a custom arrival path. The original request
  assumed the destination was the only element after the cut. If this fails: leave ground points out of trimmed
  files, or tell pilots to use the ground switch.
- ASSUMPTION: ground detection is right. Where it finds nothing although taxi points exist, they are removed with
  the arrival.
- ASSUMPTION: Infinite Flight attaches STAR and approach when the last element is a `USER WAYPOINT` named with the
  destination ICAO, at the position where the imported track ends.
- ASSUMPTION: a level-off during the descent is shorter than 40 NM or below 60% of cruise altitude. A longer,
  higher one is read as cruise and moves the cut later (the pilot can move it).
- ASSUMPTION: AeroHub files carry no altitudes (one sample). Their own `TOD` marker is dropped at import; using it
  is not part of this plan.
- ASSUMPTION: the default cut falls before the STAR's first fix often enough. It can land inside a long STAR and
  cause backtracking; the in-game tests will show it.

## Local prerequisite

`pnpm test:*` needs `esbuild` from Homebrew (see `RESTORE.md`). It is installed on this Mac and
`pnpm test:route-phases` passes (2026-11-26).

## Built and reviewed (2026-11-26)

Gab approved the on-screen wording on 2026-11-26; the strings are no longer marked provisional.

Gab imported the four script-made test files (LFPG-KIAH and YPPH-EGLL, with and without taxi points) into Infinite
Flight: all worked. A European short haul and a KJFK arrival are still to be tested.

Independent review: nothing critical or important. Followed up the same day: a cut that leaves nothing out now says
there is no arrival to remove; high cruise points are no longer read as ground movements; the cut can be picked with
the keyboard in Convert; the list badge uses the map's colour token.

Known limits, not fixed:

- The summary is a live region and may be announced again after waypoint edits.
- In Sketch, one Escape cancels both a pen drag and pick mode.
- A saved AeroHub draft reopened with the branding shows numbers once unticked: only the branded names are stored.
