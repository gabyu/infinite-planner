# Export without arrival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a pilot download an `.fpl` without the airborne arrival, so STAR and approach can be added in Infinite Flight.

**Architecture:** A pure module decides the cut from the waypoint altitudes and builds the file's waypoint list; it is applied only inside the editor's export. A hook holds the toggle and cut state; both maps and lists only display it.

**Tech Stack:** Next.js 14, React, TypeScript, Leaflet, esbuild + `node:assert` tests (no test runner).

**Spec:** `docs/superpowers/specs/2026-11-26-export-without-arrival-design.md`

## Global Constraints

- The editor's plan is never modified by this feature. Saved plans, dashboard, share and library downloads stay entire.
- Arrival ground waypoints are never removed by this feature. The destination stays last.
- Toggle default OFF; remembered in `localStorage` key `infinite-planner:export-without-arrival`, wrapped in try/catch.
- With the toggle OFF the XML is byte-identical to today's.
- `CRUISE_LEVEL_MIN_NM = 40`, `FALLBACK_DISTANCE_NM = 120`, level band 1,000 ft, cruise floor 0.6.
- Do not change `lib/fpl-generator.ts`, `lib/ground-trim.ts`, API routes or Supabase. No new dependency.
- New strings go in `lib/copy.ts`, each line ending `// PROVISIONAL`.
- Before any UI code (Tasks 2 to 4): `npx -y modern-web-guidance@latest search "<capability>"`, then `retrieve "<id>"`; list the ids used in the report.
- Branch `feature/export-without-arrival` from `staging`. `.gitignore`, `CLAUDE.md`, `RESTORE.md` and `public/images/zaidee.webp` hold changes that are not part of this work: add files by name, never `git add -A`.
- No push or deploy without Gab's go-ahead.
- Tests: `export NODE_PATH="$PWD/node_modules/.pnpm/node_modules"` once per terminal.
- Types: `node_modules/.bin/tsc --noEmit -p .` already reports 26 errors on `staging`; the count must stay 26. `pnpm lint` has no config in this repo: do not run it.

## Review Focus

1. The hand-picked cut waypoint is deleted, or falls in the landing after the ground switch: default cut again (test in Task 1, `resolveCut`).
2. A tracker file that stops mid-cruise: estimated fallback, destination kept (Task 1).
3. Altitude 0 on dragged or inserted points in cruise: ignored (Task 1).
4. Runway data fetch fails or unknown destination: fallback detection, Export not stuck disabled (Task 1 `fallbackAirport`, Task 2 manual check).
5. `localStorage` throws: toggle works, just not remembered (Task 1).

---

### Task 0: In-game proof (gate)

Done 2026-11-26: four files in `test-kml/export-without-arrival/` (gitignored), LFPG-KIAH and YPPH-EGLL, "A taxi kept" and "B no taxi".

- [ ] Gab imports each in Infinite Flight, adds STAR and ILS, and reports: do they attach in the gap, any backtracking, does AI ATC accept the approach request.
- [ ] If B works and A fails: stop, revise the spec's ground-point decision before Task 2. If both fail: stop, back to design.

Task 1 does not depend on the result. Tasks 2 to 5 do. A European short haul and a KJFK arrival are still to be tested.

### Task 1: Trim logic

**Files:**
- Create: `lib/branding.ts`, `lib/export-trim.ts`, `scripts/test-export-trim.ts`
- Modify: `lib/route-phases.ts`, `components/flight-plan-editor.tsx:139-159` (remove, import instead), `package.json`

**Interfaces:**
- Consumes: `planTrim`, `distanceM`, `TrimAirport` (`lib/ground-trim.ts`); `splitPhases`, `PhasePoint` (`lib/route-phases.ts`); `BRAND_NAMES`, `BRANDING_MIN_WAYPOINTS` (`lib/flight-plans.ts`).
- Produces:

