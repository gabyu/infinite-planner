"use client"

import { useEffect, useState } from "react"
import { Loader2, PlaneLanding, PlaneTakeoff } from "lucide-react"
import { atisWindText, copy } from "@/lib/copy"

// What /api/live/airports/{icao} answers (see lib/live-api/airport.ts); "unknown" is a 404 for a code that isn't an airport.
type AtisState = {
  state: "atis"
  text: string
  letter: string | null
  wind: { from: number | null; speedKt: number; gustKt: number | null } | null
  landing: string[]
  departing: string[]
}
type Live = { state: "loading" } | AtisState | { state: "no_atis" | "unavailable" | "disabled" | "unknown" }

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

function Runways({ label, runways }: { label: string; runways: string[] }) {
  if (runways.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      {runways.map((runway) => (
        <span key={runway} className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums">
          {runway}
        </span>
      ))}
    </div>
  )
}

function AirportRow({ icao, end, live }: { icao: string; end: "departure" | "arrival"; live: Live }) {
  const [open, setOpen] = useState(false)
  const Icon = end === "departure" ? PlaneTakeoff : PlaneLanding
  const label = end === "departure" ? copy.live.departure : copy.live.arrival
  // Each row shows the runways of its own end only: the ones taking off at the departure airport, the ones landing at the
  // arrival airport. The other list stays in the ATIS text.
  const runways = live.state === "atis" ? (end === "departure" ? live.departing : live.landing) : []
  const runwaysLabel = end === "departure" ? copy.live.departing : copy.live.landing
  const notRead = live.state === "atis" && runways.length === 0

  return (
    <div className="space-y-2 rounded-lg border p-3" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{icao}</span>
        {live.state === "atis" && live.letter && (
          <span className="ml-auto text-xs text-muted-foreground">
            {copy.live.atisLetter} <span className="font-medium text-foreground">{live.letter}</span>
          </span>
        )}
      </div>

      {live.state === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {copy.live.loading}
        </p>
      )}
      {live.state === "no_atis" && <p className="text-xs text-muted-foreground">{copy.live.noAtis}</p>}
      {live.state === "unavailable" && <p className="text-xs text-muted-foreground">{copy.live.unavailable}</p>}

      {live.state === "atis" && (
        <>
          <Runways label={runwaysLabel} runways={runways} />
          {live.wind && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{copy.live.wind}</span>
              <span className="text-xs">{atisWindText(live.wind)}</span>
            </div>
          )}
          {notRead && <p className="text-xs text-muted-foreground">{copy.live.runwaysNotRead}</p>}
          {(open || notRead) && (
            <p className="whitespace-normal break-words rounded-md bg-muted p-2 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
              {readableText(live.text)}
            </p>
          )}
          {!notRead && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {open ? copy.live.hideText : copy.live.showText}
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface LiveAirportsProps {
  origin: string
  destination: string
  originValid: boolean
  destinationValid: boolean
}

// "Live airport info" block of the editor's Options row: the ATIS of the departure and the arrival airport, when there is one.
export function LiveAirports({ origin, destination, originValid, destinationValid }: LiveAirportsProps) {
  const originLive = useAirportLive(origin, originValid && /^[A-Z]{4}$/.test(origin))
  const destinationLive = useAirportLive(destination, destinationValid && /^[A-Z]{4}$/.test(destination))
  if (hidden(originLive) && hidden(destinationLive)) return null

  return (
    <div className="space-y-2.5 border-b p-4">
      <h4 className="studio-label">{copy.live.heading}</h4>
      {!hidden(originLive) && <AirportRow icao={origin} end="departure" live={originLive as Live} />}
      {!hidden(destinationLive) && <AirportRow icao={destination} end="arrival" live={destinationLive as Live} />}
      <p className="text-xs text-muted-foreground">{copy.live.source}</p>
    </div>
  )
}
