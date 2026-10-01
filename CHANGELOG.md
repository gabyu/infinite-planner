# Changelog

All notable changes to Infinite Planner are documented here.

## 2026-10-01

### Added
- **Route Sketch: draw a flight plan from scratch.** A new way to build a flight plan without importing anything — draw a route on a blank map with a **Line** tool for straight legs or a **Pen** tool (click for a corner point, click-and-drag to pull a curve handle, Illustrator-style) for sweeping turns. Switch to the **Selection** tool afterward to drag anchors or curve handles independently, with full undo/redo. Desktop only for now — there's no touch equivalent for the pen tool yet, so phones/tablets are pointed at the KML import flow instead of a half-working drawing tool.
- Import and Route Sketch each have their own address now: **[/convert](https://infiniteplanner.gabyu.com/convert)** and **[/sketch](https://infiniteplanner.gabyu.com/sketch)**, picked from a chooser on the homepage. Old `/planner` links redirect to `/convert` instead of 404ing.

### Fixed
- **Route Sketch flight plans were invisible to the homepage stats.** "Popular Airports," "Unique Airports," and the flight counter only ever counted KML imports, because the recording step was never wired up for hand-drawn routes. It now is.
- A long-standing bug where exporting a flight plan silently failed to increment the raw flight counter on the backend (it was swallowed and never visible to users) — removed the broken code path; counting now happens the same reliable way for both flows.
- The flight plan preview's "Clear drawing" confirmation and other dialogs could render behind the map's own controls in Route Sketch.

### Changed
- New tagline: "The Flight Plan Hub for Infinite Flight."
- Site header cleaned up: no more Discord button, plain "Convert"/"Sketch" links added, "Reset Planner" only shows where it's meaningful (the import flow).

## 2026-09-14

### Added
- **GDPR-compliant cookie consent for Google Analytics.** A bottom banner asks before anything loads (equal-weight Accept/Reject, no dark patterns); declining also disables an already-active session. New `/cookies` policy page, plus a "Cookie preferences" link in the footer to change the choice later.

## 2026-08-27

### Fixed
- **Statistics were stale.** "Popular Airports", "Popular Flights", and "Unique Airports" on the homepage were frozen on the first ~1000 flights ever imported (June–July 2025), because the underlying query fetched all rows unpaginated and Supabase caps that at 1000 rows by default. Aggregation now happens in Postgres, so the numbers reflect every flight regardless of how large the dataset grows. "Total Flights Analyzed" was already accurate and unaffected.

## 2026-08-25

### Added
- **Multi-point selection on the flight plan map.** New "Select Points" mode: drag a selection box around a cluster of waypoints (like selecting icons in Finder) to select several at once, then delete them all in one tap. Shift-drag adds to the current selection instead of replacing it.

### Fixed
- **Mobile map was broken.** The flight plan preview dialog could overflow the screen on phones and tablets, leaving buttons (Close, zoom, Departure/Arrival) stuck off-screen with no way to reach them. Dialogs now cap their height and scroll instead of overflowing.

## 2026-08-24

### Added
- Google Analytics tracking (gtag.js).

---

*Entries above cover recent work; older history is available in the [commit log](https://github.com/gabyu/infinite-planner/commits/main).*
