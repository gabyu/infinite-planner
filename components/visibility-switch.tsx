"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { PlanShare, PlanVisibility } from "@/lib/flight-plans"
import { PublishDialog } from "@/components/publish-dialog"
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
  // A shorter label where the column already says "Visibility" (the dashboard table).
  short?: boolean
  // The plan comes from an imported file: publishing needs the declaration (the server also says so if this is wrong).
  requiresDeclaration?: boolean
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
  share,
  onShareChange,
  layout = "field",
  short = false,
  requiresDeclaration = false,
  disabled,
  disabledReason,
  className,
}: VisibilitySwitchProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askConsent, setAskConsent] = useState(false)
  // The publish dialog: shown on every publish; the checkbox is in it when the plan needs the declaration.
  const [askPublish, setAskPublish] = useState(false)
  // Whether the declaration was ticked in the dialog that is being confirmed (kept for the consent retry).
  const [declarationGiven, setDeclarationGiven] = useState(false)
  const [serverWantsDeclaration, setServerWantsDeclaration] = useState(false)

  const isPublic = share.visibility === "public"

  async function choose(visibility: PlanVisibility, declaration = false) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/plans/${planId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, declaration }),
      })
      const body = await response.json().catch(() => null)
      if (response.status === 409 && body?.code === "consent_required") {
        setAskConsent(true)
        return
      }
      if (response.status === 409 && body?.code === "declaration_required") {
        // The server knows better than the page: ask again, with the checkbox.
        setServerWantsDeclaration(true)
        setAskPublish(true)
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
    await choose("public", declarationGiven)
  }

  const t = visibilityCopy
  const helper = disabled && disabledReason ? disabledReason : isPublic ? t.helperPublic : t.helperPrivate

  return (
    <div className={cn(layout === "field" ? "w-full" : "flex flex-wrap items-center gap-2", className)}>
      {/* The label says what turning the switch on does; the switch is always on the right, in the same place. */}
      <div className={cn("flex items-center gap-3", layout === "field" && "justify-between")}>
        <label htmlFor={`visibility-${planId}`} className="whitespace-nowrap text-sm font-medium">
          {short ? t.labelShort : t.label}
        </label>
        <Switch
          id={`visibility-${planId}`}
          checked={isPublic}
          disabled={disabled || busy}
          onCheckedChange={(checked) => (checked ? setAskPublish(true) : choose("private"))}
          aria-describedby={layout === "field" ? `visibility-help-${planId}` : undefined}
        />
      </div>

      {layout === "field" && (
        // One line, always there, so the panel never moves when the plan goes public.
        <div className="mt-1 flex min-h-[1.25rem] items-center justify-between gap-3 text-xs text-muted-foreground">
          <span id={`visibility-help-${planId}`}>{helper}</span>
        </div>
      )}
      {layout === "inline" && disabled && disabledReason && (
        // Where the switch can't be used, the row says why in one line (the field layout has its helper line).
        <p className="basis-full text-xs text-muted-foreground">{disabledReason}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      <PublishDialog
        open={askPublish}
        needsDeclaration={requiresDeclaration || serverWantsDeclaration}
        busy={busy}
        onClose={() => setAskPublish(false)}
        onConfirm={() => {
          const given = requiresDeclaration || serverWantsDeclaration
          setDeclarationGiven(given)
          setAskPublish(false)
          void choose("public", given)
        }}
      />

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
