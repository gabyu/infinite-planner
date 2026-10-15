# Changelog

All notable changes to Infinite Planner are documented here.

## Unreleased

### Added
- **Explore: a library of community flight plans** (not announced yet: it opens to everyone only when the launch switch is flipped; until then admins use it alone). Every exported flight plan is **Private** until you switch its **visibility** to **Public** (listed in the library and indexed by search engines; there is no in-between). The link to a public plan and its library entry are the same address, `/explore/plans/lfpg-klax-af65-k3x9p2qa`. Plan pages show the route on a map of dots like the homepage globe, an altitude graph, the distance and the figures that matter, with airport codes, IATA codes and city names so they can be found by search.
- **Browse, search and sort.** `/explore` lists the library by Popular, Latest, Most imported, Most downloaded or Most liked, with search by airport (ICAO, IATA or city), flight number or "CDG to LAX", filters, and pages for every route (`/explore/routes/lfpg-klax`), airport (`/explore/location/KPHX`) and flight number (`/explore/flight_number/AF69`). Routes are drawn over the land as dots and coloured by altitude, like the homepage globe.
- **Download, like, import.** Signed in with Discord, you can download a plan, like it (Favorites in your dashboard) and **import** it: a copy lands in your dashboard and opens in the map, ready to adjust and export as your own. Signed out, you see everything and are invited to sign in; whatever you clicked is done when you come back. A copy shows "Based on…" in your dashboard, or "Original no longer available" if the author unpublished it.
- **Pilot profiles.** Signed-in users can open a profile (`/pilots/…`): published plans, up to six featured ones, and a few totals.
- **A better preview card for shared links** (Discord, X, Slack...): the cities under the airport codes (no more cut-off airport names), the land drawn as dots like on the homepage globe, and the route coloured by altitude with a light edge so it stays readable on the blue.
- **Report a flight plan.** Signed-in users can report a published plan (a reason and a few words).
- **Contributors.** A new role between a Discord member and an admin: the members an admin raises to publish flight plans while the library is still in soft launch. They see the same site as everyone else (no admin space) plus the library; after the launch they keep a **Contributor** badge on their profile and on their plans. The admin dashboard has a new **Contributors** tab: find a member, make them a contributor, see how many plans each one published, and demote them.
- **A Routes section in the admin dashboard**: the library with its coverage, the open reports (resolve, or hide the plan), a Hide / Unhide on every plan, and a switch to stop a user from publishing.

### Changed
- **Share links are gone.** The Share button is replaced by a **Visibility** switch (Private / Public) on every exported flight plan, in the dashboard and in the editor. All the links created by the old sharing feature stop working. Downloading will require a Discord sign-in once the library is launched.
- **Flight number you can edit.** In the flight plan editor (signed in) a new **Flight number** field lets you change or clear the number read from the file name, for a codeshare or a number of your own, until you export. It is saved with the plan.
- **Breadcrumb on plan pages**: Explore / route / flight number, each step a link back up. The **Explore** item of the menu stays clickable on the pages under it.
- **Help.** The guide and the FAQ are one page, **Help**, in the menu; `/how-it-works` and `/faq` redirect to it.
- **The map screen of Convert is the flight plan editor.**
- **The Terms of Service, Privacy Policy and FAQ cover the library**: visibility, the licence to display published plans, who sees your name and avatar, profiles, reports and what deleting an account removes. These texts need a human read before release.

