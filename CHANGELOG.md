# Changelog

All notable changes to Infinite Planner are documented here.

## Unreleased

### Added
- **Flight history.** When you're signed in with Discord, every flight plan you export from Convert or Route Sketch is now saved to your account, and a new **Flight history** page (avatar menu, or [/history](https://infiniteplanner.gabyu.com/history)) lists them newest first. Each entry shows its source, flight number (only when it can be read reliably from the KML's filename), the full origin and destination airport names, and the flight time if you entered one. From there you can download the `.fpl` again, duplicate a plan, edit its flight time or delete it. Only the generated flight plan is kept, never the KML you imported. Signed out, Convert and Route Sketch work exactly as before and nothing is saved.
- **Share a flight plan.** A **Share** button on each history entry creates a link anyone can open, without an account, to view the plan on a map and download it. The link always shows the plan as it is now (it isn't a frozen copy), and **Stop sharing** switches it off immediately. Sharing again later creates a brand new link.
- **Flight number in Convert.** When the KML's file name carries one (FlightAware: `FlightAware_KLM605_EHAM_KSFO_20260526.kml`, FlightRadar24: `AF186-41db2d6c.kml`), the flight number and the source show in the sidebar, and are saved with the plan. If the file was renamed, it says so and nothing is guessed.
- **Optional flight time and a Share button, right on the page.** In Convert and Route Sketch, next to Export: the "Made with Infinite Planner" checkbox, the optional flight time (signed in; typed in by hand for now), **Export FPL** and **Share**. Share saves the plan to your history and opens the link modal, so you never have to go to the history first.
- **Sign in with Discord.** A new "Sign in" button in the header lets you sign in with your Discord account, and an avatar menu lets you sign out. Accounts are optional and nothing on the site requires one yet: this is the groundwork for saving and sharing your flight plans later. See the updated [Cookie Policy](https://infiniteplanner.gabyu.com/cookies) for what signing in stores.
- **Terms of Service and Privacy Policy.** New [/terms](https://infiniteplanner.gabyu.com/terms) and [/privacy](https://infiniteplanner.gabyu.com/privacy) pages. Terms of Service, Privacy Policy and Cookie Policy are now linked from the footer of every page, including the admin sign-in pages and dashboard.

### Changed
- **"Made with Infinite Planner" works the same everywhere.** One checkbox on the page, ticked by default, in both Convert and Route Sketch: it names the last four waypoints before the destination MADE, WITH, INFINITE and PLANNER (it needs at least six waypoints). Untick it to leave them out of that plan. This replaces the old behaviour where Route Sketch added them on its own once a route had seven waypoints, and Convert had it off by default. Unticking it now only changes those four waypoints and leaves every other name you set alone.
- **A new look for Convert, Route Sketch, the flight history and shared plans**, in the same compact style as the admin dashboard: tighter spacing and controls, hairline borders, subtle gray hover states. The accent stays blue and the header is unchanged.
- **Flight history** has its own link in the header for signed-in users, and **Reset planner** now only appears in Convert once a flight has been converted.
- **Convert, Route Sketch, the flight history and shared plans have a new look**, in the same compact style as the admin dashboard: tighter spacing and controls, hairline borders, subtle gray hover states. The accent stays blue.
- The Cookie Policy no longer claims there are "no accounts, no logins" now that Discord sign-in exists.

### Fixed
- Waypoint names containing characters like `&` or `<` produced an invalid `.fpl` file. They're now escaped properly.

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
