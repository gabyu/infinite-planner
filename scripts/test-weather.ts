// Run with `pnpm test:weather`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import {
  createWeatherSource,
  FRESH_MAX_MS,
  KEEP_STALE_MS,
  NEAREST_MAX_NM,
  parseMetarCsv,
  REFRESH_MS,
  RETRY_AFTER_FAILURE_MS,
  SOURCE_URL,
  USER_AGENT,
  type WeatherEnv,
} from "@/lib/weather/metar-cache"

// Real lines of NOAA's file (2026-10-19), header shortened to the columns the parser reads plus the repeated sky columns.
const HEADER = "raw_text,station_id,observation_time,latitude,longitude,temp_c,dewpoint_c,wind_dir_degrees,wind_speed_kt,wind_gust_kt,visibility_statute_mi,altim_in_hg,sky_cover,cloud_base_ft_agl,sky_cover,cloud_base_ft_agl"
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n")
const LINE = {
  // Ordinary wind.
  KDTW: '"METAR KDTW 190453Z 20005KT 10SM CLR 07/02 A3042 RMK AO2 SLP305",KDTW,2026-10-19T04:53:00.000Z,42.2311,-83.3312,7.2,1.7,200,5,,10,30.42,,,,',
  // Gusting wind, comma inside the quoted raw text.
  CYWE: '"SPECI CYWE 190646Z AUTO 30011G17KT 5SM -SN BKN014, OVC023 M06/M08 A2971",CYWE,2026-10-19T04:46:00.000Z,64.192,-114.078,-6,-8,300,11,17,5,29.71,BKN,1400,OVC,2300',
  // Calm.
  KSWF: '"METAR KSWF 190645Z 00000KT 10SM SKC 03/02 A3050",KSWF,2026-10-19T04:45:00.000Z,41.5045,-74.0999,3,2,0,0,,10+,30.5,,,,',
  // Variable direction: blank in the file.
  EGLL: '"METAR EGLL 190520Z AUTO VRB02KT 9999 NCD 08/08 Q1025",EGLL,2026-10-19T04:50:00.000Z,51.477,-0.461,8,8,,2,,6+,30.28,,,,',
  // Direction 360 means north.
  LHBP: '"METAR LHBP 190500Z 36008KT CAVOK",LHBP,2026-10-19T04:30:00.000Z,47.4369,19.2556,2,1,360,8,,10,30.2,,,,',
  // No wind speed: left out.
  XXXX: '"METAR XXXX 190500Z NIL",XXXX,2026-10-19T04:30:00.000Z,10,10,,,,,,,,,,,',
  // Old report (more than 3 hours).
  OLDS: '"METAR OLDS 190100Z 18010KT",OLDS,2026-10-19T01:00:00.000Z,41.6,-83.3,3,2,180,10,,10,30.2,,,,',
}

// 1. Parsing.
{
  const stations = parseMetarCsv(csv(...Object.values(LINE)))
  assert.deepEqual(stations.map((s) => s.id), ["KDTW", "CYWE", "KSWF", "EGLL", "LHBP", "OLDS"])
  const by = Object.fromEntries(stations.map((s) => [s.id, s]))
  assert.deepEqual([by.KDTW.wdir, by.KDTW.wspd, by.KDTW.wgst], [200, 5, null])
  assert.deepEqual([by.CYWE.wdir, by.CYWE.wspd, by.CYWE.wgst], [300, 11, 17])
  assert.deepEqual([by.KSWF.wdir, by.KSWF.wspd], [0, 0])
  assert.deepEqual([by.EGLL.wdir, by.EGLL.wspd], [null, 2])
  assert.equal(by.LHBP.wdir, 0)
  assert.equal(by.KDTW.observedAt, Date.parse("2026-10-19T04:53:00Z"))
  assert.equal(parseMetarCsv("garbage").length, 0)
  assert.equal(parseMetarCsv("").length, 0)
}

