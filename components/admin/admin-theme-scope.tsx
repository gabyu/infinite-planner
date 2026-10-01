"use client"

import { useLayoutEffect } from "react"

// Radix portals (dropdowns, dialogs) mount on <body>, outside the dashboard wrapper.
// Putting the theme class on <body> while the admin area is mounted keeps them on-theme.
export function AdminThemeScope() {
  useLayoutEffect(() => {
    document.body.classList.add("admin-theme")
    return () => document.body.classList.remove("admin-theme")
  }, [])
  return null
}
