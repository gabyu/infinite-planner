// Infinite Flight Live API client: the testable core. Server use only (the key has no NEXT_PUBLIC_ prefix, so it never
// reaches a browser bundle); the `server-only` guard sits in ./index.ts, which is what the app imports.
//
// Rules this module enforces (Infinite Flight terms as read so far, see the dev brief):
//   - the browser never talks to Infinite Flight; the key is only ever sent from here, in an Authorization header;
//   - one shared cache per data type: a user's request never makes its own call, and a given entry is refreshed
//     at most once every MIN_REFRESH_MS, whatever the number of users;
//   - the whole instance stays under MAX_PER_MINUTE requests;
//   - the cache is temporary and in memory only: no database, no log of responses, no history;
//   - on any failure the caller gets an explicit state (disabled, refused, unavailable...), never made-up data.

export const API_BASE = "https://api.infiniteflight.com/public/v2"
export const MIN_REFRESH_MS = 15_000
export const MAX_PER_MINUTE = 25 // the limit is 30 (100 with a Pro-linked key); keep a margin
export const REQUEST_TIMEOUT_MS = 8_000
// An entry nobody has asked for in this long is dropped: nothing is kept past the window in which it is used.
export const IDLE_EVICT_MS = 15 * 60_000
const MINUTE_MS = 60_000

export type LiveFailure = "disabled" | "not_configured" | "refused" | "rate_limited" | "not_found" | "unavailable"
export type LiveResult<T> = { ok: true; data: T; fetchedAt: number } | { ok: false; reason: LiveFailure; at: number }

export type LiveEnv = { IF_API_KEY?: string; LIVE_API_ENABLED?: string }

type Deps = {
  fetch: typeof fetch
  now: () => number
  env: () => LiveEnv
}

type Entry = { result: LiveResult<unknown>; refreshedAt: number; lastAskedAt: number; inflight?: Promise<LiveResult<unknown>> }

// The one setting that turns every live feature off: LIVE_API_ENABLED=false.
export function liveApiEnabled(env: LiveEnv): boolean {
  return (env.LIVE_API_ENABLED ?? "").trim().toLowerCase() !== "false"
}

export function createLiveClient(deps: Deps) {
  const entries = new Map<string, Entry>()
  let sent: number[] = []

  const underBudget = () => {
    const now = deps.now()
    sent = sent.filter((at) => now - at < MINUTE_MS)
    return sent.length < MAX_PER_MINUTE
  }

  // The Live API wraps everything as { errorCode, result }. errorCode 7 is the "nothing there" answer (for
  // example an airport with no ATIS), which is a normal state and not a failure of the service.
  async function call(path: string): Promise<LiveResult<unknown>> {
    const env = deps.env()
    const at = deps.now()
    if (!liveApiEnabled(env)) return { ok: false, reason: "disabled", at }
    const key = env.IF_API_KEY
    if (!key) return { ok: false, reason: "not_configured", at }
    if (!underBudget()) return { ok: false, reason: "rate_limited", at }
    sent.push(at)

    try {
      const response = await deps.fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store", // never let Next's data cache keep a copy of an Infinite Flight response
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.status === 401 || response.status === 403) return { ok: false, reason: "refused", at }
      if (response.status === 429) return { ok: false, reason: "rate_limited", at }
      const body = (await response.json().catch(() => null)) as { errorCode?: number; result?: unknown } | null
      if (response.status === 404 || body?.errorCode === 7) return { ok: false, reason: "not_found", at }
      if (!response.ok || !body || body.errorCode !== 0) return { ok: false, reason: "unavailable", at }
      return { ok: true, data: body.result, fetchedAt: at }
    } catch {
      // Timeout or network error. Nothing from the request (and certainly not the key) is logged.
      return { ok: false, reason: "unavailable", at }
    }
  }

  // Returns the cached answer while it is younger than `ttlMs` (never below MIN_REFRESH_MS). Otherwise one shared
  // refresh runs; every request that arrives meanwhile waits for that same call. A failed refresh is remembered
  // for the same period, so a down API is not hammered, and the failure is what callers see: old data is never
  // served past its time.
  // Entries nobody has asked for in 15 minutes are dropped (this is the "stop after 15 minutes without a request" rule:
  // refreshing only ever happens on a request, so an unasked entry is simply forgotten).
  function evictIdle() {
    const now = deps.now()
    for (const [path, entry] of entries) if (!entry.inflight && now - entry.lastAskedAt >= IDLE_EVICT_MS) entries.delete(path)
  }

  async function read<T>(path: string, ttlMs: number = MIN_REFRESH_MS): Promise<LiveResult<T>> {
    const ttl = Math.max(ttlMs, MIN_REFRESH_MS)
    evictIdle()
    const entry = entries.get(path)
    if (entry) {
      entry.lastAskedAt = deps.now()
      if (entry.inflight) return entry.inflight as Promise<LiveResult<T>>
      if (deps.now() - entry.refreshedAt < ttl) return entry.result as LiveResult<T>
    }
    const inflight = call(path).then((result) => {
      const latest = entries.get(path)
      entries.set(path, { result, refreshedAt: deps.now(), lastAskedAt: latest?.lastAskedAt ?? deps.now() })
      return result
    })
    entries.set(path, {
      result: entry?.result ?? { ok: false, reason: "unavailable", at: deps.now() },
      refreshedAt: entry?.refreshedAt ?? 0,
      lastAskedAt: deps.now(),
      inflight,
    })
    return inflight as Promise<LiveResult<T>>
  }

  // How many entries with this path prefix are currently held (used to cap how many airports are followed at once).
  function tracked(prefix: string): number {
    evictIdle()
    let count = 0
    for (const path of entries.keys()) if (path.startsWith(prefix)) count++
    return count
  }

  function has(path: string): boolean {
    evictIdle()
    return entries.has(path)
  }

  return { read, tracked, has, _entryCount: () => entries.size, _clear: () => entries.clear() }
}

export type SessionInfo = { id: string; name: string }

// Sessions change rarely and the API caches them for 10 minutes, so one call serves that long.
export const SESSIONS_TTL_MS = 10 * MINUTE_MS

export type LiveHealth = {
  enabled: boolean
  configured: boolean
  status: "ok" | "disabled" | "not_configured" | "refused" | "rate_limited" | "unavailable"
  checkedAt: string
}

// The health report: whether live data is available, by looking at the (cached) sessions call. Nothing in it comes
// from the key, and nothing from the API beyond "it answered".
export async function liveHealth(client: ReturnType<typeof createLiveClient>, env: LiveEnv, now: () => number): Promise<LiveHealth> {
  const enabled = liveApiEnabled(env)
  const configured = Boolean(env.IF_API_KEY)
  const checkedAt = new Date(now()).toISOString()
  if (!enabled) return { enabled, configured, status: "disabled", checkedAt }
  if (!configured) return { enabled, configured, status: "not_configured", checkedAt }
  const result = await client.read<unknown>("/sessions", SESSIONS_TTL_MS)
  if (result.ok) return { enabled, configured, status: "ok", checkedAt }
  const status = result.reason === "not_found" ? "unavailable" : result.reason
  return { enabled, configured, status, checkedAt }
}