```ts
// lib/route-phases.ts (new exports)
export const LEVEL_BAND_FT = 1000
export const LEVEL_FLOOR_SHARE = 0.6
/** First and last index on a cruise level at least `minLevelM` long, or null. `alongM[i]` is the route distance to point i. */
export function cruiseLevels(altitudes: number[], alongM: number[], minLevelM: number): { first: number; last: number } | null

// lib/branding.ts
export interface Brandable { name: string; locked?: boolean; branded?: boolean; unbrandedName?: string }
export function isBrandingSlot(index: number, total: number): boolean
export function applyBrandingOverlay<T extends Brandable>(waypoints: T[], include: boolean): T[]

// lib/export-trim.ts
export const CRUISE_LEVEL_MIN_NM = 40
export const FALLBACK_DISTANCE_NM = 120
export const WITHOUT_ARRIVAL_KEY = "infinite-planner:export-without-arrival"
export interface ArrivalCutOptions { min: number; max: number; defaultIndex: number; estimated: boolean; resumeAt: number }
export interface ArrivalCut { after: number; resumeAt: number }
export function topOfDescent(points: PhasePoint[]): number | null // null: altitudes unusable
export function fallbackAirport(points: PhasePoint[]): TrimAirport // {elevationFt: null, last point, runways: []}
export function arrivalGroundStart(points: PhasePoint[], airport: TrimAirport): number
export function arrivalCutOptions(points: PhasePoint[], airport: TrimAirport): ArrivalCutOptions | null
export function resolveCut(options: ArrivalCutOptions, picked: number | null): { index: number; estimated: boolean }
export function trimRoute<T extends PhasePoint>(points: T[], cuts: { arrival?: ArrivalCut }):
  { kept: T[]; removed: T[]; distanceToDestinationNm: number }
export function buildExportWaypoints<T extends PhasePoint & Brandable>(
  waypoints: T[], options: { includeBranding: boolean; arrival?: ArrivalCut }): T[]
export function loadWithoutArrival(storage: Pick<Storage, "getItem"> | undefined): boolean // "1" is on
```

- [ ] **Step 1:** `git switch -c feature/export-without-arrival staging`, then add to `package.json` scripts:

```json
"test:export-trim": "esbuild scripts/test-export-trim.ts --bundle --platform=node --format=cjs --alias:@=. --conditions=react-server | node",
```

- [ ] **Step 2: Write the failing test** `scripts/test-export-trim.ts`:

