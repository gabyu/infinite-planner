"use client"

import { Loader2, PlaneLanding, PlaneTakeoff } from "lucide-react"
import { copy } from "@/lib/copy"
import type { TrimEnd } from "@/lib/ground-trim"
import { cn } from "@/lib/utils"

interface GroundMovementsProps {
  /** The end being previewed, if any. */
  previewing: TrimEnd | null
  /** The end whose runway data is being fetched. */
  busy: TrimEnd | null
  trimmed: Record<TrimEnd, boolean>
  disabled?: boolean
  onToggle: (end: TrimEnd) => void
  /** Which ends to offer: both by default; the Departure and Arrival tabs each offer their own. */
  ends?: TrimEnd[]
  /** One row (heading and toggle) without the hint, for the phone sheet where height is scarce. */
  compact?: boolean
}

// The "Ground movements" block of the Options row: one toggle per end of the plan. Clicking one previews what would
// be removed (nothing is removed yet); the Apply / Cancel bar is shown by the panel (GroundTrimBar).
export function GroundMovements({ previewing, busy, trimmed, disabled, onToggle, ends = ["departure", "arrival"], compact }: GroundMovementsProps) {
  const buttons: { end: TrimEnd; label: string; icon: React.ReactNode }[] = [
    { end: "departure" as const, label: copy.editor.trimDeparture, icon: <PlaneTakeoff className="h-4 w-4" /> },
    { end: "arrival" as const, label: copy.editor.trimArrival, icon: <PlaneLanding className="h-4 w-4" /> },
  ].filter(({ end }) => ends.includes(end))
  const toggles = (
    <div className={cn("grid gap-2", compact ? "w-40 shrink-0 grid-cols-1" : buttons.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {buttons.map(({ end, label, icon }) => {
        const previewed = previewing === end
        const off = trimmed[end]
        return (
          <button
            key={end}
            type="button"
            role="switch"
            aria-checked={!off}
            disabled={disabled || busy !== null}
            onClick={() => onToggle(end)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
              compact ? "h-8" : "h-9",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              off
                ? "bg-card text-muted-foreground hover:bg-accent"
                : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              previewed && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
            )}
          >
            {busy === end ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {label}
          </button>
        )
      })}
    </div>
  )
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <h4 className="studio-label" title={copy.editor.groundHint}>
          {copy.editor.groundHeading}
        </h4>
        {toggles}
      </div>
    )
  }
  return (
    <div className="space-y-2.5 border-b p-4">
      <div>
        <h4 className="studio-label">{copy.editor.groundHeading}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{copy.editor.groundHint}</p>
      </div>
      {toggles}
    </div>
  )
}

interface GroundTrimBarProps {
  text: string
  approximate: boolean
  onApply: () => void
  onCancel: () => void
}

// Shown above the waypoint list while a trim is previewed: how many waypoints go, with Apply and Cancel.
export function GroundTrimBar({ text, approximate, onApply, onCancel }: GroundTrimBarProps) {
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{text}</p>
        {approximate && <p className="text-muted-foreground">{copy.editor.trimApproximate}</p>}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {copy.editor.trimCancel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:bg-primary/90"
      >
        {copy.editor.trimApply}
      </button>
    </div>
  )
}
