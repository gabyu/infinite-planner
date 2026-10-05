import { NextResponse, type NextRequest } from "next/server"
import { getServerSupabase } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/safe-redirect"

// OAuth (Discord) return point: swaps the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"))

  // Behind Vercel the public host comes in x-forwarded-host.
  const forwardedHost = request.headers.get("x-forwarded-host")
  const base = process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin

  const supabase = getServerSupabase()
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
    console.error("OAuth code exchange failed:", error.message)
  }

  // Back to where they were, flagged so the header can say the sign-in didn't work.
  const failed = new URL(next, base)
  failed.searchParams.set("auth_error", "1")
  return NextResponse.redirect(failed)
}
