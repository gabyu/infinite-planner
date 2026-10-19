import { NextResponse } from "next/server"
import { getLiveHealth } from "@/lib/live-api"

// Reports whether live Infinite Flight data is available right now. Never exposes the key or any API data; it
// reads the shared 10-minute sessions cache, so polling this route costs at most one upstream call per period.
export async function GET() {
  const health = await getLiveHealth()
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  })
}
