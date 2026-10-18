import { NextResponse, type NextRequest } from "next/server"
import { getServerSupabase } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/safe-redirect"

// Server-side start of the Discord sign-in, for the places that send a visitor to sign in with a redirect (the
// members-only library). Same flow as the header's button: the provider returns to /auth/callback.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = safeNextPath(searchParams.get("next"))
  const forwardedHost = request.headers.get("x-forwarded-host")
  const base = process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin

  const supabase = getServerSupabase()
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`, skipBrowserRedirect: true },
    })
    if (data?.url) {
      const redirect = NextResponse.redirect(data.url)
      redirect.headers.set("Cache-Control", "private, no-store")
      return redirect
    }
    if (error) console.error("Starting the Discord sign-in failed:", error.message)
  }
  return NextResponse.redirect(`${base}/?auth_error=1`)
}