```ts
// Run with `pnpm test:export-trim`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { generateFPL } from "@/lib/fpl-generator"
import { parseAeroHubKml } from "@/lib/partners/aerohub-parser"
import {
  arrivalCutOptions, buildExportWaypoints, fallbackAirport, loadWithoutArrival, resolveCut, topOfDescent, trimRoute,
} from "@/lib/export-trim"

// [nautical miles from the origin, feet], due east along the equator.
type Profile = [number, number][]
const line = (p: Profile) => p.map(([nm, altitude], i) => ({ name: String(i).padStart(3, "0"), lat: 0, lng: nm / 60.04, altitude }))
const options = (p: Profile) => arrivalCutOptions(line(p), { ...fallbackAirport(line(p)), elevationFt: 0 })
const tod = (p: Profile) => topOfDescent(line(p))

const NORMAL: Profile = [[0,0],[5,3000],[40,20000],[100,35000],[400,35000],[880,35000],[920,24000],[960,10000],[1000,0]]

// Top of descent
assert.equal(tod(NORMAL), 5)
// step climbs
assert.equal(tod([[0,0],[50,20000],[100,31000],[400,31000],[420,33000],[700,33000],[720,35000],[880,35000],[940,18000],[1000,0]]), 7)
// step down far from the destination
assert.equal(tod([[0,0],[100,39000],[1000,39000],[1020,35000],[2000,35000],[2850,35000],[2920,20000],[3000,0]]), 5)
// short level-offs in the descent do not move it
assert.equal(tod([[0,0],[100,37000],[500,37000],[850,37000],[880,24000],[900,24000],[930,12000],[950,12000],[1000,0]]), 3)
// a high level-off of 40 NM or more counts as cruise (accepted limit)
assert.equal(tod([[0,0],[100,37000],[850,37000],[880,24000],[925,24000],[960,10000],[1000,0]]), 4)
// the LFPG-KIAH shape: a 50 NM step down close to the destination
assert.equal(tod([[0,0],[100,34000],[700,34000],[732,34000],[750,32000],[800,32000],[873,28000],[950,9000],[1000,0]]), 5)
// short hop
assert.equal(tod([[0,0],[20,10000],[40,18000],[60,18000],[90,18000],[120,8000],[150,0]]), 4)
// zero altitude in cruise is ignored
assert.equal(tod([[0,0],[100,35000],[400,0],[880,35000],[920,20000],[1000,0]]), 3)
// unusable: all zero, flat, file ending in cruise
assert.equal(tod([[0,0],[100,0],[500,0],[1000,0]]), null)
assert.equal(tod([[0,35000],[500,35000],[1000,35000]]), null)
assert.equal(tod([[0,1000],[100,35000],[500,35000],[900,35000]]), null)

// Cut options
assert.deepEqual(options(NORMAL), { min: 3, max: 7, defaultIndex: 6, estimated: false, resumeAt: 8 })
const TAXI: Profile = [[0,0],[100,35000],[880,35000],[920,24000],[960,10000],[999,0],[999.5,0],[1000,0]]
assert.deepEqual(options(TAXI), { min: 1, max: 4, defaultIndex: 3, estimated: false, resumeAt: 5 })
// the ground switch already applied: nothing left but the destination
assert.equal(options(TAXI.slice(0, 6))!.resumeAt, 5)
// nothing between top of descent and the ground: the top of descent itself
assert.equal(options([[0,0],[100,35000],[880,35000],[999,40],[999.5,40],[1000,40]])!.defaultIndex, 2)
// fallback: last waypoint at least 120 NM out, flagged
assert.deepEqual(options([[0,0],[200,0],[700,0],[850,0],[900,0],[960,0],[1000,0]]), { min: 1, max: 5, defaultIndex: 3, estimated: true, resumeAt: 6 })
assert.equal(options([[0,1000],[100,35000],[500,35000],[900,35000]])!.defaultIndex, 2)
// route shorter than 120 NM, and nothing to cut
assert.deepEqual(options([[0,0],[30,0],[60,0],[100,0]]), { min: 1, max: 2, defaultIndex: 1, estimated: true, resumeAt: 3 })
assert.equal(options([[0,0],[100,0]]), null)

// A picked cut: used inside the range, ignored outside it
const range = { min: 1, max: 4, defaultIndex: 3, estimated: true, resumeAt: 5 }
assert.deepEqual(resolveCut(range, null), { index: 3, estimated: true })
assert.deepEqual(resolveCut(range, 2), { index: 2, estimated: false })
assert.deepEqual(resolveCut(range, 5), { index: 3, estimated: true })
assert.deepEqual(resolveCut(range, -1), { index: 3, estimated: true })

// Trim: keeps the ground block, reports the original distance
const trimmed = trimRoute(line(TAXI), { arrival: { after: 3, resumeAt: 5 } })
assert.deepEqual(trimmed.kept.map((w) => w.name), ["000", "001", "002", "003", "005", "006", "007"])
assert.deepEqual(trimmed.removed.map((w) => w.name), ["004"])
assert.equal(Math.round(trimmed.distanceToDestinationNm), 80)

// Branding follows what is exported
const long = line(Array.from({ length: 12 }, (_, i) => [i * 100, 30000] as [number, number]))
const names = (cut: { after: number; resumeAt: number }, includeBranding = true) =>
  buildExportWaypoints(long, { includeBranding, arrival: cut }).map((w) => w.name)
// one ground point (010): the names cover it and the three waypoints before the gap
assert.deepEqual(names({ after: 7, resumeAt: 10 }), ["000","001","002","003","004","MADE","WITH","INFINITE","PLANNER","011"])
assert.deepEqual(names({ after: 7, resumeAt: 11 }), ["000","001","002","003","MADE","WITH","INFINITE","PLANNER","011"])
assert.deepEqual(names({ after: 7, resumeAt: 11 }, false), ["000","001","002","003","004","005","006","007","011"])
// too short for branding once trimmed
assert.deepEqual(names({ after: 2, resumeAt: 11 }), ["000", "001", "002", "011"])
// the input is untouched
assert.equal(long[7].name, "007")

// Toggle off: byte-identical to the export before this feature (hashes taken 2026-11-26)
const fixture = parseAeroHubKml(readFileSync("scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml", "utf8"), [])
assert.ok(fixture.ok)
const hash = (includeBranding: boolean) =>
  createHash("sha256").update(generateFPL(buildExportWaypoints(fixture.route.waypoints, { includeBranding }))).digest("hex")
assert.equal(hash(false), "47151d74fb179d55c41b589e6a54951a45584ac8e98832f484fa69a8bd7ebd8c")
assert.equal(hash(true), "bb2586f896db9faa94ba8d6dd4d127b889395809a0a8b78e756ffc3643be442f")

// Remembered toggle
assert.equal(loadWithoutArrival({ getItem: () => "1" }), true)
assert.equal(loadWithoutArrival({ getItem: () => null }), false)
assert.equal(loadWithoutArrival({ getItem: () => { throw new Error("blocked") } }), false)
assert.equal(loadWithoutArrival(undefined), false)

console.log("export-trim: all checks passed")
```

