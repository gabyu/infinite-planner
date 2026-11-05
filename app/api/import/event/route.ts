import { NextResponse, type NextRequest } from "next/server"
import { getPartner } from "@/config/partners"
import { logImportDownloaded } from "@/lib/partners/import-log"
import { allowAction } from "@/lib/rate-limit"
import { UUID_PATTERN } from "@/lib/flight-plans"

// The editor tells us when the .fpl of a partner import was downloaded (sendBeacon). Only logged, never stored.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowAction(`import-event:${ip}`, 30)) return new NextResponse(null, { status: 429 })
  let body: unknown
  try {
    body = JSON.parse(await request.text())
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const { partner, importId } = (body ?? {}) as { partner?: unknown; importId?: unknown }
  if (typeof partner !== "string" || typeof importId !== "string" || !UUID_PATTERN.test(importId) || !getPartner(partner)) {
    return new NextResponse(null, { status: 400 })
  }
  logImportDownloaded(partner, importId)
  return new NextResponse(null, { status: 204 })
}