async function main() {
  // 2. The source: fake NOAA, fake clock.
  let clock = Date.parse("2026-10-19T05:00:00Z")
  let env: WeatherEnv = {}
  let body = csv(LINE.KDTW, LINE.EGLL, LINE.OLDS, '"METAR KDET 190453Z 22008KT",KDET,2026-10-19T04:53:00.000Z,42.4092,-83.0101,7,2,220,8,,10,30.4,,,,')
  let calls: { url: string; agent: string | null; cache: string | undefined }[] = []
  let reply: () => Response = () => new Response(body)
  const make = () => {
    calls = []
    return createWeatherSource({
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), agent: new Headers(init?.headers).get("User-Agent"), cache: init?.cache })
        return reply()
      }) as typeof fetch,
      now: () => clock,
      env: () => env,
      decode: (bytes) => new TextDecoder().decode(bytes),
    })
  }
  const KDTW_POS = [42.2124, -83.3534] as const // the airport itself
  const NM_PER_DEGREE_LAT = 60.04

  {
    const source = make()
    // Own station.
    const own = await source.windAt("KDTW", ...KDTW_POS)
    assert.ok(own.ok && own.report)
    if (own.ok && own.report) {
      assert.deepEqual(own.report, { station: "KDTW", distanceNm: 0, observedAt: "2026-10-19T04:53:00.000Z", wind: { from: 200, speedKt: 5, gustKt: null } })
    }
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, SOURCE_URL)
    assert.equal(calls[0].agent, USER_AGENT)
    assert.equal(calls[0].cache, "no-store")

    // Many airports, one download.
    await Promise.all([source.windAt("KDTW", ...KDTW_POS), source.windAt("EGLL", 51.47, -0.45), source.windAt("ZZZZ", 0, 0)])
    assert.equal(calls.length, 1)

    // A neighbour: an airport without a METAR of its own, closer to KDET than to KDTW, takes KDET's wind, labelled.
    const near = await source.windAt("KXYZ", 42.46, -83.05)
    assert.ok(near.ok && near.report)
    if (near.ok && near.report) {
      assert.equal(near.report.station, "KDET")
      assert.ok(near.report.distanceNm > 0 && near.report.distanceNm <= NEAREST_MAX_NM)
      assert.deepEqual(near.report.wind, { from: 220, speedKt: 8, gustKt: null })
    }

    // The 25 NM limit: just inside and just outside along a meridian from KDET (42.4092, -83.0101).
    const inside = await source.windAt("TEST", 42.4092 + 24.5 / NM_PER_DEGREE_LAT, -83.0101)
    const outside = await source.windAt("TEST", 42.4092 + 26 / NM_PER_DEGREE_LAT, -83.0101)
    assert.ok(inside.ok && inside.report?.station === "KDET")
    assert.deepEqual(outside, { ok: true, report: null })

    // A report over three hours old is never used (OLDS is 4 h old), neither as own station nor as neighbour.
    const old = await source.windAt("OLDS", 41.6, -83.3)
    assert.ok(old.ok && old.report === null)

    // Variable wind keeps its null direction.
    const vrb = await source.windAt("EGLL", 51.477, -0.461)
    assert.ok(vrb.ok && vrb.report?.wind.from === null && vrb.report.wind.speedKt === 2)

    // Freshness moves with the clock: three hours later KDTW's own report has expired.
    clock += REFRESH_MS - 1
    await source.windAt("KDTW", ...KDTW_POS)
    assert.equal(calls.length, 1)
    clock += 1
    await source.windAt("KDTW", ...KDTW_POS)
    assert.equal(calls.length, 2)
    clock += FRESH_MAX_MS
    body = csv(LINE.KDTW)
    const expired = await source.windAt("KDTW", ...KDTW_POS)
    assert.ok(expired.ok && expired.report === null)
    body = csv(LINE.KDTW)
  }

  // 3. Failures: a failed refresh is not retried for a minute, the last snapshot is kept for 30 minutes, then "unavailable".
  {
    clock = Date.parse("2026-10-19T05:00:00Z")
    body = csv(LINE.KDTW)
    const source = make()
    assert.ok((await source.windAt("KDTW", ...KDTW_POS)).ok)
    reply = () => new Response("nope", { status: 503 })
    clock += REFRESH_MS
    const kept = await source.windAt("KDTW", ...KDTW_POS)
    assert.ok(kept.ok && kept.report?.station === "KDTW") // the old snapshot still serves
    const callsAfterFailure = calls.length
    clock += RETRY_AFTER_FAILURE_MS - 1
    await source.windAt("KDTW", ...KDTW_POS)
    assert.equal(calls.length, callsAfterFailure) // not hammered
    clock += KEEP_STALE_MS
    assert.deepEqual(await source.windAt("KDTW", ...KDTW_POS), { ok: false, reason: "unavailable" })
    // NOAA back: fresh data, no old failure.
    reply = () => new Response(body)
    clock += RETRY_AFTER_FAILURE_MS
    assert.ok((await source.windAt("KDTW", ...KDTW_POS)).ok)

    // A network error and an empty file are failures too; with nothing yet there is nothing to serve.
    const broken = make()
    reply = () => {
      throw new Error("network down")
    }
    assert.deepEqual(await broken.windAt("KDTW", ...KDTW_POS), { ok: false, reason: "unavailable" })
    reply = () => new Response("")
    const empty = make()
    assert.deepEqual(await empty.windAt("KDTW", ...KDTW_POS), { ok: false, reason: "unavailable" })
    reply = () => new Response(body)
  }

  // 4. The kill switch: no request at all.
  {
    const source = make()
    env = { WEATHER_ENABLED: "false" }
    assert.deepEqual(await source.windAt("KDTW", ...KDTW_POS), { ok: false, reason: "disabled" })
    assert.equal(calls.length, 0)
    env = {}
  }

  console.log("weather: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
