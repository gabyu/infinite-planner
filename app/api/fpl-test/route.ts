import { fplFileName, generateFPL } from "@/lib/fpl-generator"
import { FPL_CONTENT_TYPES, fplDownloadHeaders, isFplVariant } from "@/lib/fpl-download"

// TEMPORARY (Safari .fpl.xml test, staging only): a sample plan served with each Content-Type variant. Remove with /fpl-test.
export const dynamic = "force-dynamic"

const SAMPLE = [
  { name: "EHAM", lat: 52.308601, lng: 4.763889, altitude: -11 },
  { name: "SUGOL", lat: 52.7, lng: 3.2, altitude: 15000 },
  { name: "EGLL", lat: 51.4775, lng: -0.461389, altitude: 83 },
]

export async function GET(request: Request) {
  const variant = new URL(request.url).searchParams.get("v")
  if (!isFplVariant(variant)) return new Response("Use ?v=a, b or xml.", { status: 400 })
  const fileName = fplFileName("EHAM", "EGLL").replace("Infinite Planner", `Test ${variant.toUpperCase()}`)
  return new Response(generateFPL(SAMPLE), { headers: fplDownloadHeaders(fileName, FPL_CONTENT_TYPES[variant]) })
}
