import { cn } from "@/lib/utils"

// The pill pinned to an airport on the globe.
export function AirportLabel({ code, visible }: { code: string; visible: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full border bg-background/80 px-2.5 py-1 font-mono text-xs font-medium tabular-nums shadow-sm backdrop-blur-md transition-all duration-500 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      {code}
    </div>
  )
}
