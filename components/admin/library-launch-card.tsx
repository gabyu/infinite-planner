"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LocalDate } from "@/components/admin/local-date"

interface Props {
  launched: boolean
  launchedAt: string | null
  target: number
  publicPlans: number
  timezone: string | null
}

async function send(body: object) {
  const response = await fetch("/api/admin/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null)
  return !!response?.ok
}

// The library's launch switch. Before the launch only admins can use the library; the counter shows how
// close the seeding is to the target. "Launch to everyone" is one-way from here: there is no button to
// close the library again (the emergency rollback is one line of SQL, written in the release notes).
export function LibraryLaunchCard({ launched, launchedAt, target: initialTarget, publicPlans, timezone }: Props) {
  const router = useRouter()
  const [target, setTarget] = useState(String(initialTarget))
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetNumber = Number(target)
  const validTarget = Number.isInteger(targetNumber) && targetNumber >= 1 && targetNumber <= 100000
  const progress = Math.min(100, Math.round((publicPlans / (validTarget ? targetNumber : initialTarget)) * 100))

  async function saveTarget() {
    if (!validTarget) return setError("Enter a whole number between 1 and 100000.")
    setBusy(true)
    setError(null)
    const ok = await send({ action: "target", target: targetNumber })
    setBusy(false)
    if (!ok) return setError("Couldn't save the target.")
    router.refresh()
  }

  async function launch() {
    setBusy(true)
    setError(null)
    const ok = await send({ action: "launch" })
    setBusy(false)
    setConfirming(false)
    if (!ok) return setError("Couldn't launch the library. Please try again.")
    router.refresh()
  }

  return (
    <section aria-labelledby="library-launch" className="max-w-2xl rounded-lg border bg-card p-5">
      <h2 id="library-launch" className="text-sm font-semibold">
        Library launch
      </h2>

      {launched ? (
        <p className="mt-2 text-sm text-muted-foreground">
          The library is open to everyone
          {launchedAt && (
            <>
              {" "}
              since <LocalDate iso={launchedAt} timezone={timezone} />
            </>
          )}
          . {publicPlans} public plan{publicPlans === 1 ? "" : "s"} are listed.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            The library is in pre-launch mode: only admins can see and use it. Publish plans with the normal Convert and
            Sketch flow, then open it to everyone here.
          </p>

          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span>
                <strong className="font-mono text-base">{publicPlans}</strong> public plans / {validTarget ? targetNumber : initialTarget} target
              </span>
              <span className="font-mono text-muted-foreground">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Public plans toward the launch target"
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="library-target" className="text-sm text-muted-foreground">
              Target
            </label>
            <Input
              id="library-target"
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-24"
            />
            <Button variant="outline" onClick={saveTarget} disabled={busy || target === String(initialTarget)}>
              Save
            </Button>
          </div>

          <div className="mt-5 border-t pt-4">
            <Button onClick={() => setConfirming(true)} disabled={busy}>
              Launch to everyone
            </Button>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Launch the library?</DialogTitle>
            <DialogDescription>
              This makes the library public and indexable. This cannot be undone from the UI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={launch} disabled={busy}>
              {busy ? "Launching..." : "Launch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
