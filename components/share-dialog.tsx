"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Link2 } from "lucide-react"
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
import { getBrowserSupabase } from "@/lib/supabase/client"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  origin: string
  destination: string
  shareToken: string | null
  // Called with the new token after "Share", or null after "Stop sharing".
  onShareChange: (token: string | null) => void
}

// The whole sharing UI: one small modal. Not shared yet: a Share button. Shared: the link
// with a copy action, and Stop sharing. Both go through database functions (share_flight_plan /
// unshare_flight_plan) that only touch the caller's own plan, so the token is generated
// server-side and a repeated "Share" returns the existing one instead of making a new link.
export function ShareDialog({ open, onOpenChange, planId, origin: from, destination: to, shareToken, onShareChange }: ShareDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => setOrigin(window.location.origin), [])
  useEffect(() => {
    if (open) {
      setError(null)
      setCopied(false)
    }
  }, [open])

  const link = shareToken ? `${origin}/shared/${shareToken}` : ""

  async function share() {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc("share_flight_plan", { plan_id: planId })
    setBusy(false)
    if (rpcError || !data) {
      console.error("Sharing failed:", rpcError?.message)
      setError("Couldn't create the link. Please try again.")
      return
    }
    onShareChange(data as string)
  }

  async function stopSharing() {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc("unshare_flight_plan", { plan_id: planId })
    setBusy(false)
    if (rpcError) {
      console.error("Stopping the share failed:", rpcError.message)
      setError("Couldn't stop sharing. Please try again.")
      return
    }
    onShareChange(null)
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
          {shareToken ? (
            <>
              <p className="text-sm text-muted-foreground">
                Anyone with this link can view and download the flight plan, no account needed. Your Discord username is shown on the link as its author.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  aria-label="Share link"
                  className="font-mono text-xs"
                />
                <Button variant="outline" onClick={copy} className="shrink-0">
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a link anyone can use to view and download this flight plan, no account needed.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The link always shows the plan as it is now, so later changes reach everyone who has it, and people who
            already downloaded it aren&apos;t notified.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          {shareToken ? (
            <Button
              variant="outline"
              onClick={stopSharing}
              disabled={busy}
              className="hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              Stop sharing
            </Button>
          ) : (
            <Button onClick={share} disabled={busy}>
              <Link2 />
              {busy ? "Creating link..." : "Share"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
