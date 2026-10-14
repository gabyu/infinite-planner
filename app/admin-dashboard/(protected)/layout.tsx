import type React from "react"
import { AdminFooter } from "@/components/admin/admin-footer"
import { AdminTabs } from "@/components/admin/admin-tabs"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { requireAdmin } from "@/lib/admin/auth"

// Dashboard shell: the same site header as every other page, then the section tabs.
// Every route in this group needs an active admin; the middleware redirects first, this
// re-checks on the server.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const environment = process.env.NEXT_PUBLIC_ENV === "staging" ? "staging" : null

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="container mx-auto flex items-center justify-between gap-3 px-4 pt-4">
        <AdminTabs />
        {environment && <Badge variant="secondary">{environment}</Badge>}
      </div>

      <main className="container mx-auto min-w-0 flex-1 px-4 py-6">{children}</main>

      <AdminFooter />
    </div>
  )
}
