"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Eye, EyeOff, Loader2, PlaneTakeoff, Trash2 } from "lucide-react"
import { copy, guideSummaryText, guidesForText } from "@/lib/copy"
import type { TrimAirport, TrimPoint } from "@/lib/ground-trim"
import type { PhaseSplit } from "@/lib/route-phases"
import {
  applyGuide,
  compassPoint,
  extractDeparture,
  findRunwayEnd,
  rankGuides,
  type ApplyMode,
  type DepartureExtraction,
  type GuideFit,
  type GuidePoint,
} from "@/lib/runway-guide"
import { deleteGuide, fetchGuides, GuideError, saveGuide, type GuideErrorKey, type StoredGuide } from "@/lib/runway-guide-client"
import { cn } from "@/lib/utils"

const ERROR_TEXT: Record<GuideErrorKey, string> = {
  tooMany: copy.guides.errTooMany,
  notSaved: copy.guides.errNotSaved,
  notDraft: copy.guides.errNotDraft,
  notFound: copy.guides.errGeneric,
  generic: copy.guides.errGeneric,
}
const FIT_TEXT: Record<GuideFit, string> = {
  "same end": copy.guides.fitSame,
  parallel: copy.guides.fitParallel,
  "similar heading": copy.guides.fitSimilar,
  other: copy.guides.fitOther,
}
const MAX_LISTED = 4

interface RunwayGuidesProps {
  /** Signed in, and the database is reachable. Guides are private to their owner, so nothing is shown otherwise. */
  supabase: SupabaseClient | null
  icao: string
  /** The departure airport code is valid and complete. */
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
  /** Puts a guide's path into the plan in place of its departure. Throws when it could not be done. */
  onApply: (points: GuidePoint[], guide: StoredGuide, mode: ApplyMode) => Promise<void>
  onNotify: (title: string, description?: string) => void
  className?: string
}

// Under the airport card of the Departure tab: the departure this plan has (its runway and direction) with a button to
// keep it as a guide, and, when the pilot taps another runway, their saved guides for that runway to preview and use.
// Nothing changes in the plan until Use is pressed, and Use is one undo step.
export function RunwayGuides({
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
  className,
}: RunwayGuidesProps) {
  const [airport, setAirport] = useState<TrimAirport | null>(null)
  const [guides, setGuides] = useState<StoredGuide[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFor, setSavedFor] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
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
      setGuides(await fetchGuides(supabase, icao))
    } catch {
      setGuides([])
    }
  }, [supabase, enabled, icao])
  useEffect(() => {
    setGuides(null)
    setPreviewId(null)
    onPreview(null)
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // The departure this plan has, detected; or, when the detection cannot tell, the runway the pilot assigned by tapping.
  const detected = useMemo<DepartureExtraction | null>(() => (airport ? extractDeparture(waypoints, airport, split) : null), [airport, waypoints, split])
  const shown = useMemo<DepartureExtraction | null>(() => {
    if (!airport || !detected) return detected
    if (detected.confidence === "high" || !targetRunway) return detected
    return extractDeparture(waypoints, airport, split, targetRunway) ?? detected
  }, [airport, detected, waypoints, split, targetRunway])

  const target = airport && targetRunway ? findRunwayEnd(airport, targetRunway) : null
  const ranked = useMemo(() => {
    if (!target || !guides) return []
    const candidates = guides.map((guide) => ({
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
    return applyGuide({ runwayEnd: guide.runwayName, runwayHeadingTrue: guide.runwayHeadingDeg, points: guide.points }, source, target)
  }

  const togglePreview = (guide: StoredGuide) => {
    if (previewId === guide.id) {
      setPreviewId(null)
      return onPreview(null)
    }
    const applied = layOnto(guide)
    if (!applied) return
    // The new path, then on to the plan's next waypoint after its own departure (where the plan carries on).
    const next = waypoints[split.departureEnd + 1]
    setPreviewId(guide.id)
    onPreview([...applied.points, ...(next ? [next] : [])])
  }

  const save = async () => {
    if (!supabase || !planId || !shown || !shown.runwayEnd) return
    setSaving(true)
    try {
      await saveGuide(supabase, planId, icao, shown)
      setSavedFor(`${planId}:${shown.runwayEnd}:${shown.points.length}`)
      onNotify(copy.guides.savedToast)
      await refresh()
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
    try {
      await onApply(applied.points, guide, applied.mode)
      setPreviewId(null)
      onPreview(null)
      await refresh()
    } catch (error) {
      onNotify(ERROR_TEXT[error instanceof GuideError ? error.key : "generic"])
    } finally {
      setBusyId(null)
    }
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

  if (!enabled || !airport || (!shown && (guides?.length ?? 0) === 0)) return null

  const canSave = Boolean(planId && shown && shown.runwayEnd && shown.confidence === "high")
  const justSaved = shown && planId && savedFor === `${planId}:${shown.runwayEnd}:${shown.points.length}`
  const hasGuides = (guides?.length ?? 0) > 0

  return (
    <div className={cn("space-y-2 rounded-lg border px-3 py-2.5 text-xs", className)}>
      <div className="flex items-start gap-2">
        <PlaneTakeoff className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{copy.guides.heading}</p>
          {shown?.runwayEnd ? (
            <p className="text-muted-foreground">{guideSummaryText(shown.runwayEnd, shown.direction, shown.tocDistanceNm)}</p>
          ) : (
            shown && <p className="text-muted-foreground">{copy.guides.lowConfidence}</p>
          )}
        </div>
        {shown && (
          <button
            type="button"
            disabled={!canSave || saving || Boolean(justSaved)}
            onClick={save}
            title={!planId ? copy.guides.needsPlan : undefined}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {saving ? copy.guides.saving : justSaved ? copy.guides.saved : copy.guides.save}
          </button>
        )}
      </div>
      {shown && !planId && <p className="text-muted-foreground">{copy.guides.needsPlan}</p>}

      {target && guides && (
        <div className="space-y-1.5 border-t pt-2">
          <p className="text-muted-foreground">{guidesForText(target.name)}</p>
          {ranked.length === 0 && <p className="text-muted-foreground">{copy.guides.noGuides}</p>}
          {ranked.map(({ guide, fit }) => {
            const applied = layOnto(guide.guide)
            const previewing = previewId === guide.id
            return (
              <div key={guide.id} className={cn("rounded-md border px-2 py-1.5", previewing && "border-amber-500/60 bg-amber-500/10")}>
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {guideSummaryText(guide.guide.runwayName, compassPoint(guide.guide.tocBearingDeg), guide.guide.tocDistanceNm)}
                    </p>
                    <p className="text-muted-foreground">{FIT_TEXT[fit]}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePreview(guide.guide)}
                    aria-pressed={previewing}
                    className="flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {previewing ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                    {previewing ? copy.guides.hidePreview : copy.guides.preview}
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null || !planId || !planIsDraft}
                    onClick={() => use(guide.guide)}
                    title={!planId ? copy.guides.needsPlan : !planIsDraft ? copy.guides.needsDraft : undefined}
                    className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === guide.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    {copy.guides.use}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(guide.guide)}
                    aria-label={copy.guides.remove}
                    title={copy.guides.remove}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-md px-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                      confirmDelete === guide.id && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {confirmDelete === guide.id ? copy.guides.removeConfirm : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                </div>
                {applied?.mode === "joined" && <p className="mt-1 text-amber-700 dark:text-amber-300">{copy.guides.joinWarning}</p>}
              </div>
            )
          })}
        </div>
      )}
      {!target && hasGuides && <p className="text-muted-foreground">{copy.guides.tapRunway}</p>}
    </div>
  )
}
