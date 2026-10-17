import type { FlightPlanSource } from "@/lib/flight-plans"
import { cn } from "@/lib/utils"

// A small monogram for the tracker a plan came from, in the text colour (not the trackers' logos): FR24 for
// FlightRadar24, FA for FlightAware. The full name stays available to screen readers and as a tooltip.
const MARKS: Partial<Record<FlightPlanSource, { label: string; name: string }>> = {
  FlightRadar24: { label: "FR24", name: "FlightRadar24" },
  FlightAware: { label: "FA", name: "FlightAware" },
}

export function SourceMark({ source, className }: { source: FlightPlanSource; className?: string }) {
  const mark = MARKS[source]
  if (!mark) return <span className={className}>{source}</span>
  return (
    <span
      role="img"
      aria-label={mark.name}
      title={mark.name}
      className={cn(
        "inline-flex h-5 items-center rounded border border-current px-1 font-mono text-[10px] font-semibold leading-none tracking-tight",
        className,
      )}
    >
      {mark.label}
    </span>
  )
}
