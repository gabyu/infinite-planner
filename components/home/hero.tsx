"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, PencilRuler, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsTouchPrimary } from "@/hooks/use-is-touch-primary"
import { cn } from "@/lib/utils"
import type { GlobeFlight } from "@/lib/recent-flights"
import { ARC_DELAY_MS, ARC_DRAW_MS, type GlobeHandle } from "./globe-scene"

// How long each flight stays in the spotlight: the globe turns, the route draws, then it rests a moment.
const STEP_MS = 9000

function AirportLabel({ code, visible }: { code: string; visible: boolean }) {
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

export function Hero({ flights }: { flights: GlobeFlight[] }) {
  const isTouchPrimary = useIsTouchPrimary()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originRef = useRef<HTMLDivElement>(null)
  const destRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeHandle | null>(null)

  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const [originOn, setOriginOn] = useState(false)
  const [destOn, setDestOn] = useState(false)
  const [inView, setInView] = useState(true)
  const [reduced, setReduced] = useState(false)

  // Create the scene once, after paint: three.js is loaded on demand so the page text never waits for it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let handle: GlobeHandle | null = null
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setReduced(reducedMotion)
    const root = document.documentElement

    import("./globe-scene")
      .then(({ createGlobe }) => {
        if (cancelled) return
        handle = createGlobe(
          canvas,
          flights.map((f) => ({ path: f.path })),
          { dark: root.classList.contains("dark"), reducedMotion },
        )
        globeRef.current = handle
        handle.focus(0, { instant: true })
        setReady(true)
      })
      .catch(() => {
        // No WebGL: the headline and buttons stand on their own.
      })

    const themeObserver = new MutationObserver(() => handle?.setDark(root.classList.contains("dark")))
    themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] })

    return () => {
      cancelled = true
      themeObserver.disconnect()
      handle?.dispose()
      globeRef.current = null
    }
    // flights come from the server once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pause everything while the hero is off screen.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    globeRef.current?.setPaused(!inView)
  }, [inView, ready])

  // The globe follows the active flight. Each airport is named when the route reaches it.
  useEffect(() => {
    globeRef.current?.focus(active)
    setOriginOn(false)
    setDestOn(false)
    if (reduced) {
      setOriginOn(true)
      setDestOn(true)
      return
    }
    const a = window.setTimeout(() => setOriginOn(true), 1100)
    const b = window.setTimeout(() => setDestOn(true), ARC_DELAY_MS + ARC_DRAW_MS - 200)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [active, ready, reduced])

  // One flight after the other.
  useEffect(() => {
    if (reduced || !inView || flights.length < 2) return
    const t = window.setTimeout(() => setActive((i) => (i + 1) % flights.length), STEP_MS)
    return () => window.clearTimeout(t)
  }, [active, reduced, inView, flights.length])

  // Keep the two airport labels pinned to the globe while it turns.
  useEffect(() => {
    if (!ready || !inView) return
    let raf = 0
    const place = (el: HTMLDivElement | null, pos: { x: number; y: number } | null, offset: string) => {
      if (!el) return
      if (pos) {
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, ${offset})`
        el.dataset.hidden = "false"
      } else {
        el.dataset.hidden = "true"
      }
    }
    const tick = () => {
      const a = globeRef.current?.anchors()
      place(originRef.current, a?.origin ?? null, "75%")
      place(destRef.current, a?.destination ?? null, "-175%")
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, inView])

  const current = flights[active]

  return (
    <section className="relative overflow-hidden">
      <div className="container mx-auto grid items-center gap-x-12 gap-y-10 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,680px)] lg:pb-24 lg:pt-20">
        <div>
          <h1 className="font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.028em] sm:text-6xl lg:text-6xl xl:text-7xl">
            The flight plan hub for Infinite&nbsp;Flight
          </h1>
          <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-muted-foreground sm:text-xl">
            Import a real flight from FlightRadar24 or FlightAware, or draw your own route. Export it as an Infinite
            Flight flight plan.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
              <Link href="/convert">
                <Upload />
                Import a flight
              </Link>
            </Button>
            {isTouchPrimary ? (
              <p className="text-sm text-muted-foreground">Route Sketch is available on desktop.</p>
            ) : (
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-5 text-base font-normal">
                <Link href="/sketch">
                  <PencilRuler />
                  Draw a route
                  <ArrowRight className="opacity-60" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div ref={stageRef} className="relative mx-auto aspect-square w-full max-w-[680px]">
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
          {/* Screen readers get the text, the canvas is decoration. */}
          {current && (
            <p className="sr-only">
              Latest flight plan: {current.origin} to {current.destination}, {current.path.length} waypoints.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
