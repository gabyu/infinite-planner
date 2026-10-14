"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type Action =
  | { action: "moderate"; planId: string; status: "ok" | "hidden" }
  | { action: "resolve"; reportId: string; hide: boolean }
  | { action: "block"; userId: string; blocked: boolean }

// A small button that runs one moderation action and refreshes the page. Never optimistic: the table comes
// back from the database.
export function LibraryActionButton({
  action,
  children,
  variant = "outline",
  confirm,
}: {
  action: Action
  children: React.ReactNode
  variant?: "outline" | "destructive" | "ghost"
  confirm?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    setError(null)
    const response = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) {
      setError("Failed")
      return
    }
    router.refresh()
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant={variant} disabled={busy} onClick={run}>
        {children}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
