import { createClient } from "@supabase/supabase-js"

let supabaseInstance: ReturnType<typeof createClient> | null = null

// Create a function to get the Supabase client
// This prevents errors during build/render time
export function getSupabaseClient() {
  // Return cached instance if it exists
  if (supabaseInstance) {
    return supabaseInstance
  }

  // These environment variables are automatically available in Vercel
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables not found. Counter functionality will be disabled.")

    // Return a mock client that won't cause errors
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error("Supabase not configured") }),
        insert: () => Promise.resolve({ error: new Error("Supabase not configured") }),
        update: () => Promise.resolve({ error: new Error("Supabase not configured") }),
        eq: () => ({
          select: () => Promise.resolve({ data: [], error: new Error("Supabase not configured") }),
          update: () => Promise.resolve({ error: new Error("Supabase not configured") }),
          single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
        }),
        single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
      }),
      rpc: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
    } as any
  }

  // Create and cache the supabase client
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// Export a function to get the client instead of a singleton
export const supabase = getSupabaseClient()
