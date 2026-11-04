"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LocalDate } from "@/components/admin/local-date"

// Staging only: replace this environment's airport procedures with production's. One direction, production is never written.
export function SyncCard({
  copyAllowed,
  lastSyncedAt,
  flightsCount,
  timezone,
}: {
  copyAllowed: boolean
  lastSyncedAt: string | null
  flightsCount: number | null
  timezone: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function copy() {
    if (!window.confirm("Replace everything here with production's airport procedures?")) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/admin/procedures/sync", { method: "POST" })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; flights?: number; error?: string } | null
      if (response.ok && body?.ok) {
        setMessage({ ok: true, text: `${body.flights ?? 0} flights copied.` })
        router.refresh()
      } else setMessage({ ok: false, text: body?.error ?? "The copy failed." })
    } catch {
      setMessage({ ok: false, text: "The copy failed." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
      <div>
        <div className="font-medium">Staging copy of production</div>
        <div className="text-muted-foreground">
          {lastSyncedAt ? (
            <>
              Last copied <LocalDate iso={lastSyncedAt} timezone={timezone} />
              {flightsCount !== null ? ` · ${flightsCount} flights` : ""}
            </>
          ) : (
            "Never copied. What you add here stays on staging until the next copy replaces it."
          )}
        </div>
        {message && <div className={message.ok ? "text-emerald-600" : "text-destructive"}>{message.text}</div>}
      </div>
      <Button size="sm" variant="outline" onClick={copy} disabled={busy || !copyAllowed} title={copyAllowed ? undefined : "This database is not set up to receive a copy."}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Copy from production
      </Button>
    </div>
  )
}
