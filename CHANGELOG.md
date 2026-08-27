# Changelog

All notable changes to Infinite Planner are documented here.

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
