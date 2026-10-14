"use client"

import { useEffect, useState } from "react"
import { Check, Link2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { PlanShare, PlanVisibility } from "@/lib/flight-plans"
import { planPath } from "@/lib/plan-slug"
import { cn } from "@/lib/utils"

interface VisibilitySwitchProps {
  planId: string
  origin: string
  destination: string
  flightNumber: string | null
  share: PlanShare
  // Called with the new state once the server has applied it.
  onShareChange: (share: PlanShare) => void
  // Shown first on the author's profile (offered while the plan is public).
  featured?: boolean
  onFeaturedChange?: (featured: boolean) => void
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
  featured = false,
  onFeaturedChange,
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

  async function toggleFeatured() {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/plans/${planId}/featured`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !featured }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null)
    setBusy(false)
    if (!response?.ok) return setError(body?.error ?? "Couldn't update your profile. Please try again.")
    onFeaturedChange?.(!featured)
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

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} title={disabled ? disabledReason : undefined}>
      <Switch
        checked={isPublic}
        disabled={disabled || busy}
        onCheckedChange={(checked) => choose(checked ? "public" : "private")}
        aria-label={`Visibility of ${from} to ${to}: ${isPublic ? "public" : "private"}`}
      />
      <span className="text-sm">{isPublic ? "Public" : "Private"}</span>

      {isPublic && link && (
        <>
          <Button variant="ghost" size="icon" onClick={copy} title="Copy the link" aria-label="Copy the link">
            {copied ? <Check /> : <Link2 />}
          </Button>
          {onFeaturedChange && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFeatured}
              disabled={busy}
              aria-pressed={featured}
              title={featured ? "Remove from my profile's featured plans" : "Feature on my profile"}
              aria-label={featured ? "Remove from featured" : "Feature on my profile"}
            >
              <Star className={cn(featured && "fill-primary text-primary")} />
            </Button>
          )}
        </>
      )}
      {error && <span className="basis-full text-xs text-destructive">{error}</span>}

      <Dialog open={askConsent} onOpenChange={setAskConsent}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make this flight plan public?</DialogTitle>
            <DialogDescription>
              Your Discord name and avatar will be shown publicly on this plan, and search engines can index it. You can
              make it private again at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setAskConsent(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={acceptConsent} disabled={busy}>
              Make public
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
