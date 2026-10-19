// Run with `pnpm test:live-api`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import {
  createLiveClient,
  IDLE_EVICT_MS,
  liveApiEnabled,
  liveHealth,
  MAX_PER_MINUTE,
  MIN_REFRESH_MS,
  type LiveEnv,
} from "@/lib/live-api/core"
import { getAirportLive, MAX_FOLLOWED_AIRPORTS, type AirportExtras } from "@/lib/live-api/airport"
import { parseAtis } from "@/lib/live-api/atis"

const KEY = "test-key-not-real"
let clock = 1_000_000
let env: LiveEnv = { IF_API_KEY: KEY }
let calls: { url: string; auth: string | null; cache: string | undefined }[] = []
let reply: () => Response = () => json({ errorCode: 0, result: [{ id: "a", name: "Expert" }] })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  calls.push({
    url: String(input),
    auth: new Headers(init?.headers).get("Authorization"),
    cache: init?.cache,
  })
  return reply()
}) as typeof fetch
const fresh = () => {
  calls = []
  return createLiveClient({ fetch: fakeFetch, now: () => clock, env: () => env })
}

async function main() {
  // The one setting.
  assert.equal(liveApiEnabled({}), true)
  assert.equal(liveApiEnabled({ LIVE_API_ENABLED: "false" }), false)
  assert.equal(liveApiEnabled({ LIVE_API_ENABLED: " FALSE " }), false)

  // A call sends the key as a Bearer header, never caches in Next, and returns the result.
  {
    const client = fresh()
    const r = await client.read<{ id: string }[]>("/sessions")
    assert.equal(r.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "https://api.infiniteflight.com/public/v2/sessions")
    assert.equal(calls[0].auth, `Bearer ${KEY}`)
    assert.equal(calls[0].cache, "no-store")
  }

  // Many users, one call: concurrent and repeated reads inside the window share a single upstream request.
  {
    const client = fresh()
    await Promise.all(Array.from({ length: 50 }, () => client.read("/sessions")))
    await client.read("/sessions")
    assert.equal(calls.length, 1)
    clock += MIN_REFRESH_MS - 1
    await client.read("/sessions")
    assert.equal(calls.length, 1)
    clock += 1
    await client.read("/sessions")
    assert.equal(calls.length, 2)
  }

  // A ttl shorter than the 15-second floor is raised to it.
  {
    const client = fresh()
    await client.read("/x", 1)
    clock += 5_000
    await client.read("/x", 1)
    assert.equal(calls.length, 1)
  }

  // Never more than MAX_PER_MINUTE requests in a minute, across different paths.
  {
    const client = fresh()
    for (let i = 0; i < MAX_PER_MINUTE + 10; i++) await client.read(`/p${i}`)
    assert.equal(calls.length, MAX_PER_MINUTE)
    clock += 60_000
    const r = await client.read("/later")
    assert.equal(r.ok, true)
  }

  // Failures are explicit states, and are remembered for the window (a down API is not hammered).
  {
    const client = fresh()
    reply = () => json({ error: "no" }, 401)
    const refused = await client.read("/sessions")
    assert.deepEqual(refused.ok === false && refused.reason, "refused")
    await client.read("/sessions")
    assert.equal(calls.length, 1)

    clock += MIN_REFRESH_MS
    reply = () => json({ errorCode: 7 }, 404)
    const none = await client.read("/sessions")
    assert.deepEqual(none.ok === false && none.reason, "not_found")

    clock += MIN_REFRESH_MS
    reply = () => json({}, 500)
    const down = await client.read("/sessions")
    assert.deepEqual(down.ok === false && down.reason, "unavailable")

    clock += MIN_REFRESH_MS
    reply = () => json({ errorCode: 0, result: "ok" })
    const back = await client.read("/sessions")
    assert.equal(back.ok, true)
  }

  // A thrown network error is "unavailable", and a recovered API serves fresh data, not the old failure.
  {
    const client = fresh()
    const original = reply
    reply = () => {
      throw new Error("network down")
    }
    const r = await client.read("/sessions")
    assert.deepEqual(r.ok === false && r.reason, "unavailable")
    reply = original
    clock += MIN_REFRESH_MS
    assert.equal((await client.read("/sessions")).ok, true)
  }

  // Disabled or missing key: no request at all.
  {
    const client = fresh()
    env = { IF_API_KEY: KEY, LIVE_API_ENABLED: "false" }
    const off = await client.read("/sessions")
    assert.deepEqual(off.ok === false && off.reason, "disabled")
    env = {}
    clock += MIN_REFRESH_MS
    const none = await client.read("/sessions")
    assert.deepEqual(none.ok === false && none.reason, "not_configured")
    assert.equal(calls.length, 0)
    env = { IF_API_KEY: KEY }
  }

  // Health: ok when the API answers; reports the state otherwise; never contains the key.
  {
    const client = fresh()
    reply = () => json({ errorCode: 0, result: [] })
    const ok = await liveHealth(client, env, () => clock)
    assert.equal(ok.status, "ok")
    assert.equal(ok.configured, true)
    assert.equal(JSON.stringify(ok).includes(KEY), false)
    await liveHealth(client, env, () => clock)
    assert.equal(calls.length, 1)

    const off = await liveHealth(fresh(), { IF_API_KEY: KEY, LIVE_API_ENABLED: "false" }, () => clock)
    assert.equal(off.status, "disabled")
    assert.equal(off.enabled, false)
    const missing = await liveHealth(fresh(), {}, () => clock)
    assert.equal(missing.status, "not_configured")
    assert.equal(missing.configured, false)
  }

  // ATIS wording seen live: wind in sentence one, runways in sentence two.
  {
    const lhbp = parseAtis(
      "Budapest Ferenc airport, ATIS information OSCAR, time 1517 ZULU, Wind 240 at 5 Visibility 21, Temperature 20, Dew Point 4, QNH 1020. Landing Runway 13R, Departing Runway 13R. Advise on initial contact.",
    )
    assert.equal(lhbp.letter, "OSCAR")
    assert.deepEqual(lhbp.wind, { from: 240, speedKt: 5, gustKt: null })
    assert.equal(lhbp.qnh, 1020)
    assert.deepEqual(lhbp.landing, ["13R"])
    assert.deepEqual(lhbp.departing, ["13R"])

    const eheh = parseAtis("Landing Runway 03, Departing Runway 03.")
    assert.deepEqual([eheh.landing, eheh.departing], [["03"], ["03"]])
    const omdb = parseAtis("Landing Runways 30L and 30R, Departing Runways 30L and 30R.")
    assert.deepEqual([omdb.landing, omdb.departing], [["30L", "30R"], ["30L", "30R"]])

    // Different landing and departing runways, three runways, single digit, calm and gusting wind.
    const mixed = parseAtis("Wind 270 at 12 gusting 25. Landing Runways 9, 9L and 9R, Departing Runway 27.")
    assert.deepEqual(mixed.wind, { from: 270, speedKt: 12, gustKt: 25 })
    assert.deepEqual(mixed.landing, ["09", "09L", "09R"])
    assert.deepEqual(mixed.departing, ["27"])
    assert.deepEqual(parseAtis("Wind calm.").wind, { from: null, speedKt: 0, gustKt: null })
    assert.deepEqual(parseAtis("Wind variable at 3.").wind, { from: null, speedKt: 3, gustKt: null })

    // Real texts of 2026-10-19: extra clauses after the runways must not hide them.
    const kdtw = parseAtis(
      "Detroit Metro airport, ATIS information DELTA, time 0430 ZULU, Wind 170 at 5 Visibility 21, Temperature 7, Dew Point 1, Altimeter 3043. Remarks, use of Departure and Arrival procedures recommended. Landing Runways 21L and 22R, Departing Runways 22L and 21R,  Recommended Departure Procedures, BARII3,CLVIN3,HHOWE4. Recommended Arrival Procedures, BONZZ2,HANBL3. Advise on initial contact, you have information DELTA.",
    )
    assert.deepEqual([kdtw.letter, kdtw.landing, kdtw.departing], ["DELTA", ["21L", "22R"], ["22L", "21R"]])
    assert.deepEqual(kdtw.wind, { from: 170, speedKt: 5, gustKt: null })
    const mmun = parseAtis(
      "Cancun airport, ATIS information BRAVO, time 0428 ZULU, Wind Calm, Visibility 7, Temperature 26, Dew Point 25, QNH 1015. Remarks, no pattern work, Automated ATC test; no human supervisor is monitoring. This session is time limited.. Landing Runways 12R and 12L, expect ILS approach, Departing Runways 12R and 12L. Advise on initial contact, you have information BRAVO.",
    )
    assert.deepEqual([mmun.landing, mmun.departing, mmun.qnh], [["12R", "12L"], ["12R", "12L"], 1015])
    assert.deepEqual(mmun.wind, { from: null, speedKt: 0, gustKt: null })
    // A digit-led piece that is not a runway still drops the list.
    assert.deepEqual(parseAtis("Landing Runways 13R and 13L ILS, Departing Runway 13R.").landing, [])

    // Anything unrecognised is left empty, never guessed.
    const odd = parseAtis("Landing Runway ILS 13R, Departing Runway 13R.")
    assert.deepEqual(odd.landing, [])
    assert.deepEqual(odd.departing, ["13R"])
    assert.deepEqual(parseAtis("Landing Runway 40, Departing Runway 99X."), { letter: null, wind: null, qnh: null, landing: [], departing: [] })
    assert.deepEqual(parseAtis("nothing useful here"), { letter: null, wind: null, qnh: null, landing: [], departing: [] })
  }

  // Airport reader: Expert session picked by name, ATIS parsed, no ATIS = its own state, nothing invented on failure.
  {
    const atisText = "ATIS information ALPHA, Wind 100 at 8. Landing Runway 10, Departing Runway 10."
    reply = () => json({ errorCode: 0, result: [] })
    const answer = (url: string) => {
      if (url.endsWith("/sessions")) return json({ errorCode: 0, result: [{ id: "casual-id", name: "Casual" }, { id: "expert-id", name: "Expert" }] })
      if (url.includes("/airport/LFPG/")) return json({ errorCode: 7 }, 404)
      if (url.includes("/airport/EHAM/")) return json({ errorCode: 0, result: 12 })
      return json({ errorCode: 0, result: atisText })
    }
    const make = () => {
      calls = []
      return createLiveClient({
        fetch: (async (input: string | URL | Request) => {
          calls.push({ url: String(input), auth: null, cache: undefined })
          return answer(String(input))
        }) as typeof fetch,
        now: () => clock,
        env: () => env,
      })
    }
    env = { IF_API_KEY: KEY }
    const client = make()

    const live = await getAirportLive(client, env, "EGLL")
    assert.equal(live.state, "atis")
    if (live.state === "atis") {
      assert.deepEqual(live.landing, ["10"])
      assert.equal(live.letter, "ALPHA")
      assert.equal(JSON.stringify(live).includes(KEY), false)
    }
    assert.ok(calls.some((c) => c.url.endsWith("/sessions/expert-id/airport/EGLL/atis")))

    assert.deepEqual(await getAirportLive(client, env, "LFPG"), { state: "no_atis" })
    assert.deepEqual(await getAirportLive(client, env, "EHAM"), { state: "no_atis" })

    // No ATIS with the extras: every runway end, and the wind of the nearest METAR with the ends it favours.
    {
      const names: [string, string, number | null][] = [["04", "22", 41], ["09", "27", 87], ["18", "36", null]]
      const windFor = (result: Awaited<ReturnType<AirportExtras["windAt"]>>): AirportExtras => ({ runwayNames: () => names, windAt: async () => result })
      const report = { station: "EHAM", distanceNm: 0, observedAt: "2026-10-19T04:53:00.000Z", wind: { from: 90, speedKt: 15, gustKt: 22 } }
      const live = await getAirportLive(client, env, "LFPG", windFor({ ok: true, report }))
      assert.equal(live.state, "no_atis")
      if (live.state === "no_atis" && live.weather?.status === "ok") {
        assert.deepEqual(live.ends?.map((end) => end.name), ["04", "09", "18", "22", "27", "36"])
        assert.equal(live.weather.station, "EHAM")
        assert.deepEqual(live.weather.wind, report.wind)
        assert.equal(live.weather.pick, "09")
        assert.deepEqual(live.weather.best, ["09"])
        assert.equal(live.weather.ranked[0].name, "09")
        assert.equal(live.weather.ranked[0].headwindKt, 15)
        assert.ok(live.weather.ranked.every((end) => end.name !== "18" && end.name !== "36")) // no heading: not ranked
        assert.equal(JSON.stringify(live).includes(KEY), false)
      } else assert.fail("expected weather")
      const none = await getAirportLive(client, env, "LFPG", windFor({ ok: true, report: null }))
      assert.deepEqual(none.state === "no_atis" && none.weather, { status: "none" })
      assert.ok(none.state === "no_atis" && (none.ends?.length ?? 0) === 6) // the chips are there without weather
      const down = await getAirportLive(client, env, "LFPG", windFor({ ok: false, reason: "unavailable" }))
      assert.deepEqual(down.state === "no_atis" && down.weather, { status: "unavailable" })
      const off = await getAirportLive(client, env, "LFPG", windFor({ ok: false, reason: "disabled" }))
      assert.deepEqual(off.state === "no_atis" && off.weather, { status: "off" })
      // An airport with an ATIS never gets weather: the ATIS speaks.
      const withAtis = await getAirportLive(client, env, "EGLL", windFor({ ok: true, report }))
      assert.equal(withAtis.state, "atis")
      assert.equal("weather" in withAtis, false)
    }

    // Many readers of one airport, one call a minute.
    const before = calls.length
    await Promise.all(Array.from({ length: 30 }, () => getAirportLive(client, env, "EGLL")))
    clock += 30_000
    await getAirportLive(client, env, "EGLL")
    assert.equal(calls.length, before)

    // Off or without a key: "disabled", and no request.
    const quiet = make()
    assert.deepEqual(await getAirportLive(quiet, { IF_API_KEY: KEY, LIVE_API_ENABLED: "false" }, "EGLL"), { state: "disabled" })
    assert.deepEqual(await getAirportLive(quiet, {}, "EGLL"), { state: "disabled" })
    assert.equal(calls.length, 0)

    // Refused key: unavailable, not invented data.
    const refusing = createLiveClient({ fetch: (async () => json({}, 401)) as typeof fetch, now: () => clock, env: () => env })
    assert.deepEqual(await getAirportLive(refusing, env, "EGLL"), { state: "unavailable" })

    // At most MAX_FOLLOWED_AIRPORTS airports are followed at once; one more is unavailable, a followed one still works.
    clock += IDLE_EVICT_MS
    const capped = make()
    const codes = Array.from({ length: MAX_FOLLOWED_AIRPORTS + 1 }, (_, i) => `EG${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)}`)
    for (const code of codes.slice(0, MAX_FOLLOWED_AIRPORTS)) assert.equal((await getAirportLive(capped, env, code)).state, "atis")
    assert.deepEqual(await getAirportLive(capped, env, codes[MAX_FOLLOWED_AIRPORTS]), { state: "unavailable" })
    assert.equal((await getAirportLive(capped, env, codes[0])).state, "atis")

    // Idle for 15 minutes: everything is forgotten, and the freed room lets a new airport in.
    clock += IDLE_EVICT_MS
    assert.equal(capped.tracked("/sessions/"), 0)
    assert.equal((await getAirportLive(capped, env, codes[MAX_FOLLOWED_AIRPORTS])).state, "atis")
  }

  console.log("live-api: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
