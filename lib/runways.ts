import "server-only"
import runways from "@/lib/data/runways.json"
import type { TrimAirport } from "@/lib/ground-trim"

// ICAO code -> [field elevation ft, lat, lng, runways, names], from OurAirports (scripts/build-airport-data.mjs). Server
// only: the editor asks for one airport at a time through /api/airports/{icao}/runways. `runways` are the rows with
// coordinates (ground trimming); `names` are the runways ["13R", "31L", 128] of every open runway, with two-digit numbers
// like the ATIS writes them, and the TRUE heading of the first end (null when unknown), including airports whose runways
// have no coordinates.
const DATA = runways as unknown as Record<string, [number | null, number, number, TrimAirport["runways"], [string, string, number | null][]]>

export function getRunwayData(icao: string): TrimAirport | null {
  const entry = DATA[icao.trim().toUpperCase()]
  if (!entry) return null
  return { elevationFt: entry[0], lat: entry[1], lng: entry[2], runways: entry[3], names: entry[4] }
}
