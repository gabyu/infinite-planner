"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TrimAirport } from "@/lib/ground-trim"
import { isRunwayFlag } from "@/lib/procedure-flags"
import { OCTANTS, octantOf } from "@/lib/procedure-coverage"
import type { ProcedureRow } from "@/lib/procedure-ingest"
import { runwayEnds } from "@/lib/runway-guide"
import { loadAirport, RunwayMap } from "@/components/admin/procedures/runway-map"
import { cn } from "@/lib/utils"

// The import of flight files, one procedure per screen. A flight gives two (the departure at its origin, the arrival at its
// destination): each gets a map zoomed on its airport so the admin can see which runway was used and where the flight went, can
// correct the runway (click a runway end, or pick it) and the direction, or leave the procedure out. The last screen lists
// everything and imports it in one go. Nothing is saved before that.
export interface PendingRow extends ProcedureRow {
  id: string
  file: string
  include: boolean
  status?: "added" | "duplicate" | "error"
}

const select = "h-8 rounded-md border border-input bg-background px-2 text-sm"

interface WizardProps {
  rows: PendingRow[]
  onClose: () => void
  /** Called once something was saved, so the page can refresh. */
  onSaved: () => void
}

export function ImportWizard({ rows: initial, onClose, onSaved }: WizardProps) {
  const [rows, setRows] = useState<PendingRow[]>(initial)
  const [step, setStep] = useState(0)
  const [airports, setAirports] = useState<Record<string, TrimAirport | null>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only procedures on the ground at their airport have a screen; the others are mentioned on the last one.
  const steps = rows.filter((row) => row.kind !== "unknown")
  const skipped = rows.length - steps.length
  const review = step >= steps.length
  const current = review ? null : steps[step]

  useEffect(() => {
    let cancelled = false
    for (const icao of new Set(rows.map((row) => row.airport))) {
      void loadAirport(icao).then((data) => !cancelled && setAirports((all) => (icao in all ? all : { ...all, [icao]: data })))
    }
    return () => {
      cancelled = true
    }
  }, [rows])

  const patch = (id: string, change: Partial<PendingRow>) => setRows((all) => all.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const runwaysOf = (icao: string) => Array.from(new Set((airports[icao] ? runwayEnds(airports[icao]!) : []).map((end) => end.name))).sort()
  const chosen = steps.filter((row) => row.include && row.status !== "added")
  const withoutRunway = chosen.filter((row) => !row.runway).length
  const done = steps.length > 0 && steps.every((row) => !row.include || row.status === "added" || row.status === "duplicate")

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = chosen.map(({ id: _id, file: _file, include: _include, status: _status, ...row }) => ({ ...row, needs_check: row.runway === null, flags: row.runway ? row.flags.filter((f) => !isRunwayFlag(f)) : row.flags }))
      const response = await fetch("/api/admin/procedures/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: payload }) })
      const body = (await response.json().catch(() => null)) as { results?: { content_hash: string; airport: string; added: boolean; error?: string }[]; error?: string } | null
      if (!response.ok || !body?.results) return setError(body?.error ?? "Couldn't save the procedures.")
      const byKey = new Map(body.results.map((r) => [`${r.airport}|${r.content_hash}`, r]))
      setRows((all) =>
        all.map((row) => {
          const result = byKey.get(`${row.airport}|${row.content_hash}`)
          if (!result || !row.include) return row
          return { ...row, status: result.added ? "added" : result.error?.includes("Already") ? "duplicate" : "error" }
        }),
      )
      onSaved()
    } catch {
      setError("Couldn't save the procedures.")
    } finally {
      setSaving(false)
    }
  }

  const label = (row: PendingRow) => `${row.airport} ${row.kind === "arrival" ? "arrival" : "departure"}`
  const direction = (row: PendingRow) => (row.bearing === null ? "" : octantOf(row.bearing))

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {current ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Procedure {step + 1} of {steps.length}
              </DialogTitle>
              <DialogDescription>
                <span className="font-mono font-medium text-foreground">{label(current)}</span> · <span className="font-mono">{current.route}</span> · {current.file}
              </DialogDescription>
            </DialogHeader>
            <RunwayMap mapKey={current.id} label={`${current.airport} and the ${current.kind} track`} track={current.track} runway={current.runway} airport={airports[current.airport] ?? null} onPick={(runway) => patch(current.id, { runway })} />
            <p className="-mt-1 text-xs text-muted-foreground">Click a runway end on the map, or pick it below. The line is the flight, coloured by altitude.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                Runway
                <select className={cn(select, !current.runway && "border-amber-500")} value={current.runway ?? ""} onChange={(e) => patch(current.id, { runway: e.target.value || null })}>
                  <option value="">Choose</option>
                  {runwaysOf(current.airport).map((runway) => (
                    <option key={runway} value={runway}>
                      {runway}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                {current.kind === "arrival" ? "Coming from" : "Heading to"}
                <select
                  className={select}
                  value={direction(current)}
                  // Picking a direction sets the bearing to the middle of it; leaving it alone keeps the measured one.
                  onChange={(e) => patch(current.id, { bearing: e.target.value ? OCTANTS.indexOf(e.target.value as (typeof OCTANTS)[number]) * 45 : null })}
                >
                  {direction(current) === "" && <option value="">Choose</option>}
                  {OCTANTS.map((octant) => (
                    <option key={octant} value={octant}>
                      {octant}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={!current.include} onChange={(e) => patch(current.id, { include: !e.target.checked })} />
                Leave this one out
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0}>
                <ArrowLeft /> Previous
              </Button>
              <Button size="sm" onClick={() => setStep((n) => n + 1)}>
                {step === steps.length - 1 ? "Review" : "Next"} <ArrowRight />
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{done ? "Import done" : `Import ${chosen.length} procedure${chosen.length === 1 ? "" : "s"}?`}</DialogTitle>
              <DialogDescription>
                {done ? "The procedures are in the database." : "Nothing is saved until you confirm. Click a line to go back to its screen."}
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-md border text-sm">
              {steps.map((row, i) => (
                <li key={row.id}>
                  <button type="button" onClick={() => setStep(i)} disabled={row.status === "added"} className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left hover:bg-accent/50 disabled:hover:bg-transparent">
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                    <span className={cn("min-w-0 flex-1", !row.include && "text-muted-foreground line-through")}>
                      <span className="font-mono font-medium">{row.airport}</span> {row.kind === "arrival" ? "arrival" : "departure"} · runway{" "}
                      <span className={cn("font-mono", !row.runway && "text-amber-600 dark:text-amber-400")}>{row.runway ?? "?"}</span> · {row.kind === "arrival" ? "from" : "to"}{" "}
                      {direction(row) || "?"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{row.route}</span>
                    {row.status ? (
                      <span className={cn("flex items-center gap-1 text-xs", row.status === "added" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {row.status === "added" && <Check className="h-3 w-3" />}
                        {row.status === "added" ? "Added" : row.status === "duplicate" ? "Already there" : "Not saved"}
                      </span>
                    ) : (
                      !row.include && <span className="text-xs text-muted-foreground">Left out</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {(skipped > 0 || withoutRunway > 0) && (
              <p className="text-xs text-muted-foreground">
                {skipped > 0 && `${skipped} not on the ground at their airport, left out. `}
                {withoutRunway > 0 && `${withoutRunway} without a runway: they will be marked to check.`}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(0, steps.length - 1))} disabled={saving || steps.length === 0}>
                <ArrowLeft /> Previous
              </Button>
              {done ? (
                <Button size="sm" onClick={onClose}>
                  Close
                </Button>
              ) : (
                <Button size="sm" onClick={save} disabled={saving || chosen.length === 0}>
                  {saving && <Loader2 className="animate-spin" />}
                  Import {chosen.length}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
