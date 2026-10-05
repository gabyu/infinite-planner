import { NextResponse } from "next/server"
import { searchAirports } from "@/lib/airports"

// Airport search for the Convert form: by ICAO or IATA code, city or name. Public reference data
// (no account needed), answered from the bundled dataset, which stays on the server.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? ""
  const results = q.length <= 60 ? searchAirports(q) : []
  return NextResponse.json({ results }, { headers: { "Cache-Control": "public, max-age=3600" } })
}
