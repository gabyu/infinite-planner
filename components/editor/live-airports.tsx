"use client"

import { Fragment, useEffect, useState, type ReactNode } from "react"
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react"
import type { AirportFlow } from "@/lib/airport-steps"
import { confirmRunway, reopenRunway, setFlowOpen } from "@/lib/airport-steps"
import { copy, planRunwayMismatchText, runwayComponentsText } from "@/lib/copy"
import type { TrimAirport } from "@/lib/ground-trim"
import type { WeatherState } from "@/lib/live-api/airport"
import { chipRunways, effectiveChoice, planRunwayOutsideAtis, type EndChoice, type HandChoice } from "@/lib/runway-choice"
import { runwayEnds } from "@/lib/runway-guide"
import { adviseRunways, endTone, type EndTone } from "@/lib/runway-wind"
import { cn } from "@/lib/utils"

// What /api/live/airports/{icao} answers (see lib/live-api/airport.ts); "unknown" is a 404 for a code that isn't an airport.
type AtisState = {
  state: "atis"
  text: string
  letter: string | null
  wind: { from: number | null; speedKt: number; gustKt: number | null } | null
  landing: string[]
  departing: string[]
}
// No ATIS: every runway end of the airport and what the nearest METAR says (see lib/live-api/airport.ts).
type NoAtisState = { state: "no_atis"; ends?: { name: string; headingTrue: number | null }[]; weather?: WeatherState }
type Live = { state: "loading" } | AtisState | NoAtisState | { state: "unavailable" | "disabled" | "unknown" }

const REFRESH_MS = 60_000

// The last answer for each airport, kept in this page's memory: switching between the Departure and Arrival tabs (or back to
// an airport) shows it at once and refreshes it in the background, instead of starting from "loading" every time.
// Nothing is stored on disk and nothing outlives the page.
const lastAnswer = new Map<string, Live>()

// Follows one airport while its code is valid: asks the server now and then every minute (only while the tab is visible).
// The server answers from a shared cache, so this never costs Infinite Flight a call of its own.
function useAirportLive(icao: string, active: boolean): Live | null {
  const [live, setLive] = useState<Live>(() => lastAnswer.get(icao) ?? { state: "loading" })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setLive(lastAnswer.get(icao) ?? { state: "loading" })
    const load = async () => {
      if (document.hidden) return
      try {
        const response = await fetch(`/api/live/airports/${icao}`, { cache: "no-store" })
        const data = (await response.json()) as Live
        if (data.state !== "unavailable") lastAnswer.set(icao, data)
        if (!cancelled) setLive(data)
      } catch {
        if (!cancelled) setLive({ state: "unavailable" })
      }
    }
    void load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => void load()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [icao, active])

  return active ? live : null
}

// Nothing is shown for a row that is off (feature disabled, or a code that isn't an airport).
const hidden = (live: Live | null) => !live || live.state === "disabled" || live.state === "unknown"

// The ATIS runs its lists together ("BARII3,CLVIN3,HHOWE4"), which cannot wrap on a narrow panel: a space after each comma
// lets it flow. Display only; the text itself is unchanged.
const readableText = (text: string) => text.replace(/,(?=[A-Za-z0-9])/g, ", ")

export const TONE_CLASSES: Record<EndTone, string> = {
  good: "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200",
  caution: "border-amber-500/50 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-200",
  avoid: "border-red-500/50 bg-red-500/15 text-red-800 hover:bg-red-500/25 dark:text-red-200",
}

