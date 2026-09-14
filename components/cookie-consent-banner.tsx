"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  COOKIE_PREFERENCES_OPEN_EVENT,
  getStoredConsent,
  setConsent,
} from "@/lib/cookie-consent"

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getStoredConsent()?.decided) {
      setVisible(true)
    }

    // Reopened from the footer's "Cookie preferences" link, so people can
    // change their mind just as easily as they gave consent in the first place.
    const handleReopen = () => setVisible(true)
    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, handleReopen)
    return () => window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, handleReopen)
  }, [])

  if (!visible) return null

  const handleChoice = (analytics: boolean) => {
    setConsent(analytics)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-[100] sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-full sm:max-w-lg sm:-translate-x-1/2"
    >
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-lg sm:flex-row sm:items-start sm:p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <Cookie className="h-5 w-5" />
        </div>

        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">We use one optional cookie</p>
            <p className="text-sm text-muted-foreground">
              Infinite Planner doesn't set any cookies of its own. If you agree, we'll load{" "}
              <span className="font-medium text-foreground">Google Analytics</span> to see how many people use the
              planner - nothing else changes either way.{" "}
              <Link href="/cookies" className="underline underline-offset-2 hover:text-foreground">
                Learn more
              </Link>
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleChoice(true)} className="flex-1 sm:flex-none">
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleChoice(false)} className="flex-1 sm:flex-none">
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
