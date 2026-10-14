"use client"

import { BrandLogo } from "@/components/brand-logo"
import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatAgo, formatUtc } from "@/lib/format-ago"
import type { GlobeFlight } from "@/lib/recent-flights"
import { AirportLabel } from "@/components/home/airport-label"
import { useGlobeTour } from "@/components/home/use-globe-tour"

// Slow enough to read the details of each flight.
const STEP_MS = 10000
// A screen left on for days still picks up new flight plans.
const RELOAD_MS = 30 * 60 * 1000

export function Visualizer({ flights }: { flights: GlobeFlight[] }) {
  const { stageRef, canvasRef, originRef, destRef, active, setActive, ready, originOn, destOn } = useGlobeTour(
    flights,
    STEP_MS,
  )

  // Relative times need the browser clock: empty during the server render, then ticking every minute.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 60000)
    const reload = window.setTimeout(() => window.location.reload(), RELOAD_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(reload)
    }
  }, [])

  // The list holds up to a hundred flights: keep the active one in view inside it.
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = listRef.current
    const item = list?.children[active] as HTMLElement | undefined
    if (!list || !item) return
    list.scrollTo({ top: item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2, behavior: "smooth" })
  }, [active])

  const current = flights[active]

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <main className="relative min-h-0 flex-1">
        {/* The globe: always a square, centred on the screen. */}
        <div ref={stageRef} className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square h-full max-h-[min(100%,100vw)] w-auto max-w-full">
            <canvas
              ref={canvasRef}
              aria-hidden
              className={cn(
                "absolute inset-0 h-full w-full transition-opacity duration-[1200ms] ease-out",
                ready ? "opacity-100" : "opacity-0",
              )}
            />
            {current && (
              <>
                <div
                  ref={originRef}
                  data-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 data-[hidden=true]:opacity-0"
                >
                  <AirportLabel code={current.origin} visible={originOn} />
                </div>
                <div
                  ref={destRef}
                  data-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 data-[hidden=true]:opacity-0"
                >
                  <AirportLabel code={current.destination} visible={destOn} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Details of the flight in the spotlight. */}
        {current ? (
          <div className="pointer-events-none absolute left-0 top-0 max-w-[min(100%,28rem)] px-5 pt-5 sm:px-8 sm:pt-8">
            {/* key restarts the fade for every flight */}
            <div key={active} className="animate-in fade-in duration-700">
              <p className="font-mono text-xs tabular-nums tracking-wide text-muted-foreground">
                {String(active + 1).padStart(2, "0")} / {String(flights.length).padStart(2, "0")}
              </p>
              <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold tracking-[-0.028em] sm:text-5xl">
                {current.origin}
                <ArrowRight className="size-[0.7em] opacity-40" aria-hidden />
                {current.destination}
              </h1>
              {(current.originName || current.destinationName) && (
                <p className="mt-3 text-sm font-light text-muted-foreground sm:text-base">
                  {[current.originName, current.destinationName].filter(Boolean).join("  →  ")}
                </p>
              )}
              <p className="mt-4 font-mono text-xs tabular-nums text-muted-foreground sm:text-sm">
                {formatUtc(current.createdAt)}
                <span className="mx-2 opacity-40">·</span>
                <span className="text-foreground">{now === null ? " " : formatAgo(current.createdAt, now)}</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="absolute left-8 top-8 text-muted-foreground">No flight plans yet.</p>
        )}

        {/* The latest flights, the active one lit. Wide screens only: the globe stays the subject. */}
        {flights.length > 0 && (
          <ol
            ref={listRef}
            className="absolute right-8 top-1/2 hidden max-h-[60%] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex"
          >
            {flights.map((f, i) => (
              <li key={`${f.createdAt}-${i}`}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex items-baseline gap-3 rounded-md px-2 py-0.5 text-left font-mono text-xs tabular-nums transition-opacity duration-500",
                    i === active ? "opacity-100" : "opacity-35 hover:opacity-70",
                  )}
                >
                  <span className="w-6 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium">
                    {f.origin} → {f.destination}
                  </span>
                  <span className="text-muted-foreground">{now === null ? "" : formatAgo(f.createdAt, now)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </main>

      <footer className="flex flex-col items-center gap-1 px-4 pb-5 pt-2 text-center sm:pb-6">
        <BrandLogo />
        <p className="text-xs font-light text-muted-foreground sm:text-sm">The flight plan hub for Infinite Flight</p>
      </footer>
    </div>
  )
}
