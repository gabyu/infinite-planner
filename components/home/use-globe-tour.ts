"use client"

import { useEffect, useRef, useState } from "react"
import type { GlobeFlight } from "@/lib/recent-flights"
import { ARC_DELAY_MS, ARC_DRAW_MS, type GlobeHandle } from "./globe-scene"

// Drives the flight globe for the homepage hero and the visualizer page: creates the scene, turns it
// from one flight to the next, and keeps the two airport labels pinned to the globe while it turns.
export function useGlobeTour(flights: GlobeFlight[], stepMs: number) {
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
        // No WebGL: the page text stands on its own.
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

  // Pause everything while the globe is off screen.
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
    const t = window.setTimeout(() => setActive((i) => (i + 1) % flights.length), stepMs)
    return () => window.clearTimeout(t)
  }, [active, reduced, inView, flights.length, stepMs])

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

  return { stageRef, canvasRef, originRef, destRef, active, setActive, ready, originOn, destOn }
}
