import "server-only"
import runways from "@/lib/data/runways.json"
import type { TrimAirport } from "@/lib/ground-trim"

// ICAO code -> [field elevation ft, lat, lng, runways], from OurAirports (scripts/build-runways.mjs). Server only:
// the editor asks for one airport at a time through /api/airports/{icao}/runways.
const DATA = runways as unknown as Record<string, [number | null, number, number, TrimAirport["runways"]]>

export function getRunwayData(icao: string): TrimAirport | null {
  const entry = DATA[icao.trim().toUpperCase()]
  if (!entry) return null
  return { elevationFt: entry[0], lat: entry[1], lng: entry[2], runways: entry[3] }
}
