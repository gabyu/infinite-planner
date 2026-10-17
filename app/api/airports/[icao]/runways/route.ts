import { NextResponse } from "next/server"
import { getRunwayData } from "@/lib/runways"

// Field elevation, reference point and open runways of one airport, for ground trimming in the editor. Public
// reference data (OurAirports), bundled with the site and the same for everyone, so it is cached for a day.
export async function GET(_request: Request, { params }: { params: { icao: string } }) {
  const data = /^[A-Za-z]{4}$/.test(params.icao) ? getRunwayData(params.icao) : null
  if (!data) return NextResponse.json({ error: "Unknown airport." }, { status: 404 })
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } })
}
