// Same variables as lib/supabase.ts (the anonymous data client). Kept separate
// because the auth clients need to know up front whether Supabase is configured.
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}
