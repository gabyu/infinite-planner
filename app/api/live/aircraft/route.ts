import { NextResponse, type NextRequest } from "next/server"
import { getAircraftList } from "@/lib/live-api"
import { canUseLive } from "@/lib/live-gate"
import { allowAction } from "@/lib/rate-limit"

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }

// The aircraft Infinite Flight offers (names only), for the editor's Aircraft field. Same rules as the airport route: the browser
// asks here, never Infinite Flight; the answer comes from the shared server cache; each visitor is held to a few questions.
// When live data is off or fails the editor simply lets the person type the aircraft.
export async function GET(request: NextRequest) {
  if (!(await canUseLive())) return NextResponse.json({ state: "disabled", aircraft: [] }, { headers: HEADERS })
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
  if (!allowAction(`live-aircraft:${visitor}`, 10)) {
    return NextResponse.json({ state: "unavailable", aircraft: [] }, { status: 429, headers: HEADERS })
  }
  const result = await getAircraftList()
  if (!result.ok) return NextResponse.json({ state: "unavailable", aircraft: [] }, { headers: HEADERS })
  return NextResponse.json({ state: "ok", aircraft: result.data.map(({ name }) => name) }, { headers: HEADERS })
}
