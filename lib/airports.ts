import "server-only"
import airports from "@/lib/data/airports.json"

// ICAO code -> [name, city, IATA, country, rank], from OurAirports (https://ourairports.com/data/,
// released to the public domain), filtered to 4-letter ICAO codes by scripts/build-airports.mjs.
//
// Used on the server only: to resolve the airport names stored on a flight plan when it is saved,
// and to answer the airport search of the Convert form (/api/airports). The dataset never reaches
// the browser. We use this instead of the Infinite Flight Live API because its terms forbid
// keeping API data in our own database.
type Entry = [name: string, city: string, iata: string, country: string, rank: number]
const AIRPORTS = airports as unknown as Record<string, Entry>

export interface AirportMatch {
  icao: string
  name: string
  city: string
  iata: string
  country: string
}

export function resolveAirportName(icao: string): string | null {
  return AIRPORTS[icao.trim().toUpperCase()]?.[0] ?? null
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

// Searchable text of every airport, built once.
const INDEX = Object.entries(AIRPORTS)
  .filter(([, entry]) => entry[4] < 4)
  .map(([icao, [name, city, iata, country, rank]]) => ({
    icao,
    name,
    city,
    iata,
    country,
    rank,
    icaoLower: icao.toLowerCase(),
    iataLower: iata.toLowerCase(),
    words: fold(`${city} ${name}`).split(/[^a-z0-9]+/).filter(Boolean),
    text: fold(`${city} ${name} ${iata} ${icao}`),
  }))

// Airports matching a typed ICAO code, IATA code, city or name. Every word typed must be found;
// exact codes first, then word-start matches, bigger airports ahead of small fields.
export function searchAirports(query: string, limit = 8): AirportMatch[] {
  const q = fold(query).trim()
  if (q.length < 2) return []
  const tokens = q.split(/\s+/)

  const scored: { score: number; entry: (typeof INDEX)[number] }[] = []
  for (const entry of INDEX) {
    let score = 0
    if (entry.icaoLower === q) score = 1000
    else if (entry.iataLower === q) score = 900
    else if (entry.icaoLower.startsWith(q)) score = 500
    else {
      if (!tokens.every((token) => entry.text.includes(token))) continue
      const wordStarts = tokens.filter((token) => entry.words.some((word) => word.startsWith(token))).length
      score = 100 + wordStarts * 20
    }
    scored.push({ score: score - entry.rank * 15, entry })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.icao.localeCompare(b.entry.icao))
    .slice(0, limit)
    .map(({ entry: { icao, name, city, iata, country } }) => ({ icao, name, city, iata, country }))
}
