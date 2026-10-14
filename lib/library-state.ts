// Whether the library has been launched to everyone. Edge-safe (plain fetch, no server-only
// imports) because the middleware needs it too. Fails closed: when the flag can't be read, the
// library counts as NOT launched, so nothing leaks before the switch is flipped.
//
// The flag is a database value (app_settings.library_launched), never an env var, so it can be
// flipped without a deploy. Each server instance remembers it for a few seconds.

const TTL_MS = 10_000
let remembered: { value: boolean; at: number } | null = null

export function forgetLibraryState() {
  remembered = null
}

// `cacheable` is for statically generated pages: the read goes through Next's data cache (tag `library`,
// 5 minutes) instead of being forced to no-store, which would make those pages fail. Everything that
// must see a flip within seconds (middleware, API routes) leaves it off.
export async function fetchLibraryLaunched(cacheable = false): Promise<boolean> {
  if (!cacheable && remembered && Date.now() - remembered.at < TTL_MS) return remembered.value

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false

  try {
    const response = await fetch(`${url}/rest/v1/rpc/library_state`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      ...(cacheable ? { next: { revalidate: 300, tags: ["library"] } } : { cache: "no-store" }),
    })
    // Thrown for the cacheable read so a failure is never cached as "not launched"; the plain read fails closed.
    if (!response.ok) {
      if (cacheable) throw new Error(`library_state failed: ${response.status}`)
      return false
    }
    const value = (await response.json()) === true
    if (!cacheable) remembered = { value, at: Date.now() }
    return value
  } catch (error) {
    if (cacheable) throw error
    return false
  }
}
