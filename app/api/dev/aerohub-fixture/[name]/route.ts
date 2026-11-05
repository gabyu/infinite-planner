import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

// Local testing of /import: serves the committed AeroHub fixture the way AeroHub does (KML content type), or answers
// 410 for "expired.kml". Only on `next dev`; everywhere else it does not exist.
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { name: string } }) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 })
  if (params.name === "expired.kml") return new NextResponse(null, { status: 410 })
  if (params.name !== "qr520.kml") return new NextResponse(null, { status: 404 })
  const file = await readFile(path.join(process.cwd(), "scripts/fixtures/aerohub-QR520-YPPH-EGLL.kml"))
  return new NextResponse(file, { headers: { "Content-Type": "application/vnd.google-earth.kml+xml; charset=utf-8" } })
}
