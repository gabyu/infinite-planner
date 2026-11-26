"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Check, Loader2 } from "lucide-react"
import { copy, guideLegText } from "@/lib/copy"
import type { TrimAirport, TrimPoint } from "@/lib/ground-trim"
import type { PhaseSplit } from "@/lib/route-phases"
import {
  applyArrivalGuide,
  applyGuide,
  extractArrival,
  extractDeparture,
  findRunwayEnd,
  rankGuides,
  type ApplyMode,
  type ArrivalExtraction,
  type DepartureExtraction,
  type GuidePoint,
} from "@/lib/runway-guide"
import { deleteGuide, fetchGuides, GuideError, saveGuide, type GuideErrorKey, type GuideKind, type StoredGuide } from "@/lib/runway-guide-client"
import { cn } from "@/lib/utils"

const ERROR_TEXT: Record<GuideErrorKey, string> = {
  tooMany: copy.guides.errTooMany,
  notSaved: copy.guides.errNotSaved,
  notDraft: copy.guides.errNotDraft,
  notFound: copy.guides.errGeneric,
  generic: copy.guides.errGeneric,
}
const MAX_LISTED = 8
const SIDES = [
  { key: "north", text: copy.guides.north },
  { key: "east", text: copy.guides.east },
  { key: "south", text: copy.guides.south },
  { key: "west", text: copy.guides.west },
] as const
// Which side of the compass a bearing heads to (north is 315-45, and so on).
const sideOf = (bearing: number) => Math.floor((((bearing % 360) + 360 + 45) % 360) / 90)

interface RunwayGuidesProps {
  /** Which part of the flight: the procedures of the departure airport, or of the arrival airport. */
  kind?: GuideKind
  /** Signed in, and the database is reachable. Guides are private to their owner, so nothing is shown otherwise. */
  supabase: SupabaseClient | null
  icao: string
  /** The airport code (departure or arrival, by `kind`) is valid and complete. */
  valid: boolean
  /** The plan as it stands in the editor. */
  waypoints: TrimPoint[]
  split: PhaseSplit
  /** The airport's runway data (the editor's cached loader). */
  loadAirport: (icao: string) => Promise<TrimAirport | null>
  /** The saved plan, if it has been saved; guides can only be saved from, and used on, a saved plan. */
  planId: string | null
  /** A guide can only be used on a draft: an exported plan is locked. */
  planIsDraft: boolean
  /** The runway the pilot tapped in the airport card, if any. */
  targetRunway: string | null
  /** Shows a path over the route on the map, or clears it. */
  onPreview: (path: { lat: number; lng: number }[] | null) => void
  /** Puts a guide's path into the plan in place of its departure (or arrival: `fromIndex` is where the arrival part starts). Throws when it could not be done. */
  onApply: (points: GuidePoint[], guide: StoredGuide, mode: ApplyMode, fromIndex?: number) => Promise<void>
  onNotify: (title: string, description?: string) => void
  /** The plan's other airport: names the original in the list ("Original, to KSFO" for a departure, "Original, from LFPG" for an arrival). */
  destination: string
  /** Puts the plan's own departure back, as it was before the first procedure was applied. False when it could not. */
  onRestore: () => boolean
  /** Step 2 is over (applied, saved or kept): the runway, and the leg now in the plan when known. */
  onDone: (runway: string, leg: string | null) => void
  /** Inside the airport card (no frame of its own) rather than a card of its own. */
  embedded?: boolean
  className?: string
}