- **Rich previews for shared links.** Pasting a share link in Discord, Slack or X now shows a card built for that flight: the route in the title (`LFPG → KSFO - Flight plan by <author>`), the airport names, flight number and flight time in the description, and a generated image with the route drawn on it and the Infinite Planner logo in the corner. Before, every shared link showed the generic homepage card. A stopped link shows nothing.
- **A personal dashboard.** The history page is now a dashboard (avatar menu or the **Dashboard** link in the header, [/dashboard](https://infiniteplanner.gabyu.com/dashboard)): a welcome with your Discord name, a graph of the flight plans you generated over the last year, and **My flights**, your list of plans, newest first. Signing in from the homepage now lands you on it; signing in from anywhere else (Convert, Sketch...) keeps you where you were.
- **Drafts.** While you edit in Convert or Sketch (signed in), your flight plan is saved as a **draft**: the first save happens when you close the map after importing (in Sketch, once the route has two points and both airports are set), then it autosaves every minute while you change things. Reopen a draft from the dashboard with **Edit** to carry on where you stopped. Drafts show a **Draft** label in the list; you can view, edit or delete them.
- **Exported plans are locked.** Once you export, the plan is final: no more edits, not even its flight time. To change it, **Duplicate** it from the dashboard: you get a new draft, and the copy is never shared. Exported plans can be viewed, downloaded again, shared, duplicated or deleted (deleting one also kills its share link).
- **Flight history.** Every flight plan you export while signed in is kept in your account (it used to be "history", now the "My flights" list). Each entry shows its source, flight number (only when it can be read reliably from the KML's filename), the full origin and destination airport names, and the flight time if you entered one. Only the generated flight plan is kept, never the KML you imported. Signed out, Convert and Route Sketch work exactly as before and nothing is saved.
- **Share a flight plan.** A **Share** button on each exported plan of your dashboard (and next to Export FPL once you have exported) creates a link anyone can open, without an account, to view the plan on a map and download it. The link always shows the plan as it is now (it isn't a frozen copy), and **Stop sharing** switches it off immediately. Sharing again later creates a brand new link.
- **Flight number in Convert.** When the KML's file name carries one (FlightAware: `FlightAware_KLM605_EHAM_KSFO_20260526.kml`, FlightRadar24: `AF186-41db2d6c.kml`), the flight number and the source show in the sidebar, and are saved with the plan. If the file was renamed, it says so and nothing is guessed.
- **Optional flight time and a Share button, right on the page.** In Convert and Route Sketch, next to Export: the "Made with Infinite Planner" checkbox, the optional flight time (signed in; typed in by hand for now), **Export FPL** and **Share**. Share saves the plan to your history and opens the link modal, so you never have to go to the history first.
- **Sign in with Discord.** A new "Sign in" button in the header lets you sign in with your Discord account, and an avatar menu lets you sign out. Accounts are optional and nothing on the site requires one yet: this is the groundwork for saving and sharing your flight plans later. See the updated [Cookie Policy](https://infiniteplanner.gabyu.com/cookies) for what signing in stores.
- **Terms of Service and Privacy Policy.** New [/terms](https://infiniteplanner.gabyu.com/terms) and [/privacy](https://infiniteplanner.gabyu.com/privacy) pages. Terms of Service, Privacy Policy and Cookie Policy are now linked from the footer of every page, including the admin sign-in pages and dashboard.

### Changed
- **Terms of Service and Privacy Policy now cover sharing and your Discord name.** They state that your Discord username is the name that identifies you on the site and is shown as the author of every flight plan you share, and that nothing else from your profile (avatar, email) is shown to other people.
- **Shared links name their author.** The shared page, its preview card and its data now show the Discord username of the person who shared the plan (an admin account shows as "Infinite Planner admin"). It is always shown and can't be turned off; the share dialog says so. Links shared before this show the author too.
- **"Made with Infinite Planner" works the same everywhere.** One checkbox on the page, ticked by default, in both Convert and Route Sketch: it names the last four waypoints before the destination MADE, WITH, INFINITE and PLANNER (it needs at least six waypoints). Untick it to leave them out of that plan. This replaces the old behaviour where Route Sketch added them on its own once a route had seven waypoints, and Convert had it off by default. Unticking it now only changes those four waypoints and leaves every other name you set alone.
- **A new look for Convert, Route Sketch, the flight history and shared plans**, in the same compact style as the admin dashboard: tighter spacing and controls, hairline borders, subtle gray hover states. The accent stays blue and the header is unchanged.
- **Flight history** has its own link in the header for signed-in users, and **Reset planner** now only appears in Convert once a flight has been converted.
- **Convert, Route Sketch, the flight history and shared plans have a new look**, in the same compact style as the admin dashboard: tighter spacing and controls, hairline borders, subtle gray hover states. The accent stays blue.
- **Admin overview: the activity graph now counts exported flight plans of signed-in users** (the new `flight_plans` table) instead of the anonymous statistics, so it starts almost empty and fills from now on. Exports made while signed out no longer appear in it. The homepage counters are unchanged.
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