- [ ] **Step 3:** Run `pnpm test:export-trim`. Expected: FAIL, `Could not resolve "@/lib/export-trim"`.
- [ ] **Step 4:** In `lib/route-phases.ts`, move the level-stretch loop of `byAltitude` into `cruiseLevels` (floor = `LEVEL_FLOOR_SHARE` × highest of `altitudes`); `byAltitude` calls it with every point and its current minimum, behaviour unchanged. Run `pnpm test:route-phases`. Expected: `route-phases: all checks passed`.
- [ ] **Step 5:** Create `lib/branding.ts` by moving `isBrandingSlot` and `applyBrandingOverlay` verbatim from the editor; import them there.
- [ ] **Step 6:** Write `lib/export-trim.ts`:
  - `topOfDescent`: usable = altitude > 0, with distances along the **whole** route. Null if fewer than 3 usable or their spread < 1,000 ft. Call `cruiseLevels` on the usable altitudes and distances with `min(40 NM, 10% of route)`; TOD = its `last`, else the last usable point within 1,000 ft of the highest. Null if no usable point after TOD is below TOD altitude minus 1,000 ft. Return the index in `points`.
  - `arrivalGroundStart`: `planTrim(points, airport, "arrival")`; smallest removed index minus 1, else last index.
  - `arrivalCutOptions`: null under 3 points. `min = max(splitPhases(points).departureEnd, 1)`, `max = resumeAt - 1`, null if `max < min`. Default: TOD+1 if below `resumeAt`, else TOD; without TOD, the last index below `resumeAt` at least 120 NM (along route) from the last point, else `min`, with `estimated: true`. Clamp to `[min, max]`.
  - `trimRoute`: no cut returns everything; distance is along the original route from `after` to the last point.
  - `buildExportWaypoints`: no cut → `applyBrandingOverlay(waypoints, include)`; cut → remove branding, trim, apply branding.
- [ ] **Step 7:** Run `pnpm test:export-trim`, `pnpm test:route-phases`, `pnpm test:ground-trim`. Expected: all pass. Type count stays 26.
- [ ] **Step 8:** `git add` the six files by name; commit `Export without arrival: trim logic and tests`. Commit the spec and this plan in a second commit.

### Task 2: Toggle and export

