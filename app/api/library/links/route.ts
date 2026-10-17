import { NextResponse } from "next/server"
import { getViewer, isLibraryOpenFor } from "@/lib/library"
import { listPlans } from "@/lib/library-listing"
import { flightNumberPath, locationPath } from "@/lib/plan-slug"

// Which airports and flight numbers (the homepage statistics) have at least one public plan in Explore, with the page
// that lists them. Before the launch only admins and contributors get answers: for everyone else the library does not
// exist yet, so no link is offered. Per viewer, never cached.
const ICAO = /^[A-Z0-9]{3,4}$/
const FLIGHT = /^[A-Z0-9]{1,12}$/
const MAX = 12

function codes(raw: string | null, pattern: RegExp) {
  return [...new Set((raw ?? "").split(",").map((code) => code.trim().toUpperCase()))].filter((code) => pattern.test(code)).slice(0, MAX)
}

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" }
  const params = new URL(request.url).searchParams
  const airports = codes(params.get("airports"), ICAO)
  const flights = codes(params.get("flights"), FLIGHT)
  const empty = { airports: {}, flights: {} }

  try {
    if (!(await isLibraryOpenFor(await getViewer()))) return NextResponse.json(empty, { headers })
    const [airportHits, flightHits] = await Promise.all([
      Promise.all(airports.map(async (code) => ((await listPlans({ filters: { airports: [code] }, limit: 1 })).plans.length > 0 ? code : null))),
      Promise.all(flights.map(async (code) => ((await listPlans({ filters: { flight: code }, limit: 1 })).plans.length > 0 ? code : null))),
    ])
    return NextResponse.json(
      {
        airports: Object.fromEntries(airportHits.filter((code): code is string => !!code).map((code) => [code, locationPath(code)])),
        flights: Object.fromEntries(flightHits.filter((code): code is string => !!code).map((code) => [code, flightNumberPath(code)])),
      },
      { headers },
    )
  } catch {
    // A failed lookup just means no links.
    return NextResponse.json(empty, { headers })
  }
}
