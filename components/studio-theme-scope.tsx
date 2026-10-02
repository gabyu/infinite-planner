"use client"

import { useLayoutEffect } from "react"

// Radix portals (dialogs, dropdowns, tooltips, toasts) mount on <body>, outside the page
// wrapper. Putting the Studio theme class on <body> while a Studio page is mounted keeps
// them on-theme (same trick as the admin dashboard's AdminThemeScope).
export function StudioThemeScope() {
  useLayoutEffect(() => {
    document.body.classList.add("studio-theme")
    return () => document.body.classList.remove("studio-theme")
  }, [])
  return null
}
