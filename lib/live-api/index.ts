import "server-only"
import { createLiveClient, liveHealth, type LiveEnv } from "./core"
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

export const getAirportAtis = (icao: string) => getAirportLive(liveClient, readEnv(), icao, extras)
