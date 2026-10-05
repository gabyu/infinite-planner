import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const ADMIN_BASE = "/admin-dashboard"
const LOGIN = `${ADMIN_BASE}/login`
const FIRST_LOGIN = `${ADMIN_BASE}/first-login`

// Keeps the Supabase session fresh everywhere, and guards /admin-dashboard on the server.
export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (pathname !== ADMIN_BASE && !pathname.startsWith(`${ADMIN_BASE}/`)) return response

  // The admin area must never be indexed or cached.
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  response.headers.set("Cache-Control", "no-store")

  // Redirects must carry the refreshed session cookies set on `response`.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    redirect.headers.set("Cache-Control", "no-store")
    return redirect
  }

  // Fail closed when Supabase isn't configured.
  if (!supabase) return redirectTo("/")

  const isLogin = pathname === LOGIN
  const isFirstLogin = pathname === FIRST_LOGIN

  if (!user) return isLogin || isFirstLogin ? response : redirectTo(LOGIN)

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .maybeSingle()

  // Signed in but not an admin (e.g. a Discord account): only the login forms are reachable.
  if (profile?.role !== "admin") return isLogin || isFirstLogin ? response : redirectTo(LOGIN)

  // Pending temporary password: nothing but the set-your-password step is reachable.
  if (profile.must_change_password) return isFirstLogin ? response : redirectTo(FIRST_LOGIN)

  // Already an active admin: the login forms have nothing to offer.
  if (isLogin || isFirstLogin) return redirectTo(ADMIN_BASE)

  return response
}

export const config = {
  matcher: [
    // Everything except static assets and the public counter endpoint.
    "/((?!_next/static|_next/image|api/counter|api/airports|favicon|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|txt|xml|woff2?)$).*)",
  ],
}
