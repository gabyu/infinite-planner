"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// The dashboard is rendered per visit, but the browser can still hand back a copy it kept from an earlier
// visit or prefetch (so a plan just exported was missing until a second click). `renderedAt` is the server
// time of this render: when it is clearly older than the moment the page shows up, ask the server for a fresh
// one. A fresh render costs nothing extra.
const STALE_AFTER_MS = 3000

export function RefreshIfStale({ renderedAt }: { renderedAt: number }) {
  const router = useRouter()
  useEffect(() => {
    if (Date.now() - renderedAt > STALE_AFTER_MS) router.refresh()
  }, [renderedAt, router])
  return null
}
