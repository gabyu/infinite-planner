import type React from "react"
import type { Metadata } from "next"
import { AdminThemeScope } from "@/components/admin/admin-theme-scope"

export const metadata: Metadata = {
  title: "Admin - Infinite Planner",
  robots: { index: false, follow: false },
}

// Bare wrapper shared by the login pages and the dashboard (which adds its own shell).
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-theme min-h-screen bg-background text-foreground font-sans antialiased">
      <AdminThemeScope />
      {children}
    </div>
  )
}
