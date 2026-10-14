// A simple per-user limit for the library's actions (like, import, download): at most `limit` per
// minute. Kept in the memory of the server instance, so it is a brake on a runaway script, not a
// guarantee; the database functions are idempotent whatever happens here.
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

export function allowAction(userId: string, limit = 60): boolean {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= limit) {
    hits.set(userId, recent)
    return false
  }
  recent.push(now)
  hits.set(userId, recent)
  if (hits.size > 5000) for (const [key, times] of hits) if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(key)
  return true
}
