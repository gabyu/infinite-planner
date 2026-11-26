// The runway numbers written on the editor map, one per end, at its threshold. Pure, no React.
import type { TrimAirport } from "@/lib/ground-trim"
import { runwayEnds } from "@/lib/runway-guide"
import type { EndTone } from "@/lib/runway-wind"

/** What the airport block knows about the runways of one end of the plan. */
export interface RunwayLiveInfo {
  /** The runways the ATIS has in use for this end; null (or empty) when no ATIS says. */
  inUse: string[] | null
  /** How the wind favours each end (lib/runway-wind.ts). */
  tones: Record<string, EndTone>
  /** The runway chosen in step 1. */
  chosen: string | null
}

export interface RunwayLabel {
  name: string
  lat: number
  lng: number
  headingTrue: number
  /** Null: grey. */
  tone: EndTone | null
  chosen: boolean
}

export function runwayLabels(airport: TrimAirport, live: RunwayLiveInfo): RunwayLabel[] {
  const inUse = live.inUse && live.inUse.length > 0 ? live.inUse : null
  return runwayEnds(airport).map(({ name, lat, lng, headingTrue }) => ({
    name,
    lat,
    lng,
    headingTrue,
    // With an ATIS only its runways are coloured; one it uses with no verdict from the wind is green.
    tone: inUse ? (inUse.includes(name) ? (live.tones[name] ?? "good") : null) : (live.tones[name] ?? null),
    chosen: live.chosen === name,
  }))
}
