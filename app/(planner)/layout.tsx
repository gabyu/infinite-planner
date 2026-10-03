import type React from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { StudioThemeScope } from "@/components/studio-theme-scope"
import "./planner.css"

// Shared chrome for the planner tool's routes: /convert (KML import), /sketch (draw from
// scratch), /dashboard (saved plans) and /shared/[token] (a plan shared by link).
// /planner itself just redirects to /convert. All of them use the Studio theme.
export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-theme flex min-h-screen flex-col bg-background text-foreground">
      <StudioThemeScope />
      <SiteHeader />
      <main className="flex-grow">{children}</main>
      <SiteFooter />
    </div>
  )
}
