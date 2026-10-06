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

  // On a provider/Supabase failure (e.g. sign-ups disabled) the redirect carries the reason instead of a code.
  let reason = searchParams.get("error_description") ?? searchParams.get("error")

  const supabase = getServerSupabase()
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
    console.error("OAuth code exchange failed:", error.message)
    reason = error.message
  } else if (reason) {
    console.error("OAuth sign-in failed:", reason)
  }

  // Back to where they were, flagged so the header can say the sign-in didn't work (and why, when known).
  const failed = new URL(next, base)
  failed.searchParams.set("auth_error", reason ? reason.slice(0, 200) : "1")
  return NextResponse.redirect(failed)
}
