"use client"

import { useEffect, useState } from "react"
import { Analytics as VercelAnalytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

export function Analytics() {
  // Use client-side only rendering to avoid hydration issues
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <>
      <VercelAnalytics debug={false} />
      <SpeedInsights debug={false} />
    </>
  )
}
