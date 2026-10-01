"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { LogOut, Moon, Sun, UserRound } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getBrowserSupabase } from "@/lib/supabase/client"

export function ProfileMenu({ email }: { email: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  async function logout() {
    await getBrowserSupabase()?.auth.signOut()
    window.location.assign("/admin-dashboard/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Open profile menu"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold uppercase text-primary">
            {email.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">Administrator</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin-dashboard/profile" className="no-underline">
            <UserRound /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun /> : <Moon />}
          {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
