import Link from "next/link"
import { CookiePreferencesButton } from "./cookie-preferences-button"

const linkClass = "text-gray-500 dark:text-gray-500 hover:underline underline-offset-2"
const dividerClass = "text-gray-300 dark:text-gray-700"

// Terms / Privacy / Cookie Policy links shown in the footer of every page.
export function LegalLinks({ showCookiePreferences = false }: { showCookiePreferences?: boolean }) {
  return (
    <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
      <Link href="/terms" className={linkClass}>
        Terms of Service
      </Link>
      <span className={dividerClass}>·</span>
      <Link href="/privacy" className={linkClass}>
        Privacy Policy
      </Link>
      <span className={dividerClass}>·</span>
      <Link href="/cookies" className={linkClass}>
        Cookie Policy
      </Link>
      {showCookiePreferences && (
        <>
          <span className={dividerClass}>·</span>
          <CookiePreferencesButton variant="link" />
        </>
      )}
    </nav>
  )
}
