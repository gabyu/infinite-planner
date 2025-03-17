# infinite-cleaner
Flight Plan Cleaner for Infinite Flight

The script converts a FlightRadar24 KML file to an optimized KML file with the limitations of Infinite Flight.

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
