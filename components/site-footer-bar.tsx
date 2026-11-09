"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import { CounterDisplay } from "./counter-display"
import { CookiePreferencesButton } from "./cookie-preferences-button"
import { SIMULATION_DISCLAIMER } from "@/lib/brand"

export const DONATE_URL = "https://ko-fi.com/infiniteplanner"

const linkClass = "link-quiet text-gray-500 dark:text-gray-500"

// One slim bar; the legal links, the disclaimers and the counter unfold under "Legal".
export function SiteFooterBar() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="container mx-auto px-4">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm text-gray-500">
        <span>© {new Date().getFullYear()} Infinite Planner</span>
        <div className="flex items-center gap-x-4">
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Donate &lt;3
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className={`${linkClass} inline-flex items-center gap-1`}
          >
            Legal
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div id={panelId} hidden={!open} className="space-y-2 pb-4 text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700 dark:text-gray-300">
          <CounterDisplay initialCount={0} /> flight plans generated so far!
        </p>
        <p>Infinite Planner is not affiliated with FlightRadar24, FlightAware, or Infinite Flight.</p>
        <p>{SIMULATION_DISCLAIMER}</p>
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/terms" className={linkClass}>Terms of Service</Link>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <Link href="/privacy" className={linkClass}>Privacy Policy</Link>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <Link href="/cookies" className={linkClass}>Cookie Policy</Link>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <CookiePreferencesButton variant="link" />
        </nav>
      </div>
    </div>
  )
}
