import { liveApiEnabled, SESSIONS_TTL_MS, type createLiveClient, type LiveEnv, type SessionInfo } from "./core"
import { parseAtis, type AtisWind } from "./atis"

// The live ATIS of one airport, as the app shows it. ATIS only: the Live API has no weather for airports without ATC,
// so there is nothing else to read (the wind of those airports is a separate, still open question).

// An ATIS changes rarely, so one call a minute per airport is plenty; at most this many airports are followed at once,
// which keeps the whole instance well under its request budget even before the per-minute cap applies.
export const ATIS_TTL_MS = 60_000
export const MAX_FOLLOWED_AIRPORTS = 12

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
  | { state: "no_atis" }
  | { state: "unavailable" }
  | { state: "disabled" }

type Client = ReturnType<typeof createLiveClient>

export async function getAirportLive(client: Client, env: LiveEnv, icao: string): Promise<AirportLive> {
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
    if (result.reason === "not_found") return { state: "no_atis" }
    return { state: result.reason === "disabled" || result.reason === "not_configured" ? "disabled" : "unavailable" }
  }
  const text = typeof result.data === "string" ? result.data.trim() : ""
  if (!text) return { state: "no_atis" }
  return { state: "atis", icao, text, ...parseAtis(text), fetchedAt: result.fetchedAt }
}
