"use client"

import { ArrowRight } from "@/components/arrow-right"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Download, Heart } from "lucide-react"
import { ALTITUDE_RAMP } from "@/components/home/altitude-ramp"
import { RouteThumbnail } from "@/components/plans/route-thumbnail"
import { RouteArrow } from "@/components/route-arrow"
import { Button } from "@/components/ui/button"
import {
  drawFrame,
  frameAt,
  LOOP_SECONDS,
  overviewFrame,
  PLAIN_LOOP_SECONDS,
  prepareFlight,
  type Flight,
  type Palette,
} from "@/lib/route-camera"
import { cn } from "@/lib/utils"

// What the page needs to show one featured plan, all plain values (the server prepares the wording).
export interface FrontDisplay {
  id: string
  href: string
  cityFrom: string
  cityTo: string
  codeFrom: string
  codeTo: string
  origin: string
  destination: string
  facts: string
  author: string
  avatarUrl: string | null
  date: string
  note: string | null
  pinned: boolean
  likeCount: number
  downloadCount: number
  route: { lat: number; lng: number; altitude: number }[]
  headN: number
  tailN: number
}

// The same colours as the homepage's globe: its altitude ramp (a light and a dark one).
function readPalette(): Palette {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const dark = root.classList.contains("dark")
  const hsl = (name: string, fallback: string, alpha?: number) => {
    const value = style.getPropertyValue(name).trim()
    if (!value) return fallback
    return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`
  }
  return {
    ink: hsl("--foreground", "#111"),
    ramp: [...(dark ? ALTITUDE_RAMP.dark : ALTITUDE_RAMP.light)],
    background: hsl("--card", "#fff"),
    labelBg: hsl("--background", "#fff", 0.8),
    labelBorder: hsl("--border", "#ddd"),
  }
}

// The top of Explore: one featured flight on a large stage, drawn in three shots that loop (the departure, the whole
// cruise, the arrival), and a short list of the next ones. After each loop the stage moves to the next plan. Pointing at
// the stage with a mouse shows the whole route instead; on a touch screen it just keeps looping. The list is made of real
// links, and the stage's first picture is a plain SVG in the HTML, so search engines and visitors without scripts get
// the same page without any motion.
export function FrontStage({ items }: { items: FrontDisplay[] }) {
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [reduced, setReduced] = useState(false)
  const [canHover, setCanHover] = useState(false)
  const [pointerOnStage, setPointerOnStage] = useState(false)
  const [pausedByList, setPausedByList] = useState(false)
  const [visible, setVisible] = useState(true)
  const [tabHidden, setTabHidden] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const timeRef = useRef(0)
  const item = items[Math.min(active, items.length - 1)]

  // The environment: motion preference, hover, scrolled into view, tab visible.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => {
      setReduced(motion.matches)
      setCanHover(hover.matches)
    }
    sync()
    motion.addEventListener("change", sync)
    hover.addEventListener("change", sync)
    const onVisibility = () => setTabHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 })
    if (rootRef.current) observer.observe(rootRef.current)
    return () => {
      motion.removeEventListener("change", sync)
      hover.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", onVisibility)
      observer.disconnect()
    }
  }, [])

  // The stage's size.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const select = useCallback((index: number) => {
    timeRef.current = 0
    setActive(index)
  }, [])

  // The drawing loop. It runs only while there is something to animate: otherwise one still frame is drawn.
  const hoverStill = canHover && pointerOnStage
  const playing = !reduced && !hoverStill && !pausedByList && visible && !tabHidden
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !item || size.w < 10) return
    const flight: Flight | null = prepareFlight(item.route, item.headN, item.tailN, size.w, size.h)
    const ctx = canvas.getContext("2d")
    if (!flight || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const labels = { origin: item.origin, destination: item.destination }
    let palette = readPalette()
    const loop = flight.hasZoom ? LOOP_SECONDS : PLAIN_LOOP_SECONDS

    const paint = () => {
      const frame = reduced || hoverStill ? overviewFrame(flight) : frameAt(flight, timeRef.current)
      drawFrame(ctx, flight, frame, palette, labels, dpr)
      barRefs.current[active]?.style.setProperty("transform", `scaleX(${reduced ? 0 : Math.min(timeRef.current / loop, 1)})`)
    }

    // A theme switch changes the colours: pick them up again.
    const themeObserver = new MutationObserver(() => {
      palette = readPalette()
      if (!playing) paint()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    paint()
    setReady(true)
    if (!playing) return () => themeObserver.disconnect()

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      // A long pause (a hidden tab) must not jump the timeline.
      timeRef.current += Math.min((now - last) / 1000, 0.1)
      last = now
      if (timeRef.current >= loop) {
        timeRef.current = 0
        if (items.length > 1) {
          setActive((current) => (current + 1) % items.length)
          return
        }
      }
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      themeObserver.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, size.w, size.h, reduced, hoverStill, playing])

  // Leaving the stage starts the loop again from the departure.
  useEffect(() => {
    if (!hoverStill) timeRef.current = 0
  }, [hoverStill])

  // The progress mark of the others goes back to empty.
  useEffect(() => {
    barRefs.current.forEach((bar, index) => {
      if (bar && index !== active) bar.style.setProperty("transform", "scaleX(0)")
    })
  }, [active])

  if (!item) return null

  return (
    <div ref={rootRef} className="grid gap-8 lg:grid-cols-12" aria-label="Featured flight plans">
      <div className="lg:col-span-8">
        <article
          className="group relative overflow-hidden rounded-[2rem] bg-card p-4 ring-1 ring-border sm:p-5"
          onPointerEnter={(e) => e.pointerType === "mouse" && setPointerOnStage(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setPointerOnStage(false)}
        >
          {/* The picture: the plain SVG is in the HTML, the canvas takes over once it is drawing. */}
          <div ref={frameRef} className="relative aspect-[760/360] w-full overflow-hidden rounded-2xl bg-muted/50">
            <div className={cn("transition-opacity duration-300", ready && "opacity-0")}>
              <RouteThumbnail route={item.route} size="large" />
            </div>
            <canvas
              ref={canvasRef}
              aria-hidden
              className={cn("absolute inset-0 h-full w-full transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
            />
          </div>

          <div key={item.id} className="front-in px-2 pb-2 pt-6 sm:px-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              {item.pinned ? "Editor's pick" : "Trending"}
            </p>
            <h2 className="mt-2 font-display text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              {item.cityFrom}
              <RouteArrow className="mx-[0.3em] text-primary" />
              {item.cityTo}
            </h2>
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              {item.codeFrom}
              <RouteArrow className="mx-1.5" />
              {item.codeTo}
              {item.facts && <> · {item.facts}</>}
            </p>
            {item.note && <p className="mt-4 max-w-xl text-[17px] leading-snug text-foreground/90">&ldquo;{item.note}&rdquo;</p>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href={item.href} className="no-underline">
                  View flight plan <ArrowRight />
                </Link>
              </Button>
              <span className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  {item.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.avatarUrl} alt="" width={20} height={20} referrerPolicy="no-referrer" className="h-5 w-5 rounded-full" />
                  ) : null}
                  {item.author}
                </span>
                <time dateTime={item.date}>{new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time>
                <span className="flex items-center gap-1">
                  <Heart size={13} strokeWidth={1.5} aria-hidden /> {item.likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <Download size={13} strokeWidth={1.5} aria-hidden /> {item.downloadCount}
                </span>
              </span>
            </div>
          </div>
        </article>
      </div>

      <aside
        className="lg:col-span-4"
        aria-labelledby="front-list"
        onPointerEnter={(e) => e.pointerType === "mouse" && setPausedByList(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setPausedByList(false)}
        onFocusCapture={() => setPausedByList(true)}
        onBlurCapture={() => setPausedByList(false)}
      >
        <h2 id="front-list" className="mb-5 border-t-2 border-foreground pt-3 text-xs font-semibold uppercase tracking-[0.16em]">
          On the front
        </h2>
        <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((entry, index) => (
            <li key={entry.id} className="relative min-w-[15rem] shrink-0 lg:min-w-0">
              <a
                href={entry.href}
                aria-current={index === active ? "true" : undefined}
                onClick={(e) => {
                  // With scripts, a click puts the plan on the stage; the "View flight plan" button opens it.
                  // Without them, or with a modifier, it is a plain link.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  select(index)
                }}
                className={cn(
                  "flex items-baseline gap-4 rounded-xl px-3 py-3.5 no-underline transition-colors motion-reduce:transition-none",
                  index === active ? "bg-muted/70" : "hover:bg-muted/40",
                )}
              >
                <span className="w-6 shrink-0 font-mono text-sm text-muted-foreground" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold leading-tight tracking-[-0.01em]">
                    {entry.cityFrom}
                    <RouteArrow className="mx-[0.3em] text-muted-foreground" />
                    {entry.cityTo}
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{entry.facts || `${entry.codeFrom} · ${entry.codeTo}`}</span>
                </span>
              </a>
              <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-border">
                <span
                  ref={(el) => {
                    barRefs.current[index] = el
                  }}
                  className="block h-full origin-left bg-foreground"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
