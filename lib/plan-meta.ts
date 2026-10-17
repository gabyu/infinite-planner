import "server-only"
import type { Metadata } from "next"
import { getAirportInfo } from "@/lib/airports"
import { BRAND_NAME } from "@/lib/brand"
import { formatFlightTime } from "@/lib/flight-plans"
import { formatDistanceNm } from "@/lib/route-render"
import { planPath } from "@/lib/plan-slug"
import type { PublicPlan } from "@/lib/public-plans"
import { buildMetadata, clip } from "@/lib/seo"

// Text about a plan, built once for the page, its metadata and its preview image. People search
// "CDG to LAX" and city names as much as ICAO codes, so all three are used.

export interface PlanEnd {
  icao: string
  iata: string | null
  city: string | null
  name: string | null
  // "Paris (LFPG/CDG)" / "Paris (LFPG)" / "LFPG"
  label: string
}

export function describeEnd(icao: string, storedName: string | null): PlanEnd {
  const info = getAirportInfo(icao)
  const iata = info?.iata || null
  // OurAirports cities can carry a region or a district ("Paris (Roissy-en-France, Val-d'Oise)"): keep the place name.
  const city = info?.city?.replace(/\s*\(.*$/, "").split(",")[0].trim() || null
  const codes = iata ? `${icao}/${iata}` : icao
  return {
    icao,
    iata,
    city,
    name: storedName ?? info?.name ?? null,
    label: city ? `${city} (${codes})` : codes,
  }
}

export function planTitle(plan: PublicPlan) {
  const flight = plan.flightNumber ? ` – ${plan.flightNumber}` : ""
  return `${plan.origin} to ${plan.destination} flight plan${flight} by ${plan.authorName} | ${BRAND_NAME}`
}

// Two plans of the same route and flight number still differ by author, date, source and the numbers, so no
// two plan pages share a description.
export function planDescription(plan: PublicPlan) {
  const from = describeEnd(plan.origin, plan.originName)
  const to = describeEnd(plan.destination, plan.destinationName)
  const facts = [
    plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null,
    formatFlightTime(plan.flightTimeMinutes),
    `${plan.waypoints.length} waypoints`,
  ].filter(Boolean)
  const flight = plan.flightNumber ? `Flight ${plan.flightNumber}: ` : ""
  const published = new Date(plan.publishedAt ?? plan.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  const source = plan.source === "Sketch" ? "Hand-drawn route" : `${plan.source} track`
  return clip(
    `${flight}flight plan from ${from.label} to ${to.label}, ${facts.join(", ")}. ${source} shared by ${plan.authorName} on ${published}. Grab the FPL for Infinite Flight.`,
    200,
  )
}

export function planMetadata(plan: PublicPlan, options: { indexable: boolean }): Metadata {
  return buildMetadata({
    title: planTitle(plan),
    description: planDescription(plan),
    path: planPath(plan),
    indexable: options.indexable,
    // The page has its own generated preview image (opengraph-image.tsx).
    image: false,
  })
}
