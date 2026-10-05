"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogOut, ShieldCheck } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DiscordIcon } from "@/components/discord-icon"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { loginDestination } from "@/hooks/use-auth-user"

function displayName(user: User) {
  const meta = user.user_metadata ?? {}
  return meta.user_name ?? meta.full_name ?? meta.name ?? user.email ?? "Signed in"
}

// Sign in with Discord / account menu for the public site header. Display only: it reads
// the session from the cookie, and authorization is always enforced server-side (RLS).
export function UserMenu() {
  const [supabase] = useState(() => getBrowserSupabase())
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState(false)
  // Admins get a shortcut to the admin dashboard. Display only: the dashboard itself is guarded on the server.
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // The OAuth callback adds ?auth_error=1 when the sign-in didn't complete.
    const url = new URL(window.location.href)
    if (url.searchParams.has("auth_error")) {
      setAuthError(true)
      url.searchParams.delete("auth_error")
      window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    }

    return () => subscription.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!supabase || !user) return setIsAdmin(false)
    supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === "admin" && !data.must_change_password))
  }, [supabase, user])

  // Not configured (e.g. missing env vars): the rest of the site works without accounts.
  if (!supabase || !ready) return null

  async function signIn() {
    const next = loginDestination()
    await supabase!.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Open account menu"
          >
            <Avatar className="h-8 w-8">
              {user.user_metadata?.avatar_url && (
                <AvatarImage src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" />
              )}
              <AvatarFallback className="text-xs uppercase">{displayName(user).slice(0, 2)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium">{displayName(user)}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin-dashboard" className="cursor-pointer no-underline">
                  <ShieldCheck /> Admin dashboard
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => supabase.auth.signOut()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={signIn} variant="outline" className="h-10 gap-2 px-2 sm:px-4 bg-transparent" aria-label="Sign in with Discord">
          <DiscordIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
      )}

      {authError && (
        <div
          role="alert"
          className="fixed right-4 top-16 z-50 flex max-w-xs items-start gap-3 rounded-md border bg-background p-3 text-sm shadow-lg"
        >
          <p>Sign-in didn't complete. Please try again.</p>
          <button type="button" onClick={() => setAuthError(false)} className="text-muted-foreground underline">
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}
