# Infinite Planner
Infinite Planner is the name of a series of tools built to improve and ease the Flight Planning experience for Infinite Flight

# FPL Cleaner / Optimizer
The script converts a FlightRadar24 KML file to an optimized KML file with the limitations of Infinite Flight.
Currently supports FlightRadar24 and will also soon manage KML files from FlightAware.

- Properly extracts waypoints from KML files.
- Handles missing namespaces in different KML structures.
- Simplifies waypoints dynamically while keeping structure.
- Improves debugging to show errors when parsing fails.

Improvements:
- More reliable waypoint extraction (handles both namespaced and non-namespaced KMLs)
- Ensures extracted waypoints are correctly processed
- Forces the processed KML file to download after processing

Try it now, and let me know if it works as expected! 🚀
If you can improve the code, feel free to fork it!
