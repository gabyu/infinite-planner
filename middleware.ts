import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { fetchLibraryLaunched } from "@/lib/library-state"

const ADMIN_BASE = "/admin-dashboard"
const LOGIN = `${ADMIN_BASE}/login`
const FIRST_LOGIN = `${ADMIN_BASE}/first-login`

// While the library isn't launched, the cached pages 404 for everyone: a signed-in admin or contributor is sent to the
// live /preview variant of the same page instead, which shows the whole feature. Anyone else, and every
// request once the library is launched, is untouched. Only library routes ever reach the flag lookup.
const LIBRARY_PREFIXES = ["/explore/plans/"]

// The library is for signed-in Discord members only, never for search engines: every page below (Explore, hubs, plans and
// their OG/Twitter images, pilot profiles) sends an anonymous visitor to the Discord sign-in, and the library's API routes
// answer 401. The gate sits in front of the ISR/data caches, so cached plan pages are never served to an anonymous request.
const MEMBER_PAGE_PREFIXES = ["/explore", "/pilots"]
const MEMBER_API_PREFIXES = ["/api/library/links", "/api/plans/"]
const underPrefix = (pathname: string, prefix: string) =>
  prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)

function membersOnly(request: NextRequest, response: NextResponse, user: Awaited<ReturnType<typeof updateSession>>["user"]) {
  const { pathname, search } = request.nextUrl
  const isPage = MEMBER_PAGE_PREFIXES.some((prefix) => underPrefix(pathname, prefix))
  const isApi = MEMBER_API_PREFIXES.some((prefix) => underPrefix(pathname, prefix))
  if (!isPage && !isApi) return null
  if (user) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    return null
  }
  const blocked = isApi
    ? NextResponse.json({ error: "Sign in with Discord to use the library." }, { status: 401 })
    : NextResponse.redirect(new URL(`/auth/signin?next=${encodeURIComponent(pathname + search)}`, request.url))
  response.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie))
  blocked.headers.set("Cache-Control", "private, no-store")
  blocked.headers.set("X-Robots-Tag", "noindex, nofollow")
  return blocked
}

async function previewForAdmins(
  request: NextRequest,
  response: NextResponse,
  supabase: Awaited<ReturnType<typeof updateSession>>["supabase"],
  user: Awaited<ReturnType<typeof updateSession>>["user"],
) {
  const { pathname } = request.nextUrl
  if (!user || !supabase || !LIBRARY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null
  if (await fetchLibraryLaunched()) return null

  // Admins and contributors (the soft launch's publishers) get the live preview variant.
  const { data: canPreview } = await supabase.rpc("has_library_preview")
  if (canPreview !== true) return null

  const url = request.nextUrl.clone()
  url.pathname = `/preview${pathname}`
  const rewrite = NextResponse.rewrite(url, { request })
  // Carry the refreshed session cookies set on `response`.
  response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie))
  rewrite.headers.set("Cache-Control", "no-store")
  return rewrite
}

// Keeps the Supabase session fresh everywhere, and guards /admin-dashboard on the server.
export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const blocked = membersOnly(request, response, user)
  if (blocked) return blocked

  if (pathname !== ADMIN_BASE && !pathname.startsWith(`${ADMIN_BASE}/`)) {
    return (await previewForAdmins(request, response, supabase, user)) ?? response
  }

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
