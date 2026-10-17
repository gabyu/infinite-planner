"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { PlanShare, PlanVisibility } from "@/lib/flight-plans"
import { planPath } from "@/lib/plan-slug"
import { visibilityCopy } from "@/lib/copy"
import { cn } from "@/lib/utils"

interface VisibilitySwitchProps {
  planId: string
  origin: string
  destination: string
  flightNumber: string | null
  share: PlanShare
  // Called with the new state once the server has applied it.
  onShareChange: (share: PlanShare) => void
  // "field": the label and the switch on one line, a sentence under them that says what the switch does now, and
  // "Copy link" at the end of that sentence once public. "inline": just the label and the switch (table rows and
  // the plan page, where the link and the sentence are elsewhere).
  layout?: "field" | "inline"
  disabled?: boolean
  disabledReason?: string
  className?: string
}

// The visibility of one exported flight plan: a switch between Private (only you) and Public (listed in
// Explore, indexed by search engines, your Discord name and avatar shown). Changes go through
// /api/plans/{id}/visibility, which asks the database function that owns the rules (only the owner, only an
// exported plan) and drops the cached public page. The first time someone goes public they confirm what that means.
export function VisibilitySwitch({
  planId,
  origin: from,
  destination: to,
  flightNumber,
  share,
  onShareChange,
  layout = "field",
  disabled,
  disabledReason,
  className,
}: VisibilitySwitchProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState("")
  const [askConsent, setAskConsent] = useState(false)
  useEffect(() => setSiteOrigin(window.location.origin), [])

  const isPublic = share.visibility === "public"
  const link =
    isPublic && share.publicId
      ? `${siteOrigin}${planPath({ origin: from, destination: to, flightNumber, publicId: share.publicId })}`
      : ""

  async function choose(visibility: PlanVisibility) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/plans/${planId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      })
      const body = await response.json().catch(() => null)
      if (response.status === 409 && body?.code === "consent_required") {
        setAskConsent(true)
        return
      }
      if (!response.ok) {
        setError(body?.error ?? "Couldn't change the visibility. Please try again.")
        return
      }
      onShareChange({ visibility: body.visibility, publicId: body.publicId })
    } catch {
      setError("Couldn't change the visibility. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function acceptConsent() {
    setBusy(true)
    const response = await fetch("/api/library/consent", { method: "POST" }).catch(() => null)
    setBusy(false)
    setAskConsent(false)
    if (!response?.ok) return setError("Couldn't save your choice. Please try again.")
    await choose("public")
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Couldn't copy the link.")
    }
  }

  const t = visibilityCopy
  const helper = disabled && disabledReason ? disabledReason : isPublic ? t.helperPublic : t.helperPrivate

  return (
    <div className={cn(layout === "field" ? "w-full" : "flex flex-wrap items-center gap-2", className)}>
      {/* The label says what turning the switch on does; the switch is always on the right, in the same place. */}
      <div className={cn("flex items-center gap-3", layout === "field" && "justify-between")}>
        <label htmlFor={`visibility-${planId}`} className="text-sm font-medium">
          {t.label}
        </label>
        <Switch
          id={`visibility-${planId}`}
          checked={isPublic}
          disabled={disabled || busy}
          onCheckedChange={(checked) => choose(checked ? "public" : "private")}
          aria-describedby={layout === "field" ? `visibility-help-${planId}` : undefined}
        />
      </div>

      {layout === "field" && (
        // One line, always there, so the panel never moves when the plan goes public.
        <div className="mt-1 flex min-h-[1.25rem] items-center justify-between gap-3 text-xs text-muted-foreground">
          <span id={`visibility-help-${planId}`}>{helper}</span>
          {isPublic && link && (
            <button
              type="button"
              onClick={copy}
              className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline"
            >
              {copied ? t.copied : t.copyLink}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      <Dialog open={askConsent} onOpenChange={setAskConsent}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share this flight plan with the community?</DialogTitle>
            <DialogDescription>
              It will show up in Explore for everyone to enjoy, with your Discord name and avatar as its author. You can
              make it private again whenever you like.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setAskConsent(false)} disabled={busy}>
              Not now
            </Button>
            <Button onClick={acceptConsent} disabled={busy}>
              Share it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
