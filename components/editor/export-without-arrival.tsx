"use client"

import { Switch } from "@/components/ui/switch"
import type { ArrivalCutState } from "@/hooks/use-arrival-cut"
import { copy, withoutArrivalSummary } from "@/lib/copy"

// The switch above "Export FPL": download the plan without the airborne arrival. One line under it says what it is
// for while off, and what will be left out while on.
export function ExportWithoutArrival({
  arrival,
  destination,
  onStartPicking,
}: {
  arrival: ArrivalCutState
  destination: string
  onStartPicking: () => void
}) {
  const { enabled, loading, cut, picking } = arrival
  const info = !enabled
    ? copy.editor.withoutArrivalHint
    : loading
      ? copy.editor.trimLoading
      : cut && picking
        ? copy.editor.pickCut
        : // A cut that leaves nothing out (a sparse sketch) says so, rather than "0 waypoints removed".
          !cut || cut.removedIds.size === 0
          ? copy.editor.cutUnavailable
          : withoutArrivalSummary(cut.removedIds.size, cut.distanceNm, destination, cut.estimated)

  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <label htmlFor="without-arrival" className="text-sm font-medium">
          {copy.editor.withoutArrival}
        </label>
        <Switch id="without-arrival" checked={enabled} onCheckedChange={arrival.setEnabled} aria-describedby="without-arrival-info" />
      </div>
      <p id="without-arrival-info" role="status" className="text-xs text-muted-foreground">
        {info}
      </p>
      {cut && (
        <button
          type="button"
          onClick={picking ? arrival.stopPicking : onStartPicking}
          className="link mt-0.5 inline-flex min-h-6 items-center text-xs"
        >
          {picking ? copy.editor.trimCancel : copy.editor.moveCut}
        </button>
      )}
    </div>
  )
}

/** On the list row of the cut point. */
export function CutBadge() {
  return (
    <span className="shrink-0 rounded border border-[hsl(var(--route-selected,21_90%_48%))] bg-[hsl(var(--route-selected,21_90%_48%)/0.12)] px-1 text-[10px] font-medium uppercase text-foreground">
      {copy.editor.cutBadge}
    </span>
  )
}
