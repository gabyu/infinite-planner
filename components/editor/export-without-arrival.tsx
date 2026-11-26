"use client"

import { HelpTip } from "@/components/editor/help-tip"
import { Switch } from "@/components/ui/switch"
import type { ArrivalCutState } from "@/hooks/use-arrival-cut"
import { copy, withoutArrivalSummary } from "@/lib/copy"

// The first row of the export block: download the plan without the airborne arrival. What it is for sits behind the
// (?); only what the pilot has to act on is written under the row (what was left out is for screen readers).
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
  const message = !enabled
    ? null
    : loading
      ? copy.editor.trimLoading
      : cut && picking
        ? copy.editor.pickCut
        : // A cut that leaves nothing out (a sparse sketch) says so, rather than "0 waypoints removed".
          !cut || cut.removedIds.size === 0
          ? copy.editor.cutUnavailable
          : null
  const summary = enabled && cut && !message ? withoutArrivalSummary(cut.removedIds.size, cut.distanceNm, destination, cut.estimated) : null

  return (
    <div>
      <div className="flex min-h-7 items-center gap-1">
        <label htmlFor="without-arrival" className="whitespace-nowrap text-sm font-medium">
          {copy.editor.withoutArrival}
        </label>
        <HelpTip label={`${copy.editor.exportHelp} ${copy.editor.withoutArrival}`}>{copy.editor.withoutArrivalHint}</HelpTip>
        <div className="ml-auto flex items-center gap-3">
          {cut && (
            <button
              type="button"
              onClick={picking ? arrival.stopPicking : onStartPicking}
              className="link inline-flex min-h-6 items-center whitespace-nowrap text-xs"
            >
              {picking ? copy.editor.trimCancel : copy.editor.moveCut}
            </button>
          )}
          <Switch id="without-arrival" checked={enabled} onCheckedChange={arrival.setEnabled} aria-describedby="without-arrival-info" />
        </div>
      </div>
      <p id="without-arrival-info" role="status" className={message ? "text-xs text-muted-foreground" : "sr-only"}>
        {message ?? summary}
      </p>
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
