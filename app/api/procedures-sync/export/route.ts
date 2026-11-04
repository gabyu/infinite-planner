import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"
import { allowAction } from "@/lib/rate-limit"

// Production's side of the copy to staging: the airport procedures rows, read-only, for whoever holds the sync token.
// It answers only outside staging, and only when PROCEDURES_SYNC_TOKEN is set. It cannot write anything.
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }
// A function response is limited to about 4.5 MB on Vercel; past that the copy needs pagination, and says so.
const MAX_BYTES = 4 * 1024 * 1024

const digest = (value: string) => new Uint8Array(createHash("sha256").update(value).digest())

export async function GET(request: Request) {
  const token = process.env.PROCEDURES_SYNC_TOKEN
  if (process.env.NEXT_PUBLIC_ENV === "staging" || !token || token.length < 24) return new NextResponse(null, { status: 404, headers: NO_STORE })

  const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowAction(`procedures-sync:${caller}`, 20)) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: NO_STORE })

  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!given || !timingSafeEqual(digest(given), digest(token))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE })

  const supabase = getServiceRoleSupabase()
  if (!supabase) return NextResponse.json({ error: "Not configured." }, { status: 503, headers: NO_STORE })
  const { data, error } = await supabase.rpc("procedure_sync_export")
  if (error || !data) return NextResponse.json({ error: "Export failed." }, { status: 500, headers: NO_STORE })

  const body = JSON.stringify(data)
  if (body.length > MAX_BYTES) return NextResponse.json({ error: "Export too large: the copy needs pagination." }, { status: 507, headers: NO_STORE })
  return new NextResponse(body, { status: 200, headers: { ...NO_STORE, "Content-Type": "application/json" } })
}
