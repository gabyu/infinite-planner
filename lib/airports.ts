import "server-only"
import airports from "@/lib/data/airports.json"

// ICAO code -> airport name, from OurAirports (https://ourairports.com/data/, released to
// the public domain), filtered to 4-letter ICAO codes by scripts/build-airports.mjs.
//
// Resolved once, on the server, when a flight plan is saved; the result is stored on the
// row. The dataset never reaches the browser (this module is server-only). We use this
// instead of the Infinite Flight Live API because its terms forbid keeping API data in our
// own database.
const AIRPORT_NAMES = airports as Record<string, string>

export function resolveAirportName(icao: string): string | null {
  return AIRPORT_NAMES[icao.trim().toUpperCase()] ?? null
}
