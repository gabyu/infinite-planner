"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { atisWindText, copy, runwayComponentsText, weatherSourceText } from "@/lib/copy"
import type { WeatherState } from "@/lib/live-api/airport"
import { chipRunways, effectiveChoice, type EndChoice, type HandChoice } from "@/lib/runway-choice"
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

function Runways({
  label,
  runways,
  choice,
  onTap,
  titles,
}: {
  label: string
  runways: string[]
  choice: EndChoice | null
  onTap: (runway: string) => void
  /** What the wind does on each runway, shown as a tooltip. */
  titles?: Record<string, string>
}) {
  if (runways.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
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
              "rounded-md border px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              chosen ? "border-primary bg-primary text-primary-foreground" : "bg-muted hover:bg-accent",
            )}
          >
            {runway}
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
  /** Open at first: on a phone the card starts collapsed so the waypoint list keeps the height. */
  defaultOpen: boolean
  className?: string
}

// The live ATIS of one airport, at the top of the Departure or Arrival tab. One line when collapsed (airport, ATIS letter,
// the runways of this end, wind), the runway chips and the ATIS text when open. Nothing at all while live data is off
// (switched off, no key) or for a code that isn't an airport.
export function AirportCard({ icao, valid, end, hand, onTap, defaultOpen, className }: AirportCardProps) {
  const live = useAirportLive(icao, valid && /^[A-Z]{4}$/.test(icao))
  const [open, setOpen] = useState(defaultOpen)
  const [showText, setShowText] = useState(false)
  if (hidden(live) || !live) return null

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
  const runwaysLabel = end === "departure" ? copy.live.departing : copy.live.landing
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
  // What the wind does on each end, as a tooltip, and in words for the chosen one.
  const rankOf = (name: string) => weather?.ranked.find((rank) => rank.name === name)
  const titles = Object.fromEntries(
    (weather?.ranked ?? []).map((rank) => [rank.name, runwayComponentsText(rank.name, rank.headwindKt, rank.crosswindKt)]),
  )
  const chosenRank = choice ? rankOf(choice.runway) : undefined

  const summary =
    live.state === "loading"
      ? copy.live.loading
      : noAtis
        ? weather
          ? [copy.live.noAtisShort, atisWindText(weather.wind), choice ? `${runwaysLabel} ${choice.runway}` : null].filter(Boolean).join(" · ")
          : copy.live.noAtis
        : live.state === "unavailable"
          ? copy.live.unavailable
          : !atis
            ? ""
            : [
                atis.letter ? `${copy.live.atisLetter} ${atis.letter}` : null,
                chips.length > 0 ? `${runwaysLabel} ${choice ? choice.runway : chips.join(" ")}` : null,
                atis.wind ? atisWindText(atis.wind) : null,
              ]
                .filter(Boolean)
                .join(" · ")
  const expandable = atis !== null || (noAtis !== null && (everyEnd.length > 0 || weather !== null))

  return (
    <div className={cn("rounded-lg border", className)} aria-live="polite">
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs disabled:cursor-default"
      >
        {live.state === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
        <span className="shrink-0 font-mono font-medium">{icao}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{summary}</span>
        {expandable && <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
      </button>

      {atis && open && (
        <div className="space-y-2 border-t px-3 py-2.5">
          <Runways label={runwaysLabel} runways={chips} choice={choice} onTap={onTap} />
          {choiceNote && <p className="pl-[5.5rem] text-xs text-muted-foreground">{choiceNote}</p>}
          {atis.wind && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{copy.live.wind}</span>
              <span className="text-xs">{atisWindText(atis.wind)}</span>
            </div>
          )}
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
          <Runways label={runwaysLabel} runways={chips} choice={choice} onTap={onTap} titles={titles} />
          {choiceNote && <p className="pl-[5.5rem] text-xs text-muted-foreground">{choiceNote}</p>}
          {choice && chosenRank && (
            <p className="pl-[5.5rem] text-xs text-muted-foreground">
              {runwayComponentsText(choice.runway, chosenRank.headwindKt, chosenRank.crosswindKt)}
            </p>
          )}
          {weather && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{copy.live.wind}</span>
              <span className="text-xs">{atisWindText(weather.wind)}</span>
            </div>
          )}
          {weatherNote && <p className="text-xs text-muted-foreground">{weatherNote}</p>}
          <p className="text-xs text-muted-foreground">
            {weather ? `${weatherSourceText(weather)} ${copy.live.weatherCredit}` : copy.live.source}
          </p>
        </div>
      )}
    </div>
  )
}
