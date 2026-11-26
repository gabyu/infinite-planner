"use client"

import { Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

export type ExportState = "idle" | "busy" | "done"

/**
 * "Export FPL": a progress fill while the file is made and saved, then a short confirmation, then the button again.
 * It can be pressed as often as wanted; a press while it is busy does nothing.
 */
export function ExportButton({
  state,
  disabled,
  onClick,
  className,
}: {
  state: ExportState
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      onClick={() => state !== "busy" && onClick()}
      disabled={disabled}
      aria-busy={state === "busy"}
      className={cn("relative overflow-hidden", state === "done" && "bg-emerald-600 hover:bg-emerald-600", className)}
    >
      {state === "busy" && <span aria-hidden className="ip-export-progress absolute inset-y-0 left-0 bg-white/25" />}
      <span aria-live="polite" className="relative flex items-center justify-center gap-2">
        {state === "done" ? (
          <>
            <Check className="ip-export-check" aria-hidden />
            {copy.editor.exportDone}
          </>
        ) : (
          <>
            <Download aria-hidden />
            {state === "busy" ? copy.editor.exportBusy : copy.editor.exportFpl}
          </>
        )}
      </span>
    </Button>
  )
}
