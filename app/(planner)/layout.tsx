import type React from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import "./planner.css"

// Shared chrome for the planner tool's routes: /convert (KML import) and
// /sketch (draw from scratch). /planner itself just redirects to /convert.
export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      <SiteHeader />
      <main className="flex-grow">{children}</main>
      <SiteFooter />
    </div>
  )
}