// One small tile per runway end, coloured by how the wind favours it. What the wind does on the chosen end is written under
// the tiles (see `detail`), not on every tile.
function RunwayTiles({
  runways,
  choice,
  onTap,
  titles,
  tones,
  detail,
}: {
  runways: string[]
  choice: EndChoice | null
  onTap: (runway: string) => void
  /** What the wind does on each runway, shown as a tooltip. */
  titles?: Record<string, string>
  /** Green / yellow / red by how the wind favours each end. The chosen tile is outlined whatever its tone. */
  tones?: Record<string, EndTone>
  /** What the wind does on the chosen end, written under the tiles. */
  detail?: string | null
}) {
  if (runways.length === 0) return null
  return (
    <div className="space-y-1.5">
    <div className="grid grid-cols-6 gap-1.5">
      {runways.map((runway) => {
        const chosen = choice?.runway === runway
        return (
          <button
            key={runway}
            type="button"
            aria-pressed={chosen}
            title={titles?.[runway]}
            onClick={() => onTap(runway)}
            className={cn(
              "flex h-8 w-full flex-col items-center justify-center rounded-md border px-1 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tones?.[runway] ? TONE_CLASSES[tones[runway]] : "bg-muted hover:bg-accent",
              chosen && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="font-mono text-sm font-medium tabular-nums">{runway}</span>
          </button>
        )
      })}
    </div>
    {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

interface AirportCardProps {
  icao: string
  /** The code is a valid, complete ICAO code: nothing is asked of the server otherwise. */
  valid: boolean
  end: "departure" | "arrival"
  /** The runway the pilot tapped for this end, if any. Kept by the editor so it survives switching tabs. */
  hand: HandChoice | null
  onTap: (runway: string) => void
  /** The two steps' state for this airport (lib/airport-steps.ts), kept by the editor. */
  flow: AirportFlow
  onFlow: (flow: AirportFlow) => void
  /** Procedures are available to this pilot: the block then has its two numbered steps. Otherwise the runway step only. */
  steps: boolean
  /** The runway the plan itself flies at this end (detected, only when sure). A warning shows when the ATIS does not list it. */
  planRunway?: string | null
  /** The editor's cached airport loader: gives the tiles their arrows when the live data carries no headings (the ATIS). */
  loadAirport?: (icao: string) => Promise<TrimAirport | null>
  /**
   * The procedures (step 2), placed inside this block when it shows (embedded, with the runway of step 1), or on their own
   * when live data is off (so they never depend on it).
   */
  children?: (embedded: boolean, runway: string | null) => ReactNode
  /** Open at first: on a phone the block starts folded so the waypoint list keeps the height. */
  defaultOpen: boolean
  className?: string
}

// The heading of one step: its number (a check once done), its name and what was chosen.
function StepHeading({ number, label, done, children }: { number: number; label: string; done?: boolean; children?: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center gap-2 text-xs">
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
          done && "border-foreground bg-foreground text-background",
        )}
      >
        {done ? <Check className="h-3 w-3" /> : number}
      </span>
      <span className="font-medium">{label}</span>
      {children}
    </div>
  )
}

// The airport block at the top of the Departure or Arrival tab: step 1 the runway (live ATIS or weather), step 2 the
// procedure. One line when folded: the airport, and what was chosen once both steps are done. Nothing of step 1 shows
// while live data is off (switched off, no key) or for a code that isn't an airport.
export function AirportCard({
  icao,
  valid,
  end,
  hand,
  onTap,
  flow,
  onFlow,
  steps,
  planRunway = null,
  loadAirport,
  children,
  defaultOpen,
  className,
}: AirportCardProps) {
  const live = useAirportLive(icao, valid && /^[A-Z]{4}$/.test(icao))
  const [airport, setAirport] = useState<TrimAirport | null>(null)
  useEffect(() => {
    setAirport(null)
    if (!loadAirport || !valid || !/^[A-Z]{4}$/.test(icao)) return
    let cancelled = false
    void loadAirport(icao).then((data) => !cancelled && setAirport(data))
    return () => {
      cancelled = true
    }
  }, [loadAirport, icao, valid])
  const [showText, setShowText] = useState(false)
  if (hidden(live) || !live) return children ? <div className={className}>{children(false, hand?.icao === icao ? hand.runway : null)}</div> : null

  const atis = live.state === "atis" ? live : null
  const noAtis = live.state === "no_atis" ? live : null
  const weather = noAtis?.weather?.status === "ok" ? noAtis.weather : null
  const weatherNote =
    noAtis?.weather?.status === "none" ? copy.live.noWeather : noAtis?.weather?.status === "unavailable" ? copy.live.weatherUnavailable : null

  // With an ATIS: the runways of this end only (the ones taking off at the departure airport, the ones landing at the arrival
  // airport; the other list stays in the ATIS text). Without one: every runway end of the airport, best headwind first when
  // the wind ranks them, the rest in natural order.
  const windOrder = weather ? weather.ranked.map((rank) => rank.name) : []
  const everyEnd = noAtis ? [...windOrder, ...(noAtis.ends ?? []).map((e) => e.name).filter((name) => !windOrder.includes(name))] : []
  const runways = atis ? (end === "departure" ? atis.departing : atis.landing) : everyEnd
  const notRead = atis !== null && runways.length === 0
  // The pilot's tap; else the ATIS's single runway; else (no ATIS) the end the wind clearly favours. The pilot's own is
  // kept even when the ATIS stops listing it.
  const choice = atis ? effectiveChoice(hand, icao, runways) : noAtis ? effectiveChoice(hand, icao, [], weather?.pick ?? null) : null
  const chips = chipRunways(choice, runways)
  const mismatch = atis ? planRunwayOutsideAtis(planRunway, runways) : null
  // The one note left under the tiles: an invitation to tap when nothing is chosen among several runways.
  const tapNote = !choice && runways.length > 1 ? copy.live.runwayTap : null
  // True heading of each end: from the weather answer, else from the airport data (the ATIS names runways only).
  const headings: Record<string, number> = {}
  for (const end of airport ? runwayEnds(airport) : []) headings[end.name] = end.headingTrue
  for (const end of noAtis?.ends ?? []) if (end.headingTrue !== null) headings[end.name] = end.headingTrue
  // What the wind does on each end: the weather's ranking, or the ATIS wind worked out on the headings known.
  const windNow = atis?.wind && atis.wind.from !== null && atis.wind.speedKt > 0 ? { from: atis.wind.from, speedKt: atis.wind.speedKt } : null
  const advice =
    weather ??
    (atis && windNow
      ? adviseRunways(
          Object.entries(headings).map(([name, headingTrue]) => ({ name, headingTrue })),
          windNow,
        )
      : null)
  // What the wind does on each end, as a tooltip.
  const tones: Record<string, EndTone> = {}
  for (const rank of advice?.ranked ?? []) {
    const tone = endTone(rank, advice?.best.includes(rank.name) ?? false, advice?.light ?? true)
    if (tone) tones[rank.name] = tone
  }
  const toneText = { good: copy.live.toneGood, caution: copy.live.toneCaution, avoid: copy.live.toneAvoid }
  // What the wind does on each end: written under the tiles for the chosen one, with the verdict in the tooltip.
  const winds = Object.fromEntries(
    (advice?.ranked ?? []).map((rank) => [rank.name, runwayComponentsText(rank.name, rank.headwindKt, rank.crosswindKt)]),
  )
  const titles = Object.fromEntries(
    Object.entries(winds).map(([name, text]) => [name, tones[name] ? `${text} ${toneText[tones[name]]}` : text]),
  )
  const detail = choice ? (winds[choice.runway] ?? null) : null

  // Beside the airport code, only what explains a missing step 1.
  const status =
    live.state === "loading"
      ? copy.live.loading
      : noAtis
        ? weather
          ? copy.live.noAtisShort
          : copy.live.noAtis
        : live.state === "unavailable"
          ? copy.live.unavailable
          : null
  const hasRunwayStep = atis !== null || (noAtis !== null && (everyEnd.length > 0 || weather !== null))
  const expandable = hasRunwayStep || steps
  const open = expandable && (flow.open ?? defaultOpen)
  const done = steps ? flow.done : null
  // Step 1 is over once the pilot has tapped a runway (without procedures there is no step 2 to move on to).
  const confirmed = steps && hasRunwayStep ? flow.runway : null
  const tap = (runway: string) => {
    onTap(runway)
    onFlow(confirmRunway(flow, runway))
  }

  return (
    <div className={cn("rounded-lg border", className)} aria-live="polite">
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => onFlow(setFlowOpen(flow, !open))}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs disabled:cursor-default"
      >
        {live.state === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
        {done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
        <span className="shrink-0 font-mono font-medium">{icao}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {done ? <span className="font-mono text-foreground">{done.leg ? `${done.runway} · ${done.leg}` : done.runway}</span> : status}
        </span>
        {expandable && <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
      </button>

      {mismatch && planRunway && (
        <p role="status" className="flex items-start gap-2 border-t bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {planRunwayMismatchText(end, planRunway, mismatch)}
        </p>
      )}

      {/* Hidden rather than removed when folded: the procedures keep what they know (the original to restore). */}
      <div hidden={!open}>
        {hasRunwayStep && (
          <div className="space-y-2 border-t px-3 py-2.5">
            {steps && (
              <StepHeading number={1} label={copy.guides.stepRunway} done={Boolean(confirmed)}>
                {confirmed && (
                  <>
                    <span className="font-mono">{confirmed}</span>
                    <button type="button" onClick={() => onFlow(reopenRunway(flow))} className="link ml-auto inline-flex min-h-6 items-center">
                      {copy.guides.change}
                    </button>
                  </>
                )}
              </StepHeading>
            )}
            {!confirmed && (
              <>
                <RunwayTiles runways={chips} choice={choice} onTap={tap} titles={titles} tones={tones} detail={detail} />
                {tapNote && <p className="text-xs text-muted-foreground">{tapNote}</p>}
                {weatherNote && <p className="text-xs text-muted-foreground">{weatherNote}</p>}
                {notRead && <p className="text-xs text-muted-foreground">{copy.live.runwaysNotRead}</p>}
                {atis && !notRead && (
                  <button
                    type="button"
                    onClick={() => setShowText((value) => !value)}
                    aria-expanded={showText}
                    className="inline-flex min-h-6 items-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {showText ? copy.live.hideText : copy.live.showText}
                  </button>
                )}
                {atis && (showText || notRead) && (
                  <p className="whitespace-normal break-words rounded-md bg-muted p-2 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {readableText(atis.text)}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {steps && live.state !== "loading" && (
          <div className="border-t px-3 py-2">
            <StepHeading number={hasRunwayStep ? 2 : 1} label={copy.guides.stepProcedure} />
          </div>
        )}
        {/* Without step 1 (no live runways) there is nothing to confirm: step 2 is open straight away. */}
        <div hidden={live.state === "loading" || (hasRunwayStep && !confirmed)}>{children?.(true, confirmed ?? choice?.runway ?? null)}</div>
      </div>
    </div>
  )
}
