import "server-only"
import type { Metadata } from "next"
import { getAirportInfo } from "@/lib/airports"
import { BRAND_NAME } from "@/lib/brand"
import { formatFlightTime } from "@/lib/flight-plans"
import { formatDistanceNm } from "@/lib/route-render"
import { planPath } from "@/lib/plan-slug"
import type { PublicPlan } from "@/lib/public-plans"

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
  const city = info?.city || null
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
  return `${plan.origin} to ${plan.destination} flight plan${flight} | ${BRAND_NAME}`
}

export function planDescription(plan: PublicPlan) {
  const from = describeEnd(plan.origin, plan.originName)
  const to = describeEnd(plan.destination, plan.destinationName)
  const facts = [
    plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null,
    formatFlightTime(plan.flightTimeMinutes),
    `${plan.waypoints.length} waypoints`,
  ].filter(Boolean)
  const flight = plan.flightNumber ? `Flight ${plan.flightNumber}: ` : ""
  return `${flight}flight plan from ${from.name ?? from.label} (${from.iata ? `${from.iata}/` : ""}${from.icao}) to ${to.name ?? to.label} (${to.iata ? `${to.iata}/` : ""}${to.icao}), ${facts.join(", ")}. Download it for Infinite Flight.`
}

export function planMetadata(plan: PublicPlan, options: { indexable: boolean }): Metadata {
  const title = planTitle(plan)
  const description = planDescription(plan)
  const path = planPath(plan)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: options.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", title, description, siteName: BRAND_NAME, url: path },
    twitter: { card: "summary_large_image", title, description },
  }
}
