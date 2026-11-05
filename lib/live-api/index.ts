import "server-only"
import { createLiveClient, liveHealth, type LiveEnv, type LiveResult } from "./core"
import { getAirportLive, type AirportExtras } from "./airport"
import { getRunwayData } from "@/lib/runways"
import { windAt } from "@/lib/weather"

export type { LiveFailure, LiveHealth, LiveResult } from "./core"
export type { AirportLive } from "./airport"

const readEnv = (): LiveEnv => ({
  IF_API_KEY: process.env.IF_API_KEY,
  LIVE_API_ENABLED: process.env.LIVE_API_ENABLED,
})

// One client per server instance: its cache and request budget are what keep every user's traffic down to a
// handful of calls a minute.
export const liveClient = createLiveClient({ fetch: (...args) => fetch(...args), now: Date.now, env: readEnv })

export const getLiveHealth = () => liveHealth(liveClient, readEnv(), Date.now)
// Where there is no ATIS the answer also carries the airport's runway ends and the wind of the nearest real METAR.
const extras: AirportExtras = {
  runwayNames: (icao) => getRunwayData(icao)?.names ?? [],
  windAt: async (icao) => {
    const airport = getRunwayData(icao)
    return airport ? windAt(icao, airport.lat, airport.lng) : { ok: true, report: null }
  },
}

// The aircraft the game offers, for the "Aircraft" field of the editor. The list changes only when the game updates, so one call
// serves an hour (still the shared in-memory cache: nothing is stored, and the browser never talks to Infinite Flight).
const AIRCRAFT_TTL_MS = 60 * 60_000
export type AircraftOption = { id: string; name: string }
export async function getAircraftList(): Promise<LiveResult<AircraftOption[]>> {
  const result = await liveClient.read<unknown>("/aircraft", AIRCRAFT_TTL_MS)
  if (!result.ok) return result
  const list = Array.isArray(result.data) ? result.data : []
  const options = list
    .map((item) => item as { id?: unknown; name?: unknown })
    .filter((item): item is { id: string; name: string } => typeof item.id === "string" && typeof item.name === "string" && item.name.length > 0)
    .map(({ id, name }) => ({ id, name: name.slice(0, 60) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { ok: true, data: options, fetchedAt: result.fetchedAt }
}

export const getAirportAtis = (icao: string) => getAirportLive(liveClient, readEnv(), icao, extras)
