"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RouteArrow } from "@/components/route-arrow"
import type { PlanShare, PlanVisibility } from "@/lib/flight-plans"
import { planPath } from "@/lib/plan-slug"
import { cn } from "@/lib/utils"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  origin: string
  destination: string
  flightNumber: string | null
  share: PlanShare
  // Called with the new state once the server has applied it.
  onShareChange: (share: PlanShare) => void
  // Offer "Public" (listed in the library, indexed). Off until the library is open to this user.
  allowPublic?: boolean
}

const OPTIONS: { value: PlanVisibility; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only you can open this flight plan." },
  {
    value: "unlisted",
    label: "Unlisted",
    hint: "Anyone with the link can view it. It isn't listed anywhere and search engines are told to skip it. Your Discord username is shown as its author.",
  },
  {
    value: "public",
    label: "Public",
    hint: "Listed in the library and indexed by search engines. Your Discord name and avatar are shown as its author.",
  },
]

// The whole sharing UI: one small modal with a three-way control. Changes go through
// /api/plans/{id}/visibility, which asks the database function that owns the rules (only the
// owner, only an exported plan) and drops the cached public page.
export function ShareDialog({
  open,
  onOpenChange,
  planId,
  origin: from,
  destination: to,
  flightNumber,
  share,
  onShareChange,
  allowPublic = false,
}: ShareDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState("")

  useEffect(() => setSiteOrigin(window.location.origin), [])
  useEffect(() => {
    if (open) {
      setError(null)
      setCopied(false)
    }
  }, [open])

  const link =
    share.publicId && share.visibility !== "private"
      ? `${siteOrigin}${planPath({ origin: from, destination: to, flightNumber, publicId: share.publicId })}`
      : ""

  async function choose(visibility: PlanVisibility) {
    if (visibility === share.visibility || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/plans/${planId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      })
      const body = await response.json().catch(() => null)
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the field is selectable, so the link can still be copied by hand.
      setError("Couldn't copy automatically. Select the link and copy it.")
    }
  }

  const options = OPTIONS.filter((option) => option.value !== "public" || allowPublic)
  const current = OPTIONS.find((option) => option.value === share.visibility) ?? OPTIONS[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base">Share flight plan</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {from}
            <RouteArrow />
            {to}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <div role="radiogroup" aria-label="Who can open this flight plan" className="flex rounded-full bg-muted p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={share.visibility === option.value}
                disabled={busy}
                onClick={() => choose(option.value)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  share.visibility === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">{current.hint}</p>

          {link && (
            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                aria-label="Link to this flight plan"
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={copy} className="shrink-0">
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}

          {share.visibility !== "private" && (
            <p className="text-xs text-muted-foreground">
              Switch back to Private at any time and the link stops working. Search engines and caches can take a while
              to forget a page.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
