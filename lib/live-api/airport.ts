import { liveApiEnabled, SESSIONS_TTL_MS, type createLiveClient, type LiveEnv, type SessionInfo } from "./core"
import { parseAtis, type AtisWind } from "./atis"
import { adviseRunways, endsOf, type RunwayEnd } from "@/lib/runway-wind"
import type { WindResult } from "@/lib/weather/metar-cache"

// The live ATIS of one airport, as the app shows it. Where there is an ATIS, only the ATIS speaks (its runways, its wind).
// Where there is none, the Live API has no weather at all, so the answer carries every runway end of the airport and, when
// a real METAR is near enough, its wind and the runway ends that wind favours (see lib/weather and lib/runway-wind).

// An ATIS changes rarely, so one call a minute per airport is plenty; at most this many airports are followed at once,
// which keeps the whole instance well under its request budget even before the per-minute cap applies.
export const ATIS_TTL_MS = 60_000
export const MAX_FOLLOWED_AIRPORTS = 12

/** What the no-ATIS answer is built from: the airport's runways, and the wind of the nearest METAR. Injected, so this file stays free of server-only code. */
export interface AirportExtras {
  /** ["13R", "31L", true heading of the first end or null] of every open runway; empty when unknown. */
  runwayNames: (icao: string) => [string, string, number | null][]
  windAt: (icao: string) => Promise<WindResult>
}

export interface WeatherInfo {
  /** The station the wind comes from and how far it is from the airport (0 = the airport's own METAR). */
  station: string
  distanceNm: number
  observedAt: string
  wind: { from: number | null; speedKt: number; gustKt: number | null }
  /** Every end with a known heading, best headwind first, whole knots. */
  ranked: { name: string; headwindKt: number; crosswindKt: number }[]
  best: string[]
  /** The one end the wind clearly favours, or null. */
  pick: string | null
  /** Light or variable wind: any runway works. */
  light: boolean
}

/** ok: a wind; none: no METAR near enough; unavailable: NOAA could not be reached; off: weather switched off. */
export type WeatherState = ({ status: "ok" } & WeatherInfo) | { status: "none" } | { status: "unavailable" } | { status: "off" }

export type AirportLive =
  | {
      state: "atis"
      icao: string
      text: string
      letter: string | null
      wind: AtisWind | null
      qnh: number | null
      landing: string[]
      departing: string[]
      fetchedAt: number
    }
  | { state: "no_atis"; ends?: RunwayEnd[]; weather?: WeatherState }
  | { state: "unavailable" }
  | { state: "disabled" }

type Client = ReturnType<typeof createLiveClient>

// Natural order of the chips when nothing ranks them: by number, then L, C, R.
const byName = (a: RunwayEnd, b: RunwayEnd) => Number.parseInt(a.name) - Number.parseInt(b.name) || (a.name < b.name ? -1 : 1)

async function withoutAtis(icao: string, extras: AirportExtras | undefined): Promise<AirportLive> {
  if (!extras) return { state: "no_atis" }
  const ends = endsOf(extras.runwayNames(icao)).sort(byName)
  const result = await extras.windAt(icao)
  if (!result.ok) return { state: "no_atis", ends, weather: { status: result.reason === "disabled" ? "off" : "unavailable" } }
  if (!result.report) return { state: "no_atis", ends, weather: { status: "none" } }
  const { station, distanceNm, observedAt, wind } = result.report
  const advice = adviseRunways(ends, wind)
  return {
    state: "no_atis",
    ends,
    weather: {
      status: "ok",
      station,
      distanceNm,
      observedAt,
      wind,
      ranked: advice.ranked.map((end) => ({ name: end.name, headwindKt: Math.round(end.headwindKt), crosswindKt: Math.round(end.crosswindKt) })),
      best: advice.best,
      pick: advice.pick,
      light: advice.light,
    },
  }
}

export async function getAirportLive(client: Client, env: LiveEnv, icao: string, extras?: AirportExtras): Promise<AirportLive> {
  // Switched off, or no key on this environment: the live features are simply not there.
  if (!liveApiEnabled(env) || !env.IF_API_KEY) return { state: "disabled" }

  const sessions = await client.read<SessionInfo[]>("/sessions", SESSIONS_TTL_MS)
  if (!sessions.ok) return { state: sessions.reason === "disabled" || sessions.reason === "not_configured" ? "disabled" : "unavailable" }
  // Air traffic control is on the Expert server: that is the session every ATIS comes from.
  const expert = Array.isArray(sessions.data) ? sessions.data.find((session) => /expert/i.test(session?.name ?? "")) : undefined
  if (!expert?.id) return { state: "unavailable" }

  const base = `/sessions/${expert.id}/airport/`
  const path = `${base}${icao}/atis`
  if (!client.has(path) && client.tracked(base) >= MAX_FOLLOWED_AIRPORTS) return { state: "unavailable" }

  const result = await client.read<unknown>(path, ATIS_TTL_MS)
  if (!result.ok) {
    if (result.reason === "not_found") return withoutAtis(icao, extras)
    return { state: result.reason === "disabled" || result.reason === "not_configured" ? "disabled" : "unavailable" }
  }
  const text = typeof result.data === "string" ? result.data.trim() : ""
  if (!text) return withoutAtis(icao, extras)
  return { state: "atis", icao, text, ...parseAtis(text), fetchedAt: result.fetchedAt }
}
