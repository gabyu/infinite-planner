"use client"

import { Fragment, useEffect, useState, type ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { atisWindText, copy, runwayComponentsText, tileWindText, weatherSourceText } from "@/lib/copy"
import type { TrimAirport } from "@/lib/ground-trim"
import type { WeatherState } from "@/lib/live-api/airport"
import { chipRunways, effectiveChoice, type EndChoice, type HandChoice } from "@/lib/runway-choice"
import { runwayEnds } from "@/lib/runway-guide"
import { adviseRunways, endTone, type EndTone, type RankedEnd } from "@/lib/runway-wind"
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

// Follows one airport while its code is valid: asks the server now and then every minute (only while the tab is visible).
// The server answers from a shared cache, so this never costs Infinite Flight a call of its own.
function useAirportLive(icao: string, active: boolean): Live | null {
  const [live, setLive] = useState<Live>({ state: "loading" })

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setLive({ state: "loading" })
    const load = async () => {
      if (document.hidden) return
      try {
        const response = await fetch(`/api/live/airports/${icao}`, { cache: "no-store" })
        const data = (await response.json()) as Live
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

// One tile per runway end: its name and what the wind does on it, coloured by how the wind favours it.
function RunwayTiles({
  runways,
  choice,
  onTap,
  ranks,
  titles,
  tones,
  tag,
}: {
  runways: string[]
  choice: EndChoice | null
  onTap: (runway: string) => void
  /** Headwind and crosswind of each end, where the wind is known. */
  ranks: Record<string, RankedEnd>
  /** What the wind does on each runway, shown as a tooltip. */
  titles?: Record<string, string>
  /** Green / yellow / red by how the wind favours each end. The chosen tile is outlined whatever its tone. */
  tones?: Record<string, EndTone>
  /** A small label under every tile ("ATIS"). */
  tag?: string
}) {
  if (runways.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {runways.map((runway) => {
        const chosen = choice?.runway === runway
        const rank = ranks[runway]
        return (
          <button
            key={runway}
            type="button"
            aria-pressed={chosen}
            title={titles?.[runway]}
            onClick={() => onTap(runway)}
            className={cn(
              "flex min-w-[3.25rem] max-w-[5rem] flex-1 basis-[3.5rem] flex-col items-center gap-0.5 rounded-md border px-1 py-2 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tones?.[runway] ? TONE_CLASSES[tones[runway]] : "bg-muted hover:bg-accent",
              chosen && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="font-mono text-sm font-medium tabular-nums">{runway}</span>
            {rank &&
              tileWindText(rank.headwindKt, rank.crosswindKt).map((line) => (
                <span key={line} className="text-[11px] leading-tight text-muted-foreground">
                  {line}
                </span>
              ))}
            {tag && <span className="text-[11px] leading-tight text-muted-foreground">{tag}</span>}
          </button>
        )
      })}
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
  /** The editor's cached airport loader: gives the tiles their arrows when the live data carries no headings (the ATIS). */
  loadAirport?: (icao: string) => Promise<TrimAirport | null>
  /**
   * The departure guides, placed inside this card when it shows (embedded, with the runway now chosen), or on their own
   * when live data is off (so they never depend on it).
   */
  children?: (embedded: boolean, runway: string | null, toneOf: (runway: string) => EndTone | null) => ReactNode
  /** Open at first: on a phone the card starts collapsed so the waypoint list keeps the height. */
  defaultOpen: boolean
  className?: string
}

// The live ATIS of one airport, at the top of the Departure or Arrival tab. One line when collapsed (airport, ATIS letter,
// the runways of this end, wind), the runway chips and the ATIS text when open. Nothing at all while live data is off
// (switched off, no key) or for a code that isn't an airport.
export function AirportCard({ icao, valid, end, hand, onTap, loadAirport, children, defaultOpen, className }: AirportCardProps) {
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
  const [open, setOpen] = useState(defaultOpen)
  const [showText, setShowText] = useState(false)
  if (hidden(live) || !live) return children ? <div className={className}>{children(false, hand?.icao === icao ? hand.runway : null, () => null)}</div> : null

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
  const choiceNote = atis
    ? !choice
      ? runways.length > 1
        ? copy.live.runwayTap
        : null
      : choice.by === "atis"
        ? copy.live.runwayFromAtis
        : choice.inAtis
          ? copy.live.runwayYours
          : copy.live.runwayYoursNotInAtis
    : choice?.by === "hand"
      ? copy.live.runwayYours
      : choice?.by === "wind"
        ? copy.live.runwayIntoWind
        : weather && weather.ranked.length > 0
          ? weather.light
            ? copy.live.lightWind
            : weather.best.length > 0
              ? `${copy.live.bestHeadwind} ${weather.best.join(", ")}.`
              : null
          : runways.length > 1
            ? copy.live.runwayTap
            : null
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
  const ranks: Record<string, RankedEnd> = {}
  for (const rank of advice?.ranked ?? []) ranks[rank.name] = rank
  // What the wind does on each end, as a tooltip.
  const tones: Record<string, EndTone> = {}
  for (const rank of advice?.ranked ?? []) {
    const tone = endTone(rank, advice?.best.includes(rank.name) ?? false, advice?.light ?? true)
    if (tone) tones[rank.name] = tone
  }
  const toneText = { good: copy.live.toneGood, caution: copy.live.toneCaution, avoid: copy.live.toneAvoid }
  const titles = Object.fromEntries(
    (advice?.ranked ?? []).map((rank) => [
      rank.name,
      `${runwayComponentsText(rank.name, rank.headwindKt, rank.crosswindKt)}${tones[rank.name] ? ` ${toneText[tones[rank.name]]}` : ""}`,
    ]),
  )

  // The collapsed line as pieces ("Information ALPHA", "30L 30R", "350° at 10 kt"). A piece is never split when the line wraps:
  // it breaks only after a middle dot, and the airport code stays at the top beside the first line.
  const summaryParts: string[] =
    live.state === "loading"
      ? [copy.live.loading]
      : noAtis
        ? weather
          ? [copy.live.noAtisShort, atisWindText(weather.wind), choice ? choice.runway : null].filter((part): part is string => Boolean(part))
          : [copy.live.noAtis]
        : live.state === "unavailable"
          ? [copy.live.unavailable]
          : !atis
            ? []
            : [
                atis.letter ? `${copy.live.atisLetter} ${atis.letter}` : null,
                chips.length > 0 ? (choice ? choice.runway : chips.join(" ")) : null,
                atis.wind ? atisWindText(atis.wind) : null,
              ].filter((part): part is string => Boolean(part))
  const expandable = atis !== null || (noAtis !== null && (everyEnd.length > 0 || weather !== null))

  return (
    <div className={cn("rounded-lg border", className)} aria-live="polite">
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs disabled:cursor-default"
      >
        {live.state === "loading" && <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
        <span className="shrink-0 font-mono font-medium">{icao}</span>
        <span className="min-w-0 flex-1 text-muted-foreground">
          {summaryParts.length === 1
            ? summaryParts[0]
            : summaryParts.map((part, index) => (
                <Fragment key={part}>
                  {index > 0 && " "}
                  <span className="whitespace-nowrap">{index < summaryParts.length - 1 ? `${part} ·` : part}</span>
                </Fragment>
              ))}
        </span>
        {expandable && <ChevronDown className={cn("mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
      </button>

      {atis && open && (
        <div className="space-y-2 border-t px-3 py-2.5">
          <RunwayTiles runways={chips} choice={choice} onTap={onTap} ranks={ranks} titles={titles} tones={tones} tag="ATIS" />
          {choiceNote && <p className="text-xs text-muted-foreground">{choiceNote}</p>}
          {notRead && <p className="text-xs text-muted-foreground">{copy.live.runwaysNotRead}</p>}
          {(showText || notRead) && (
            <p className="whitespace-normal break-words rounded-md bg-muted p-2 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {readableText(atis.text)}
            </p>
          )}
          {!notRead && (
            <button
              type="button"
              onClick={() => setShowText((value) => !value)}
              aria-expanded={showText}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {showText ? copy.live.hideText : copy.live.showText}
            </button>
          )}
          <p className="text-xs text-muted-foreground">{copy.live.source}</p>
        </div>
      )}

      {noAtis && expandable && open && (
        <div className="space-y-2 border-t px-3 py-2.5">
          <RunwayTiles runways={chips} choice={choice} onTap={onTap} ranks={ranks} titles={titles} tones={tones} />
          {choiceNote && <p className="text-xs text-muted-foreground">{choiceNote}</p>}
          {weatherNote && <p className="text-xs text-muted-foreground">{weatherNote}</p>}
          <p className="truncate text-xs text-muted-foreground" title={weather ? copy.live.weatherCreditFull : undefined}>
            {weather ? `${weatherSourceText(weather)} · ${copy.live.weatherCredit}` : copy.live.source}
          </p>
        </div>
      )}

      {children?.(true, choice?.runway ?? null, (runway) => tones[runway] ?? null)}
    </div>
  )
}
