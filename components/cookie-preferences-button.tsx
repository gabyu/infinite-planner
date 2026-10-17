"use client"

import { Button } from "@/components/ui/button"
import { openCookiePreferences } from "@/lib/cookie-consent"

interface CookiePreferencesButtonProps {
  variant?: "default" | "link"
  className?: string
}

export function CookiePreferencesButton({ variant = "default", className }: CookiePreferencesButtonProps) {
  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={openCookiePreferences}
        className={className ?? "link-quiet text-gray-500 dark:text-gray-500 text-sm"}
      >
        Cookie preferences
      </button>
    )
  }

  return (
    <Button variant="outline" onClick={openCookiePreferences} className={className}>
      Manage cookie preferences
    </Button>
  )
}
