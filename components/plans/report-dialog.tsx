"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { legalCopy as t } from "@/lib/copy"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const REASONS = [
  { value: "inappropriate", label: t.reportReasonInappropriate },
  { value: "copyright", label: t.reportReasonCopyright },
  { value: "wrong_data", label: t.reportReasonWrongData },
  { value: "spam", label: t.reportReasonSpam },
  { value: "other", label: t.reportReasonOther },
]

// Reports a plan to the admins: a reason and an optional word of explanation.
export function ReportDialog({ publicId, onClose }: { publicId: string; onClose: () => void }) {
  const [reason, setReason] = useState("inappropriate")
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/plans/${publicId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details: details.trim() || undefined, pageUrl: window.location.pathname }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null)
    setBusy(false)
    if (!response?.ok) return setError(body?.error ?? t.reportError)
    setSent(true)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{sent ? t.reportThanksTitle : t.reportTitle}</DialogTitle>
          <DialogDescription>
            {sent ? t.reportThanksBody : t.reportIntro}
          </DialogDescription>
        </DialogHeader>
        {!sent && (
          <div className="space-y-3">
            <fieldset className="space-y-1.5">
              <legend className="sr-only">Reason</legend>
              {REASONS.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className="accent-[hsl(var(--primary))]"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t.reportDetailsPlaceholder}
              aria-label="Details"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={onClose}>
            {sent ? "Close" : "Cancel"}
          </Button>
          {!sent && (
            <Button onClick={submit} disabled={busy}>
              {t.reportSend}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
