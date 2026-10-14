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

export async function fetchLibraryLaunched(): Promise<boolean> {
  if (remembered && Date.now() - remembered.at < TTL_MS) return remembered.value

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false

  try {
    const response = await fetch(`${url}/rest/v1/rpc/library_state`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    })
    if (!response.ok) return false
    const value = (await response.json()) === true
    remembered = { value, at: Date.now() }
    return value
  } catch {
    return false
  }
}
