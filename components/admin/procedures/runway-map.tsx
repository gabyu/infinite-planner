"use client"

import { useEffect, useMemo, useRef } from "react"
import { useTheme } from "next-themes"
import type { TrimAirport } from "@/lib/ground-trim"
import { resolveBasemap, setBasemap } from "@/lib/map-tiles"
import { altitudeBucket } from "@/lib/route-render"
import { runwayEnds, type RunwayEnd } from "@/lib/runway-guide"

// A map zoomed on one airport for picking a runway: its runways as plain lines, each runway end a small labelled button (click one
// to choose it), and a path drawn as a fine line coloured by altitude, like the plan editor. Used by the import review and by the
// edit of a member's procedure.
const airportCache = new Map<string, TrimAirport | null>()
export async function loadAirport(icao: string): Promise<TrimAirport | null> {
  if (airportCache.has(icao)) return airportCache.get(icao) ?? null
  try {
    const response = await fetch(`/api/airports/${icao}/runways`)
    const data = response.ok ? ((await response.json()) as TrimAirport) : null
    airportCache.set(icao, data)
    return data
  } catch {
    return null
  }
}

// The airport zoomed in, its runway ends as small labelled buttons, and the flight's track as a fine line coloured by altitude.
export function RunwayMap({ mapKey, label, track, runway, airport, onPick }: { mapKey: string; label: string; track: [number, number, number][]; runway: string | null; airport: TrimAirport | null; onPick: (runway: string) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const pick = useRef(onPick)
  pick.current = onPick
  const ends = useMemo<RunwayEnd[]>(() => (airport ? runwayEnds(airport) : []), [airport])
  // The runway-end buttons, kept so choosing a runway restyles them without rebuilding the map (and losing the zoom).
  const markers = useRef<Map<string, any>>(new Map())
  const selected = useRef(runway)
  selected.current = runway
  const iconFor = (L: any, name: string, on: boolean, ink: string) =>
    L.divIcon({
      className: "",
      html: `<button type="button" style="transform:translate(-50%,-50%);font:600 11px ui-monospace,monospace;padding:1px 5px;border-radius:9999px;border:1px solid ${on ? "#4f46e5" : ink};background:${on ? "#4f46e5" : dark ? "#0f172a" : "#fff"};color:${on ? "#fff" : ink};cursor:pointer">${name}</button>`,
      iconSize: [0, 0],
    })
  const leaflet = useRef<any>(null)

  useEffect(() => {
    if (!airport || !el.current) return
    let map: any
    let cancelled = false
    ;(async () => {
      // @ts-ignore leaflet ships no types in this project
      const L = (await import("leaflet")).default
      // @ts-ignore
      await import("leaflet/dist/leaflet.css")
      if (cancelled || !el.current) return
      map = L.map(el.current, { zoomControl: true, attributionControl: false })
      setBasemap(L as any, map, resolveBasemap("auto", dark) === "dark")
      const ink = dark ? "#e2e8f0" : "#0f172a"
      // Runways: a plain line per runway.
      for (const r of airport.runways) L.polyline([[r[0], r[1]], [r[2], r[3]]], { color: ink, weight: 2, opacity: 0.8, interactive: false }).addTo(map)
      // The flight, by altitude, as in the plan editor.
      const t = track
      for (let i = 1; i < t.length; i++) {
        L.polyline([[t[i - 1][0], t[i - 1][1]], [t[i][0], t[i][1]]], { className: `alt-${altitudeBucket((t[i - 1][2] + t[i][2]) / 2)}`, weight: 2, interactive: false }).addTo(map)
      }
      // Runway ends: click one to choose it.
      leaflet.current = L
      markers.current.clear()
      for (const end of ends) {
        const marker = L.marker([end.lat, end.lng], { icon: iconFor(L, end.name, end.name === selected.current, ink), keyboard: false })
          .on("click", () => pick.current(end.name))
          .addTo(map)
        markers.current.set(end.name, marker)
      }
      const around = L.latLngBounds([[airport.lat, airport.lng]]).extend(ends.map((e) => [e.lat, e.lng]))
      map.fitBounds(around, { padding: [60, 60], maxZoom: 13 })
      window.setTimeout(() => map?.invalidateSize(), 120)
    })()
    return () => {
      cancelled = true
      map?.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airport, ends, mapKey, track, dark])

  useEffect(() => {
    const L = leaflet.current
    if (!L) return
    const ink = dark ? "#e2e8f0" : "#0f172a"
    markers.current.forEach((marker, name) => marker.setIcon(iconFor(L, name, name === runway, ink)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runway, dark])

  return <div ref={el} className="h-[340px] w-full overflow-hidden rounded-lg border bg-muted/30" role="img" aria-label={label} />
}

