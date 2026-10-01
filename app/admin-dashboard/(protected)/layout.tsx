import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { AdminNav } from "@/components/admin/admin-nav"
import { ProfileMenu } from "@/components/admin/profile-menu"
import { Badge } from "@/components/ui/badge"
import { requireAdmin } from "@/lib/admin/auth"

// Dashboard shell: top bar + section nav. Every route in this group needs an active admin;
// the middleware redirects first, this re-checks on the server.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  const environment = process.env.NEXT_PUBLIC_ENV === "staging" ? "staging" : null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
        <Link href="/admin-dashboard" className="flex items-center gap-2 no-underline">
          <Image src="/ip_logo.svg" alt="" width={22} height={22} />
          <span className="text-sm font-semibold tracking-tight">Infinite Planner</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Admin
          </Badge>
          {environment && <Badge variant="secondary">{environment}</Badge>}
        </Link>
        <ProfileMenu email={user.email ?? "admin"} />
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b p-2 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:p-3">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
