"use client"

import { ArrowRight } from "@/components/arrow-right"
import Link from "next/link"
import { PencilRuler, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsTouchPrimary } from "@/hooks/use-is-touch-primary"
import { cn } from "@/lib/utils"
import { AirportLabel } from "./airport-label"
import type { GlobeFlight } from "@/lib/recent-flights"
import { useGlobeTour } from "./use-globe-tour"

// How long each flight stays in the spotlight: the globe turns, the route draws, then it rests a moment.
const STEP_MS = 9000

export function Hero({ flights }: { flights: GlobeFlight[] }) {
  const isTouchPrimary = useIsTouchPrimary()
  const { stageRef, canvasRef, originRef, destRef, active, ready, originOn, destOn } = useGlobeTour(flights, STEP_MS)

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
