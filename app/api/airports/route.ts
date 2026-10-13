import { NextResponse } from "next/server"
import { resolveAirportName, searchAirports } from "@/lib/airports"

// Airport search for the Convert form: by ICAO or IATA code, city or name. Public reference data
// (no account needed), answered from the bundled dataset, which stays on the server.
// `?codes=EHAM,KSFO` instead returns the names of those ICAO codes (homepage statistics).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const headers = { "Cache-Control": "public, max-age=3600" }

  const codes = params.get("codes")
  if (codes !== null) {
    const names: Record<string, string> = {}
    for (const code of codes.split(",").slice(0, 25)) {
      const name = resolveAirportName(code)
      if (name) names[code.trim().toUpperCase()] = name
    }
    return NextResponse.json({ names }, { headers })
  }

  const q = params.get("q") ?? ""
  const results = q.length <= 60 ? searchAirports(q) : []
  return NextResponse.json({ results }, { headers })
}
