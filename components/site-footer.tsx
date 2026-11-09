import { CounterDisplay } from "./counter-display"
import { LegalLinks } from "./legal-links"
import { SupportLink } from "./support-link"
import { SIMULATION_DISCLAIMER } from "@/lib/brand"
import Link from "next/link"

const linkClass = "link-quiet text-gray-500 dark:text-gray-500"
const dot = <span className="text-gray-300 dark:text-gray-700">·</span>

// "full" closes the information pages (counter, support link, legal links, small print).
// "compact" is one thin line for the planner tool (convert, sketch, dashboard), where height belongs to the editor.
export function SiteFooter({ variant = "full" }: { variant?: "full" | "compact" }) {
  const year = new Date().getFullYear()

  if (variant === "compact") {
    return (
      <footer className="border-t">
        <nav
          aria-label="Footer"
          className="container mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-4 py-2 text-xs text-gray-500"
        >
          <span>© {year} Infinite Planner</span>
          {dot}
          <Link href="/terms" className={linkClass}>Terms</Link>
          {dot}
          <Link href="/privacy" className={linkClass}>Privacy</Link>
          {dot}
          <Link href="/cookies" className={linkClass}>Cookies</Link>
          {dot}
          <SupportLink className={linkClass} />
        </nav>
      </footer>
    )
  }

  return (
    <footer className="border-t py-5">
      <div className="container mx-auto space-y-2 px-4 text-center text-sm">
        <p className="font-medium text-gray-700 dark:text-gray-300">
          <CounterDisplay initialCount={0} /> flight plans generated so far! {dot} <SupportLink className={linkClass} />
        </p>
        <LegalLinks showCookiePreferences />
        <p className="text-xs text-gray-500">
          © {year} Infinite Planner. Not affiliated with FlightRadar24, FlightAware, or Infinite Flight. {SIMULATION_DISCLAIMER}
        </p>
      </div>
    </footer>
  )
}
