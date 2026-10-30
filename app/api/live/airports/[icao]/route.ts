import { NextResponse, type NextRequest } from "next/server"
import { getAirportInfo } from "@/lib/airports"
import { getAirportAtis } from "@/lib/live-api"
import { canUseLive } from "@/lib/live-gate"
import { allowAction } from "@/lib/rate-limit"

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }

// The live ATIS of one airport. The browser asks here, never Infinite Flight: this reads the shared server cache (see
// lib/live-api), so any number of visitors cost a handful of upstream calls a minute. Only real airports are looked up,
// and each visitor is held to a modest number of questions, so nobody can use the route to burn the shared budget.
export async function GET(request: NextRequest, { params }: { params: { icao: string } }) {
  const icao = params.icao.trim().toUpperCase()
  if (!/^[A-Z]{4}$/.test(icao) || !getAirportInfo(icao)) {
    return NextResponse.json({ state: "unknown" }, { status: 404, headers: HEADERS })
  }
  if (!(await canUseLive())) return NextResponse.json({ state: "disabled" }, { headers: HEADERS })
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
  if (!allowAction(`live-airport:${visitor}`, 30)) {
    return NextResponse.json({ state: "unavailable" }, { status: 429, headers: HEADERS })
  }
  return NextResponse.json(await getAirportAtis(icao), { headers: HEADERS })
}
