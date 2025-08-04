# Infinite Planner
Infinite Planner is the name of a series of tools built to improve and ease the Flight Planning experience for Infinite Flight, one of the most popular flight simulator for iOS, iPadOS and Android.

# FPL Cleaner / Optimizer
Perfect for virtual pilots looking for more accurate and efficient route planning.

The script converts a FlightRadar24 KML file to an optimized FPL file with the limitations of Infinite Flight. 

Flight Planner enhances the flight planning experience in Infinite Flight by optimizing existing and past flight KML files. It intelligently cleans up flight paths by:
- ✔️ Filtering unnecessary waypoints, keeping only essential turns.
- ✔️ Limiting waypoints to improve efficiency (max 250).
- ✔️ Streamline your flight planning with Flight Planner and focus on a smoother Infinite Flight experience. 🚀✈️
- ✔️ Allow user to custom-rename waypoints with a custom format (e.g., AFKLM028-###).
- ✔️ Import and process KML files from FlightAware
- ✔️ Determine the source of the KML file by leveraging the distinct structures of FlightAware and FlightRadar 24 for accurate and efficient identification.
- ✔️ Exports the KML into a ready-to-use Infinite Flight plan file (FPL format).
- ✔️ Show a map with the flight plan.


Roadmap:
- Identifying step climbs, marking TOC (Top of Climb) & TOD (Top of Descent).
- Detecting and rounding altitudes to the nearest 100 ft.
- Add the original airport and destination airport ICAO as 1st and last waypoints.
  
Try it now, and let me know if it works as expected! 🚀
If you can improve the code, feel free to fork it!


## Installation
1. Clone this repository:  
   \`\`\`bash
   git clone https://github.com/gabyu/infinite-planner.git
   
2. Upload the files to your web server (Apache, Nginx, etc.).
3. Ensure uploads/ and processed/ directories are writable.
