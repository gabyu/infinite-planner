"use client"

import { Loader2 } from "lucide-react"
import { HelpTip } from "@/components/editor/help-tip"
import { Switch } from "@/components/ui/switch"
import { copy } from "@/lib/copy"
import type { TrimEnd } from "@/lib/ground-trim"
import { cn } from "@/lib/utils"

interface GroundMovementsProps {
  /** The end this switch belongs to: Options shows one for each. */
  end: TrimEnd
  /** The end being previewed, if any. */
  previewing: TrimEnd | null
  /** The end whose runway data is being fetched. */
  busy: TrimEnd | null
  trimmed: Record<TrimEnd, boolean>
  disabled?: boolean
  onToggle: (end: TrimEnd) => void
}

// "Departure taxi" / "Arrival taxi" with a switch: on keeps the taxi before take-off / after landing in the plan, off
// removes it. The label never changes with the state, only the switch does. Turning it off previews what would be
// removed (nothing is removed yet); the Apply / Cancel bar (GroundTrimBar) is shown under the switches.
export function GroundMovements({ end, previewing, busy, trimmed, disabled, onToggle }: GroundMovementsProps) {
  const id = `ground-movements-${end}`
  const on = !trimmed[end]
  const label = end === "departure" ? copy.editor.taxiDeparture : copy.editor.taxiArrival
  return (
    <div className="flex min-h-7 items-center gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <HelpTip label={`${copy.editor.exportHelp} ${label}`}>{copy.editor.groundHint}</HelpTip>
      <div className="ml-auto flex items-center gap-2">
        {busy === end && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
        <Switch
          id={id}
          checked={on}
          disabled={disabled || busy !== null}
          onCheckedChange={() => onToggle(end)}
          className={cn(previewing === end && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background")}
        />
      </div>
    </div>
  )
}

interface GroundTrimBarProps {
  text: string
  approximate: boolean
  onApply: () => void
  onCancel: () => void
}

// Shown under the taxi switches while a trim is previewed: how many waypoints go, with Apply and Cancel.
export function GroundTrimBar({ text, approximate, onApply, onCancel }: GroundTrimBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
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