**Files:**
- Create: `hooks/use-arrival-cut.ts`, `components/editor/export-without-arrival.tsx`
- Modify: `components/flight-plan-editor.tsx` (`performExport`, `exportButtons`, `applyParsedImport`, `clearDrawing`, `WaypointTable.exportDisabled`), `lib/copy.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:

```ts
export function useArrivalCut(input: {
  waypoints: { id: string; lat: number; lng: number; altitude: number }[]
  destination: string; destinationValid: boolean
  loadAirport: (icao: string) => Promise<TrimAirport | null>
}): {
  enabled: boolean; setEnabled(on: boolean): void
  loading: boolean // enabled and the airport not resolved yet
  cut: { id: string; after: number; resumeAt: number; estimated: boolean; removedIds: Set<string>; distanceNm: number } | null
  picking: boolean; startPicking(): void; stopPicking(): void
  pick(id: string): boolean // false when outside the range; true stops picking
  reset(): void // forgets the hand-picked cut
}
```

`ExportWithoutArrival` props: `{ arrival: ReturnType<typeof useArrivalCut>; destination: string; onStartPicking(): void }`.

Copy (`copy.editor`, plus `withoutArrivalSummary(count, distanceNm, icao, estimated)`):

| Key | Provisional text |
|---|---|
| `withoutArrival` | Export without arrival |
| `withoutArrivalHint` | For AI ATC: add the arrival and approach in Infinite Flight. |
| `moveCut` | Move cut point |
| `pickCut` | Click the last waypoint to keep |
| `pickCutOutside` | Pick a waypoint between the departure and the landing |
| `cutUnavailable` | No arrival to remove from this plan |
| `cutBadge` | Cut |
| summary | `14 waypoints removed · 62 NM before LFPG` (+ ` · estimated`) |

- [ ] **Step 1:** Hook: state starts false, then `loadWithoutArrival(window.localStorage)` in an effect (access in try/catch); writes `"1"`/`"0"` in try/catch. Airport: `loadAirport(destination)` when valid, `fallbackAirport(waypoints)` otherwise or when it returns null. Picked cut stored as waypoint id, resolved with `resolveCut`. Escape stops picking.
- [ ] **Step 2:** Component: `Switch` with label and hint, then the summary and "Move cut point" (Cancel while picking), or `cutUnavailable` when enabled and `cut` is null.
- [ ] **Step 3:** Editor: render it in `exportButtons` above the Export button. In `performExport` only the file changes: `generateFPL(buildExportWaypoints(waypoints, { includeBranding, arrival: arrival.cut ?? undefined }))`; `savePlan` keeps receiving `finalWaypoints`. Disable both Export buttons while `arrival.loading`. Call `reset()` in `applyParsedImport` and `clearDrawing`.
- [ ] **Step 4:** Check on `pnpm dev` (port 3000) with the local AeroHub link in `.claude/rules/aerohub.md`: OFF downloads 115 waypoints; ON downloads 107, ending `INFINITE` (KEGIT), `PLANNER` (RW09L), `EGLL`; reload keeps the toggle. Block `/api/airports/EGLL/runways`: Export still enables.
- [ ] **Step 5:** `pnpm test:export-trim`, type count 26. Commit `Export without arrival: toggle and export`.

### Task 3: Convert map, list and phone sheet

**Files:** Modify `components/map-preview.tsx`, `components/editor/waypoint-list.tsx`, `components/editor/workspace.tsx`, `components/flight-plan-editor.tsx`, `app/globals.css`

**Interfaces:**
- `MapPreview`: `cutId?: string | null`, `pickingCut?: boolean`.
- `WaypointList`: `cutId?: string | null`.
- `EditorWorkspace`: `lowerSheet?: number` (a new value sends the phone sheet to its lowest snap).

- [ ] **Step 1:** Editor passes `ghostIds` = trim preview ids ∪ `arrival.cut.removedIds`. `onStartPicking` leaves edit and select mode, lowers the sheet, calls `startPicking`. While picking, `handleMapPointClick` (through a ref) and `handleRowClick` call `pick(id)` and show `pickCutOutside` as a toast when it returns false.
- [ ] **Step 2:** Map: own effect keeping one non-interactive `L.divIcon` marker, class `ip-cut` (scissors badge above the dot, `--route-selected` colour), on `cutId`. The cut dot, and all dots while picking, are never thinned.
- [ ] **Step 3:** List: `cutBadge` next to the name on the `cutId` row.
- [ ] **Step 4:** Browser, desktop and 375 px: marker and dashed gap visible, ground points normal; move the cut by map and by row; Escape cancels; normal click, drag and select still work; toggle off removes marker and dashes.
- [ ] **Step 5:** Type count 26. Commit `Export without arrival: cut point on the Convert map and list`.

### Task 4: Sketch map and table

**Files:** Modify `components/draw-map.tsx`, `components/draw-map-wrapper.tsx`, `components/drawing-board.tsx`, `components/waypoint-table.tsx`, `components/flight-plan-editor.tsx`

**Interfaces:** `DrawingBoard` → wrapper → `DrawMap`: `cutId?: string | null`, `removedIds?: Set<string>`, `pickingCut?: boolean`, `onPickCut?: (id: string) => void`. `WaypointTable`: `cutId?: string | null`, `ghostIds?: Set<string>`.

- [ ] **Step 1:** Map: removed points use a grey icon; same `.ip-cut` marker (style not scoped to `.ip-map`). While picking, line and pen handlers return early, markers do not drag, a marker click calls `onPickCut` through a ref.
- [ ] **Step 2:** Table: badge on the cut row, removed rows `opacity-40`.
- [ ] **Step 3:** Browser: draw a route over 120 NM; the summary says estimated; move the cut with each tool selected, no point is added.
- [ ] **Step 4:** Type count 26. Commit `Export without arrival: cut point in Sketch`.

### Task 5: Docs and pull request

**Files:** Modify `CHANGELOG.md` (Unreleased, Added), `CLAUDE.md` Status block (5 lines or fewer, rewrite)

- [ ] **Step 1:** Changelog entry in the file's style. Status block rewritten, only that hunk staged.
- [ ] **Step 2:** All `pnpm test:*` related scripts pass; `pnpm build` succeeds (preview env, provisional copy allowed outside production).
- [ ] **Step 3:** Gab gives final copy; remove the `// PROVISIONAL` marks; `pnpm check:copy` passes.
- [ ] **Step 4:** Ask Gab before pushing; pull request to `staging`.