// Step 2 of the airport block: the departure (or arrival) this plan has, with a button to save it as a guide, and the
// saved guides of the chosen runway to preview and apply. Nothing changes in the plan until Apply is pressed, and Apply
// is one undo step. "Keep mine" ends the step without changing anything.
export function RunwayGuides({
  kind = "departure",
  supabase,
  icao,
  valid,
  waypoints,
  split,
  loadAirport,
  planId,
  planIsDraft,
  targetRunway,
  onPreview,
  onApply,
  onNotify,
  destination,
  onRestore,
  onDone,
  embedded = false,
  className,
}: RunwayGuidesProps) {
  const [airport, setAirport] = useState<TrimAirport | null>(null)
  const [guides, setGuides] = useState<StoredGuide[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFor, setSavedFor] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // The departure the plan had before the first procedure was applied (kept until restored or the airport changes).
  const [original, setOriginal] = useState<{ icao: string; runway: string | null; nm: number; bearing: number; destination: string } | null>(null)
  const enabled = supabase !== null && valid && /^[A-Z]{4}$/.test(icao)

  useEffect(() => {
    if (!enabled) return setAirport(null)
    let cancelled = false
    void loadAirport(icao).then((data) => !cancelled && setAirport(data))
    return () => {
      cancelled = true
    }
  }, [enabled, icao, loadAirport])

  const refresh = useCallback(async () => {
    if (!supabase || !enabled) return
    try {
      setGuides(await fetchGuides(supabase, icao, kind))
    } catch {
      setGuides([])
    }
  }, [supabase, enabled, icao, kind])
  useEffect(() => {
    setOriginal((current) => (current && current.icao === icao ? current : null))
  }, [icao])
  useEffect(() => {
    setGuides(null)
    setPreviewId(null)
    onPreview(null)
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // The departure (or arrival) this plan has, detected; or, when the detection cannot tell, the runway the pilot assigned by tapping.
  const extract = useCallback(
    (assigned?: string): DepartureExtraction | ArrivalExtraction | null =>
      !airport ? null : kind === "arrival" ? extractArrival(waypoints, airport, split, assigned) : extractDeparture(waypoints, airport, split, assigned),
    [airport, kind, waypoints, split],
  )
  const detected = useMemo(() => extract(), [extract])
  const shown = useMemo(() => {
    if (!airport || !detected) return detected
    if (detected.confidence === "high" || !targetRunway) return detected
    return extract(targetRunway) ?? detected
  }, [airport, detected, extract, targetRunway])
  const arriving = kind === "arrival"
  const sideLabel = arriving ? copy.guides.arriving : copy.guides.departing

  const target = airport && targetRunway ? findRunwayEnd(airport, targetRunway) : null
  const ranked = useMemo(() => {
    if (!target || !guides) return []
    // Only the procedures saved for the runway picked above; ones from other runways are not offered.
    const candidates = guides.filter((guide) => guide.runwayName === target.name).map((guide) => ({
      id: guide.id,
      runwayEnd: guide.runwayName,
      runwayHeadingTrue: guide.runwayHeadingDeg,
      tocBearing: guide.tocBearingDeg,
      useCount: guide.useCount,
      guide,
    }))
    return rankGuides(candidates, target, detected?.tocBearing ?? null).slice(0, MAX_LISTED)
  }, [target, guides, detected])

  const layOnto = (guide: StoredGuide) => {
    if (!airport || !target) return null
    const source = guide.runwayName ? findRunwayEnd(airport, guide.runwayName) : null
    const geometry = { runwayEnd: guide.runwayName, runwayHeadingTrue: guide.runwayHeadingDeg, points: guide.points }
    return arriving ? applyArrivalGuide(geometry, source, target) : applyGuide(geometry, source, target)
  }

  const togglePreview = (guide: StoredGuide) => {
    if (previewId === guide.id) {
      setPreviewId(null)
      return onPreview(null)
    }
    const applied = layOnto(guide)
    if (!applied) return
    // A departure: the new path, then on to the plan's next waypoint. An arrival: from the plan's waypoint before it, then the new path.
    setPreviewId(guide.id)
    if (arriving) {
      const from = (shown as ArrivalExtraction | null)?.fromIndex ?? split.arrivalStart
      const before = waypoints[from - 1]
      onPreview([...(before ? [before] : []), ...applied.points])
    } else {
      const next = waypoints[split.departureEnd + 1]
      onPreview([...applied.points, ...(next ? [next] : [])])
    }
  }

  const save = async () => {
    if (!supabase || !planId || !shown || !shown.runwayEnd) return
    setSaving(true)
    try {
      await saveGuide(supabase, planId, icao, shown, undefined, kind)
      setSavedFor(`${planId}:${shown.runwayEnd}:${shown.points.length}`)
      onNotify(copy.guides.savedToast)
      await refresh()
      onDone(shown.runwayEnd, guideLegText(shown.tocDistanceNm, shown.tocBearing))
    } catch (error) {
      onNotify(ERROR_TEXT[error instanceof GuideError ? error.key : "generic"])
    } finally {
      setSaving(false)
    }
  }

  const use = async (guide: StoredGuide) => {
    const applied = layOnto(guide)
    if (!applied) return
    setBusyId(guide.id)
    const before = original ?? (shown ? { icao, runway: shown.runwayEnd, nm: shown.tocDistanceNm, bearing: shown.tocBearing, destination } : null)
    try {
      await onApply(applied.points, guide, applied.mode, arriving ? (shown as ArrivalExtraction | null)?.fromIndex : undefined)
      if (before && !original) setOriginal(before)
      setPreviewId(null)
      onPreview(null)
      if (target) onDone(target.name, guideLegText(guide.tocDistanceNm, guide.tocBearingDeg))
      await refresh()
    } catch (error) {
      onNotify(ERROR_TEXT[error instanceof GuideError ? error.key : "generic"])
    } finally {
      setBusyId(null)
    }
  }

  const restore = () => {
    if (!onRestore()) return
    setOriginal(null)
    setPreviewId(null)
    onPreview(null)
  }

  const remove = async (guide: StoredGuide) => {
    if (!supabase) return
    if (confirmDelete !== guide.id) return setConfirmDelete(guide.id)
    setConfirmDelete(null)
    if (previewId === guide.id) {
      setPreviewId(null)
      onPreview(null)
    }
    try {
      await deleteGuide(supabase, guide.id)
      await refresh()
    } catch (error) {
      onNotify(ERROR_TEXT[error instanceof GuideError ? error.key : "generic"])
    }
  }

  // Inside the airport block step 2 always has its "Keep mine", even with nothing detected and nothing saved.
  if (!enabled || !airport || (!embedded && !shown && (guides?.length ?? 0) === 0)) return null

  const canSave = Boolean(planId && shown && shown.runwayEnd && shown.confidence === "high")
  const justSaved = shown && planId && savedFor === `${planId}:${shown.runwayEnd}:${shown.points.length}`
  const hasGuides = (guides?.length ?? 0) > 0
  // A saved guide is the one the plan already flies: same runway, nearly the same bearing and distance to the top of climb.
  const isInPlan = (guide: StoredGuide) =>
    Boolean(
      shown?.runwayEnd &&
        guide.runwayName === shown.runwayEnd &&
        Math.abs(((guide.tocBearingDeg - shown.tocBearing + 540) % 360) - 180) <= 2 &&
        Math.abs(guide.tocDistanceNm - shown.tocDistanceNm) <= 0.5,
    )
  const planIsSaved = Boolean(justSaved) || (guides?.some(isInPlan) ?? false)
  // "Your procedure" and its Save button only matter while the plan's departure is not saved yet and the pilot looks at its
  // own runway. Once saved, or when another runway is picked, the list below carries the state (the saved one is marked).
  const showYours = Boolean(shown) && !planIsSaved && (!target || !shown?.runwayEnd || shown.runwayEnd === target.name)

  const sideText = (bearing: number) => SIDES[sideOf(bearing)].text
  const smallButton = "h-7 shrink-0 rounded-md border px-2 font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
  // The folded line shows what the plan really flies: its own runway when detected, else the one chosen above.
  const keep = () => {
    const runway = shown?.runwayEnd ?? target?.name
    if (!runway) return
    setPreviewId(null)
    onPreview(null)
    onDone(runway, shown?.runwayEnd ? guideLegText(shown.tocDistanceNm, shown.tocBearing) : null)
  }

  return (
    <div className={cn("space-y-1.5 text-xs", embedded ? "px-3 pb-2.5" : "rounded-lg border px-3 py-2.5", className)}>
      {showYours && shown && (
        <div className="space-y-1.5 border-b pb-2">
          <div className="flex items-center gap-2">
            {shown.runwayEnd ? (
              <p className="flex min-w-0 flex-1 gap-2">
                <span className="w-10 shrink-0 text-muted-foreground">{copy.guides.yours}</span>
                <span className="truncate font-medium text-foreground">
                  {sideText(shown.tocBearing)} · {guideLegText(shown.tocDistanceNm, shown.tocBearing)}
                </span>
              </p>
            ) : (
              <p className="min-w-0 flex-1 text-muted-foreground">{arriving ? copy.guides.lowConfidenceArrival : copy.guides.lowConfidence}</p>
            )}
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={save}
              title={!planId ? copy.guides.needsPlan : undefined}
              className={cn(smallButton, "flex items-center gap-1.5")}
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {saving ? copy.guides.saving : copy.guides.save}
            </button>
          </div>
          {!planId && <p className="text-muted-foreground">{copy.guides.needsPlan}</p>}
        </div>
      )}

      {target && guides && (
        <div className="space-y-1.5">
          {ranked.length === 0 && <p className="text-muted-foreground">{copy.guides.noGuides}</p>}
          {original && original.runway === target.name && (
            <div className="flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-foreground">{guideLegText(original.nm, original.bearing)}</span>
                <span className="text-muted-foreground">{` · ${copy.guides.original}${original.destination ? `, ${arriving ? copy.guides.from : "to"} ${original.destination}` : ""}`}</span>
              </span>
              <button type="button" onClick={restore} className={smallButton}>
                {copy.guides.restore}
              </button>
            </div>
          )}
          {ranked.map(({ guide }) => {
            const applied = layOnto(guide.guide)
            const previewing = previewId === guide.id
            const inPlan = isInPlan(guide.guide)
            return (
              <div key={guide.id} className={cn("overflow-hidden rounded-md border", inPlan && "border-foreground/30 bg-muted/50", previewing && "border-primary")}>
                <button
                  type="button"
                  aria-expanded={previewing}
                  onClick={() => togglePreview(guide.guide)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/50"
                >
                  <span className="w-10 shrink-0 text-muted-foreground">{sideText(guide.guide.tocBearingDeg)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{guideLegText(guide.guide.tocDistanceNm, guide.guide.tocBearingDeg)}</span>
                  {inPlan && <Check className="h-3 w-3 shrink-0 text-foreground" aria-label={copy.guides.inPlan} />}
                </button>
                {previewing && (
                  <div className="space-y-1.5 border-t px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => remove(guide.guide)}
                        className={cn("h-7 rounded-md px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive", confirmDelete === guide.id && "bg-destructive/10 text-destructive")}
                      >
                        {confirmDelete === guide.id ? copy.guides.removeConfirm : copy.guides.remove}
                      </button>
                      <button
                        type="button"
                        disabled={!planId || !planIsDraft || busyId !== null}
                        onClick={() => use(guide.guide)}
                        title={!planId ? copy.guides.needsPlan : !planIsDraft ? copy.guides.needsDraft : undefined}
                        className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === guide.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                        {copy.guides.apply}
                      </button>
                    </div>
                    {planId && !planIsDraft && <p className="text-muted-foreground">{copy.guides.needsDraft}</p>}
                    {applied?.mode === "joined" && <p className="text-amber-700 dark:text-amber-300">{copy.guides.joinWarning}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!target && hasGuides && !embedded && <p className="text-muted-foreground">{copy.guides.tapRunway}</p>}
      {embedded && (target || shown?.runwayEnd) && (
        <div className="flex justify-end">
          <button type="button" onClick={keep} className="link inline-flex min-h-6 items-center">
            {copy.guides.keepMine}
          </button>
        </div>
      )}
    </div>
  )
}
