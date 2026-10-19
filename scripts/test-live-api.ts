// Run with `pnpm test:live-api`. Plain asserts: the project has no test runner.
import assert from "node:assert/strict"
import { createLiveClient, liveApiEnabled, liveHealth, MAX_PER_MINUTE, MIN_REFRESH_MS, type LiveEnv } from "@/lib/live-api/core"

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

  console.log("live-api: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
