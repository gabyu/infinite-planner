"use client"

import { useEffect, useState } from "react"

// True on devices whose primary input is touch (phones, tablets), false on
// mouse/trackpad devices - the standard "pointer: coarse" media feature,
// not user-agent sniffing (which breaks on iPadOS-as-desktop, foldables, etc).
export function useIsTouchPrimary(): boolean {
  const [isTouchPrimary, setIsTouchPrimary] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const mediaQuery = window.matchMedia("(pointer: coarse)")
    setIsTouchPrimary(mediaQuery.matches)

    const onChange = (e: MediaQueryListEvent) => setIsTouchPrimary(e.matches)
    mediaQuery.addEventListener("change", onChange)
    return () => mediaQuery.removeEventListener("change", onChange)
  }, [])

  return isTouchPrimary
}
