# Infinite Planner
Infinite Planner is the Flight Plan Hub for Infinite Flight — convert a real-world flight into a flight plan, or draw one from scratch.

- **[/convert](https://infiniteplanner.gabyu.com/convert)** — import a KML file from FlightRadar24 or FlightAware and turn it into a ready-to-use Infinite Flight plan.
- **[/sketch](https://infiniteplanner.gabyu.com/sketch)** — Route Sketch: draw a route from scratch on a blank map with line and pen tools, then export it the same way.

# FPL Cleaner / Optimizer
Perfect for virtual pilots looking for more accurate and efficient route planning.

The script converts a FlightRadar24 KML file to an optimized KML file with the limitations of Infinite Flight. 

Flight Planner enhances the flight planning experience in Infinite Flight by optimizing existing and past flight KML files. It intelligently cleans up flight paths by:
- ✔️ Filtering unnecessary waypoints, keeping only essential turns.
- ✔️ Limiting waypoints to improve efficiency (max 250).
- ✔️ Streamline your flight planning with Flight Planner and focus on a smoother Infinite Flight experience. 🚀✈️
- ✔️ Allow user to custom-rename waypoints with a custom format (e.g., AFKLM028-###).
- ✔️ Import and process KML files from FlightAware
- ✔️ Determine the source of the KML file by leveraging the distinct structures of FlightAware and FlightRadar 24 for accurate and efficient identification.
- ✔️ Exports the KML into a ready-to-use Infinite Flight plan file (FPL format).
- ✔️ Show a map with the flight plan.


## 🆕 What's New
**Route Sketch — draw a flight plan from scratch, no KML needed**
- A brand new way to build a flight plan: draw a route on a blank map instead of importing one. Pick a **Line** tool for straight legs or a **Pen** tool (Illustrator-style — click for a corner point, click-and-drag to pull a curve handle) for sweeping turns, then export it as a normal Infinite Flight plan.
- Anchors and curve handles stay editable afterward with the **Selection** tool — drag a point, drag a handle, undo/redo everything.
- Desktop only for now — there's no touch equivalent for the pen tool yet, so phones and tablets are guided to the KML import flow instead of a half-working drawing board.
- Import and Sketch now live at their own addresses, **/convert** and **/sketch**, picked from a chooser on the homepage. Old `/planner` links still work and redirect to `/convert`.
- "Popular Airports," "Unique Airports," and the flight counter on the homepage now include flight plans made with Route Sketch, not just imported ones.

**A smoother map, built for phones and tablets too**
- The flight plan map now works properly on mobile — no more controls hidden off-screen or stuck behind the edges of your device.
- New **Select Points** mode: drag a selection box around a cluster of waypoints — just like selecting icons in Finder — to select several at once, then delete them all in one tap.

Roadmap:
- Identifying step climbs, marking TOC (Top of Climb) & TOD (Top of Descent).
- Detecting and rounding altitudes to the nearest 100 ft.
- Add the original airport and destination airport ICAO as 1st and last waypoints.
- A touch-friendly way to draw a route on phones and tablets.
  
Try it now, and let me know if it works as expected! 🚀
If you can improve the code, feel free to fork it!


## Installation
1. Clone this repository:  
   \`\`\`bash
   git clone https://github.com/gabyu/infinite-planner.git
   
2. Upload the files to your web server (Apache, Nginx, etc.).
3. Ensure uploads/ and processed/ directories are writable.
