import "server-only"
import { createLiveClient, liveHealth, type LiveEnv } from "./core"

export type { LiveFailure, LiveHealth, LiveResult } from "./core"

const readEnv = (): LiveEnv => ({
  INFINITE_FLIGHT_API_KEY: process.env.INFINITE_FLIGHT_API_KEY,
  LIVE_API_ENABLED: process.env.LIVE_API_ENABLED,
})

// One client per server instance: its cache and request budget are what keep every user's traffic down to a
// handful of calls a minute.
export const liveClient = createLiveClient({ fetch: (...args) => fetch(...args), now: Date.now, env: readEnv })

export const getLiveHealth = () => liveHealth(liveClient, readEnv(), Date.now)
