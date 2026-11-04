import { NextResponse } from "next/server"
import { procedureRoot, setNotNeeded } from "@/lib/procedure-store"

// Local only. A key is a direction cell, or "done|arrival" / "done|departure". Body: { airport: "LSGG", key: "arrival|04|N", notNeeded: true }
export const dynamic = "force-dynamic"
const KEY = /^((arrival|departure)\|\d{2}\|(N|NE|E|SE|S|SW|W|NW)|done\|(arrival|departure))$/

export async function POST(request: Request) {
  const root = procedureRoot()
  if (!root) return new NextResponse(null, { status: 404 })
  const body = (await request.json().catch(() => null)) as { airport?: string; key?: string; notNeeded?: boolean } | null
  if (!body || !/^[A-Z]{4}$/.test(body.airport ?? "") || !KEY.test(body.key ?? "") || typeof body.notNeeded !== "boolean") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 })
  }
  setNotNeeded(root, body.airport!, body.key!, body.notNeeded)
  return NextResponse.json({ ok: true })
}
