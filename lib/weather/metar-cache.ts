// Current surface wind from NOAA's Aviation Weather Center METAR cache file: the testable core. Server use only; the
// entry that wires in zlib and the environment is ./index.ts.
//
//   https://aviationweather.gov/data/cache/metars.cache.csv.gz   (about 250 KB, one line per station, updated every minute)
//
// NOAA's rules: send a custom User-Agent, at most 100 requests a minute, about one a minute per endpoint, and use this cache
// file for bulk reads. So one download per server instance every few minutes serves every airport; no request ever
// goes to NOAA on behalf of a single visitor. The data is public domain (weather.gov/disclaimer): free for any lawful
// purpose, but never to be presented as NOAA's endorsement. Held in memory only.
//
// Rules of this module:
//   - an airport gets its own station's wind when that report is under 3 hours old; otherwise the nearest station
//     within 25 NM whose report is under 3 hours old, and the answer says which station and how far;
//   - nothing beyond that: no wind, never a guess;
//   - METAR wind direction is degrees TRUE (variable wind has none), speed in knots;
//   - if NOAA cannot be reached, the last good snapshot is kept for up to 30 minutes, then the answer is "unavailable".
import { distanceM } from "@/lib/ground-trim"

export const SOURCE_URL = "https://aviationweather.gov/data/cache/metars.cache.csv.gz"
export const USER_AGENT = "InfinitePlanner/1.0 (+https://infiniteplanner.gabyu.com)"
export const REFRESH_MS = 5 * 60_000
export const RETRY_AFTER_FAILURE_MS = 60_000
export const KEEP_STALE_MS = 30 * 60_000
export const FRESH_MAX_MS = 3 * 60 * 60_000
export const NEAREST_MAX_NM = 25
const NM_M = 1852
const REQUEST_TIMEOUT_MS = 10_000

export interface Station {
  id: string
  lat: number
  lon: number
  /** Milliseconds since the epoch. */
  observedAt: number
  /** Degrees true; null when variable or not reported. */
  wdir: number | null
  wspd: number
  wgst: number | null
}

export interface WindReport {
  /** The station the wind comes from: the airport itself, or the nearest one. */
  station: string
  /** 0 for the airport's own station. */
  distanceNm: number
  observedAt: string
  wind: { from: number | null; speedKt: number; gustKt: number | null }
}

export type WindResult = { ok: true; report: WindReport | null } | { ok: false; reason: "disabled" | "unavailable" }

export type WeatherEnv = { WEATHER_ENABLED?: string }

// One CSV line with quoted fields (the raw METAR text is quoted and may hold commas).
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      fields.push(field)
      field = ""
    } else field += c
  }
  fields.push(field)
  return fields
}

/** The stations of NOAA's CSV that have a position, an observation time and a wind speed. */
export function parseMetarCsv(csv: string): Station[] {
  const lines = csv.split("\n")
  const headerAt = lines.findIndex((line) => line.startsWith("raw_text"))
  if (headerAt < 0) return []
  const header = splitCsvLine(lines[headerAt])
  const col = (name: string) => header.indexOf(name)
  const [idCol, timeCol, latCol, lonCol] = [col("station_id"), col("observation_time"), col("latitude"), col("longitude")]
  const [dirCol, speedCol, gustCol] = [col("wind_dir_degrees"), col("wind_speed_kt"), col("wind_gust_kt")]
  if ([idCol, timeCol, latCol, lonCol, dirCol, speedCol, gustCol].some((index) => index < 0)) return []

  const stations: Station[] = []
  for (const line of lines.slice(headerAt + 1)) {
    if (!line) continue
    const f = splitCsvLine(line)
    const id = f[idCol]?.trim()
    const observedAt = Date.parse(f[timeCol] ?? "")
    const [lat, lon, speed] = [Number.parseFloat(f[latCol]), Number.parseFloat(f[lonCol]), Number.parseFloat(f[speedCol])]
    if (!id || !Number.isFinite(observedAt) || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(speed)) continue
    const dir = Number.parseFloat(f[dirCol])
    const gust = Number.parseFloat(f[gustCol])
    stations.push({
      id,
      lat,
      lon,
      observedAt,
      // Variable wind has no direction in the file (blank); 360 is north, kept as 0..359.
      wdir: Number.isFinite(dir) ? dir % 360 : null,
      wspd: speed,
      wgst: Number.isFinite(gust) ? gust : null,
    })
  }
  return stations
}

export function weatherEnabled(env: WeatherEnv): boolean {
  return (env.WEATHER_ENABLED ?? "").trim().toLowerCase() !== "false"
}

type Snapshot = { stations: Station[]; byId: Map<string, Station>; takenAt: number }

interface Deps {
  fetch: typeof fetch
  now: () => number
  env: () => WeatherEnv
  /** Turns the downloaded bytes into the CSV text (gunzip in the app; identity in tests). */
  decode: (bytes: ArrayBuffer) => string
}

export function createWeatherSource(deps: Deps) {
  let snapshot: Snapshot | null = null
  let inflight: Promise<void> | null = null
  let failedAt = -Infinity

  async function refresh() {
    try {
      const response = await deps.fetch(SOURCE_URL, {
        headers: { "User-Agent": USER_AGENT },
        cache: "no-store", // never let Next's data cache keep a copy
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const stations = parseMetarCsv(deps.decode(await response.arrayBuffer()))
      if (stations.length === 0) throw new Error("no stations")
      snapshot = { stations, byId: new Map(stations.map((station) => [station.id, station])), takenAt: deps.now() }
    } catch {
      failedAt = deps.now()
    }
  }

  // The snapshot, refreshed when it is older than REFRESH_MS. Concurrent callers share one download, a failed download is
  // not retried for a minute, and an old snapshot is kept for KEEP_STALE_MS when NOAA cannot be reached.
  async function current(): Promise<Snapshot | null> {
    const now = deps.now()
    const due = !snapshot || now - snapshot.takenAt >= REFRESH_MS
    if (due && now - failedAt >= RETRY_AFTER_FAILURE_MS) {
      inflight ??= refresh().finally(() => {
        inflight = null
      })
    }
    if (inflight && (!snapshot || due)) await inflight
    if (!snapshot || deps.now() - snapshot.takenAt >= KEEP_STALE_MS) return null
    return snapshot
  }

  async function windAt(icao: string, lat: number, lon: number): Promise<WindResult> {
    if (!weatherEnabled(deps.env())) return { ok: false, reason: "disabled" }
    const data = await current()
    if (!data) return { ok: false, reason: "unavailable" }
    const now = deps.now()
    const fresh = (station: Station) => now - station.observedAt < FRESH_MAX_MS && station.observedAt <= now + 10 * 60_000

    let best: { station: Station; nm: number } | null = null
    const own = data.byId.get(icao)
    if (own && fresh(own)) best = { station: own, nm: 0 }
    else {
      for (const station of data.stations) {
        if (!fresh(station)) continue
        const nm = distanceM({ lat, lng: lon }, { lat: station.lat, lng: station.lon }) / NM_M
        if (nm <= NEAREST_MAX_NM && (!best || nm < best.nm)) best = { station, nm }
      }
    }
    if (!best) return { ok: true, report: null }
    const { station, nm } = best
    return {
      ok: true,
      report: {
        station: station.id,
        distanceNm: Math.round(nm),
        observedAt: new Date(station.observedAt).toISOString(),
        wind: { from: station.wdir, speedKt: station.wspd, gustKt: station.wgst },
      },
    }
  }

  return { windAt, _clear: () => { snapshot = null; inflight = null; failedAt = -Infinity } }
}
