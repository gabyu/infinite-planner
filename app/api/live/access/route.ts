import { NextResponse } from "next/server"
import { canUseLive } from "@/lib/live-gate"

// Whether this visitor may see the live airport card and the departure procedures (see lib/live-gate.ts). Display only.
export async function GET() {
  return NextResponse.json({ allowed: await canUseLive() }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } })
}
