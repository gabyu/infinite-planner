import "server-only"
import { gunzipSync } from "node:zlib"
import { createWeatherSource, type WeatherEnv } from "./metar-cache"

export type { WindReport, WindResult } from "./metar-cache"

const readEnv = (): WeatherEnv => ({ WEATHER_ENABLED: process.env.WEATHER_ENABLED })

// One source per server instance: it downloads NOAA's cache file at most every five minutes, whatever the traffic.
export const weatherSource = createWeatherSource({
  fetch: (...args) => fetch(...args),
  now: Date.now,
  env: readEnv,
  decode: (bytes) => gunzipSync(bytes).toString("utf8"),
})

export const windAt = weatherSource.windAt
