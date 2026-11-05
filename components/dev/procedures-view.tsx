"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { resolveBasemap, setBasemap } from "@/lib/map-tiles"
import type { FlightAnalysis, FlightGroup } from "@/lib/procedure-analysis"

// Local preview of the airport procedures editor: every analysed flight drawn on a map, coloured by its group, with the
// runway, direction and profile of each. Read-only for now; accepting, merging and publishing come later.
// Group colours: the site's blue at its own saturation and lightness (hsl 221 83% 53% in light, 217 91% 60% in dark),
// one hue per group, kept in the cyan-to-magenta band of the altitude ramp. Same intensity and contrast for every group,
// so nothing on the map shouts louder than the brand blue.
const HUES = [221, 190, 255, 285, 315, 165, 345, 205, 238, 300]
const groupColor = (index: number, dark: boolean) => `hsl(${HUES[index % HUES.length]} ${dark ? 91 : 83}% ${dark ? 60 : 53}%)`

interface Props {
  icao: string
  center: [number, number]
  runways: { name: string; from: [number, number]; to: [number, number] }[]
  flights: FlightAnalysis[]
  arrivalGroups: FlightGroup[]
  departureGroups: FlightGroup[]
}

export function ProceduresView({ icao, center, runways, flights, arrivalGroups, departureGroups }: Props) {
  const mapEl = useRef<HTMLDivElement>(null)
  const layers = useRef<Map<string, any>>(new Map())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [runwayFilter, setRunwayFilter] = useState<string>("all")
  const [hover, setHover] = useState<string | null>(null)
  const [shownKinds, setShownKinds] = useState({ arrival: true, departure: true })
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  const groups = useMemo(() => [...arrivalGroups, ...departureGroups], [arrivalGroups, departureGroups])
  const groupOf = useMemo(() => {
    const map = new Map<string, { group: FlightGroup; color: string }>()
    groups.forEach((g, i) => g.members.forEach((m) => map.set(m, { group: g, color: groupColor(i, dark) })))
    return map
  }, [groups, dark])

  useEffect(() => {
    let map: any
    let cancelled = false
    ;(async () => {
      // @ts-ignore leaflet ships no types in this project
      const L = (await import("leaflet")).default
      // @ts-ignore
      await import("leaflet/dist/leaflet.css")
      if (cancelled || !mapEl.current) return
      map = L.map(mapEl.current, { zoomControl: true }).setView(center, 9)
      setBasemap(L as any, map, resolveBasemap("auto", dark) === "dark")
      runways.forEach((r) => L.polyline([r.from, r.to], { color: dark ? "#e2e8f0" : "#0f172a", weight: 5 }).addTo(map))
      L.circleMarker(center, { radius: 4, color: dark ? "#e2e8f0" : "#0f172a", fillColor: dark ? "#0f172a" : "#fff", fillOpacity: 1 }).addTo(map).bindTooltip(icao, { permanent: true, direction: "top" })
      flights.forEach((f) => {
        if (f.track.length < 2) return
        const info = groupOf.get(f.file)
        const line = L.polyline(f.track.map((p) => [p[0], p[1]]) as [number, number][], {
          color: info?.color ?? (dark ? "#94a3b8" : "#64748b"),
          weight: 2.5,
          opacity: 0.85,
          dashArray: f.kind === "departure" ? "6 5" : undefined,
        }).addTo(map)
        line.bindTooltip(`${f.route ?? f.file} · ${f.kind} ${f.runway ?? "?"}`)
        layers.current.set(f.file, line)
      })
      const all = flights.flatMap((f) => f.track.map((p) => [p[0], p[1]] as [number, number]))
      if (all.length) map.fitBounds(all, { padding: [30, 30] })
      ;(window as any).__procMap = map
    })()
    return () => {
      cancelled = true
      layers.current.clear()
      map?.remove()
    }
  }, [center, dark, flights, groupOf, icao, runways])

  useEffect(() => {
    flights.forEach((f) => {
      const layer = layers.current.get(f.file)
      if (!layer) return
      const group = groupOf.get(f.file)?.group.id
      const kindShown = f.kind === "arrival" ? shownKinds.arrival : f.kind === "departure" ? shownKinds.departure : true
      const show = kindShown && !(group && hidden.has(group)) && (runwayFilter === "all" || f.runway === runwayFilter)
      const map = layer._map ?? (window as any).__procMap
      if (show && !layer._map && map) layer.addTo(map)
      if (!show && layer._map) layer.remove()
      layer.setStyle?.({ weight: hover === f.file ? 5 : 2.5, opacity: hover && hover !== f.file ? 0.35 : 0.85 })
    })
  }, [hidden, runwayFilter, hover, flights, groupOf, shownKinds, dark])

  const runwayNames = Array.from(new Set(flights.map((f) => f.runway).filter(Boolean))) as string[]
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n })

  const groupBlock = (title: string, list: FlightGroup[]) =>
    list.length > 0 && (
      <div className="mb-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {list.map((g) => {
          const color = groupColor(groups.indexOf(g), dark)
          const members = flights.filter((f) => g.members.includes(f.file))
          const toNm = members.map((m) => m.turnNm).filter((v): v is number => v !== null).sort((a, b) => a - b)
          const median = toNm.length ? toNm[Math.floor(toNm.length / 2)] : null
          return (
            <div key={g.id} className="mb-2 rounded border p-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input type="checkbox" checked={!hidden.has(g.id)} onChange={() => toggle(g.id)} />
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
                {g.label} · {g.bearing}° · {members.length} flight{members.length > 1 ? "s" : ""}
              </label>
              <div className="mt-1 text-xs text-muted-foreground">
                {g.kind === "arrival" ? "top of descent" : "top of climb"} median {median ?? "?"} NM
              </div>
              <ul className="mt-1 space-y-0.5 text-xs">
                {members.map((m) => (
                  <li key={m.file} onMouseEnter={() => setHover(m.file)} onMouseLeave={() => setHover(null)} className="flex justify-between gap-2">
                    <span className="truncate" title={m.file}>{m.route ?? m.file.replace(/\.kml$/i, "")}</span>
                    <span className="shrink-0 tabular-nums">
                      rwy {m.runway ?? "?"}
                      {m.kind === "arrival" && m.establishedNm !== null ? ` · final ${m.establishedNm} NM` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {members.some((m) => m.flags.length) && (
                <div className="mt-1 text-xs text-amber-600">{members.flatMap((m) => m.flags).join("; ")}</div>
              )}
            </div>
          )
        })}
      </div>
    )

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside>
        <div className="mb-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="group" aria-label="Show on the map">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={shownKinds.arrival} onChange={(e) => setShownKinds((k) => ({ ...k, arrival: e.target.checked }))} />
              <svg width="24" height="6" aria-hidden><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="2.5" /></svg>
              Arrivals <span className="text-muted-foreground">{flights.filter((f) => f.kind === "arrival").length}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={shownKinds.departure} onChange={(e) => setShownKinds((k) => ({ ...k, departure: e.target.checked }))} />
              <svg width="24" height="6" aria-hidden><line x1="0" y1="3" x2="24" y2="3" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 5" /></svg>
              Departures <span className="text-muted-foreground">{flights.filter((f) => f.kind === "departure").length}</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span>Runway</span>
            <select className="rounded border bg-background px-2 py-1" value={runwayFilter} onChange={(e) => setRunwayFilter(e.target.value)}>
              <option value="all">All</option>
              {runwayNames.sort().map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {groupBlock("Approaches", arrivalGroups)}
        {groupBlock("Departures", departureGroups)}
      </aside>
      <div ref={mapEl} className="h-[70vh] min-h-[420px] w-full rounded border" />
    </div>
  )
}
