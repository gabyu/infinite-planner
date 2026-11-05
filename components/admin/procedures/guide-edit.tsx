"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TrimAirport } from "@/lib/ground-trim"
import { guideLegText } from "@/lib/copy"
import { OCTANTS, octantOf } from "@/lib/procedure-coverage"
import type { MemberGuide } from "@/lib/procedures-db"
import { findRunwayEnd, fromRunwayFrame, runwayEnds, toRunwayFrame } from "@/lib/runway-guide"
import { loadAirport, RunwayMap } from "@/components/admin/procedures/runway-map"
import { cn } from "@/lib/utils"

// Correct a procedure a member saved: the runway it belongs to and the direction it goes. Same controls as the import review.
// A guide whose runway was wrong keeps its path where it is on the ground (only its runway changes); one saved without a runway has
// no known position, so its path is laid on the runway that gets picked.
const select = "h-8 rounded-md border border-input bg-background px-2 text-sm"

export function GuideEdit({ guide, onClose, onSaved }: { guide: MemberGuide; onClose: () => void; onSaved: () => void }) {
  const [airport, setAirport] = useState<TrimAirport | null>(null)
  const [runway, setRunway] = useState<string | null>(guide.runway)
  const [direction, setDirection] = useState<string>(octantOf(guide.bearingDeg))
  const [directionTouched, setDirectionTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAirport(guide.airport).then((data) => !cancelled && setAirport(data))
    return () => {
      cancelled = true
    }
  }, [guide.airport])

  const oldEnd = airport && guide.runway ? findRunwayEnd(airport, guide.runway) : null
  const newEnd = airport && runway ? findRunwayEnd(airport, runway) : null
  const runways = useMemo(() => (airport ? Array.from(new Set(runwayEnds(airport).map((end) => end.name))).sort() : []), [airport])

  // The path on the ground: where it was recorded when its runway is known, else laid on the runway being picked.
  const frameEnd = oldEnd ?? newEnd
  const ground = useMemo(
    () => (frameEnd ? guide.points.map(([along, across, altitude]) => ({ ...fromRunwayFrame({ along, across, altitude }, frameEnd), altitude })) : []),
    [guide.points, frameEnd],
  )
  const track = useMemo(() => ground.map((p) => [p.lat, p.lng, p.altitude] as [number, number, number]), [ground])

  async function save() {
    if (!newEnd || !runway) return
    setSaving(true)
    setError(null)
    // Re-expressed in the new runway's frame when the old one was known; otherwise the path was already laid on it.
    const points = oldEnd ? ground.map((p) => { const f = toRunwayFrame(p, newEnd); return [f.along, f.across, f.altitude] }) : guide.points
    const bearing = directionTouched ? OCTANTS.indexOf(direction as (typeof OCTANTS)[number]) * 45 : guide.bearingDeg
    try {
      const response = await fetch("/api/admin/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateGuide", id: guide.id, airport: guide.airport, runway, bearing, points }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) return setError(body?.error ?? "Couldn't save the procedure.")
      onSaved()
      onClose()
    } catch {
      setError("Couldn't save the procedure.")
    } finally {
      setSaving(false)
    }
  }

  const arrival = guide.kind === "arrival"
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit procedure</DialogTitle>
          <DialogDescription>
            <span className="font-mono font-medium text-foreground">
              {guide.airport} {arrival ? "arrival" : "departure"}
            </span>{" "}
            · {guideLegText(guide.distanceNm, guide.bearingDeg)} · saved by {guide.ownerName ?? "a member"}
          </DialogDescription>
        </DialogHeader>
        <RunwayMap mapKey={`${guide.id}:${oldEnd ? "old" : (runway ?? "none")}`} label={`${guide.airport} and the saved path`} track={track} runway={runway} airport={airport} onPick={setRunway} />
        <p className="-mt-1 text-xs text-muted-foreground">
          {guide.runway
            ? "Click the runway end this procedure really uses, or pick it below. The path stays where it is."
            : "This procedure has no runway. Click a runway end, or pick it below: the path is laid on it."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            Runway
            <select className={cn(select, !runway && "border-amber-500")} value={runway ?? ""} onChange={(e) => setRunway(e.target.value || null)}>
              {!runway && <option value="">Choose</option>}
              {runways.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            {arrival ? "Coming from" : "Heading to"}
            <select
              className={select}
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value)
                setDirectionTouched(true)
              }}
            >
              {OCTANTS.map((octant) => (
                <option key={octant} value={octant}>
                  {octant}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !newEnd}>
            {saving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
