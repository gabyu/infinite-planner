"use client"

// The state of "Export without arrival": the toggle (remembered in the browser), the destination's runway data, and
// the cut point. The rules live in lib/export-trim.ts; the plan itself is never changed.
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  arrivalCutOptions,
  fallbackAirport,
  loadWithoutArrival,
  resolveCut,
  trimRoute,
  WITHOUT_ARRIVAL_KEY,
} from "@/lib/export-trim"
import type { TrimAirport } from "@/lib/ground-trim"

interface CutPoint {
  id: string
  lat: number
  lng: number
  altitude: number
}

export function useArrivalCut({
  waypoints,
  destination,
  destinationValid,
  loadAirport,
}: {
  waypoints: CutPoint[]
  destination: string
  destinationValid: boolean
  /** Resolves null when the airport is unknown or its data can't be fetched. Must be stable. */
  loadAirport: (icao: string) => Promise<TrimAirport | null>
}) {
  const [enabled, setEnabledState] = useState(false)
  const [picking, setPicking] = useState(false)
  // The pilot's own cut point, by waypoint id so that edits elsewhere in the plan don't move it. Null: the default.
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ icao: string; airport: TrimAirport | null } | null>(null)

  // Reading window.localStorage itself throws when the browser blocks it.
  useEffect(() => {
    try {
      setEnabledState(loadWithoutArrival(window.localStorage))
    } catch {}
  }, [])

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on)
    setPicking(false)
    try {
      window.localStorage.setItem(WITHOUT_ARRIVAL_KEY, on ? "1" : "0")
    } catch {}
  }, [])

  const icao = destinationValid ? destination : ""
  useEffect(() => {
    if (!enabled || !icao) return
    let cancelled = false
    loadAirport(icao).then((airport) => {
      if (!cancelled) setLoaded({ icao, airport })
    })
    return () => {
      cancelled = true
    }
  }, [enabled, icao, loadAirport])
  const loading = enabled && !!icao && loaded?.icao !== icao

  const result = useMemo(() => {
    if (!enabled || loading || waypoints.length < 3) return null
    // Without runway data, the same fallback as the ground movements switch.
    const airport = (icao ? loaded?.airport : null) ?? fallbackAirport(waypoints)
    const options = arrivalCutOptions(waypoints, airport)
    if (!options) return null
    const picked = waypoints.findIndex((wp) => wp.id === pickedId)
    const { index, estimated } = resolveCut(options, picked < 0 ? null : picked)
    const cut = { after: index, resumeAt: options.resumeAt }
    const { removed, distanceToDestinationNm } = trimRoute(waypoints, { arrival: cut })
    return {
      options,
      cut: {
        ...cut,
        id: waypoints[index].id,
        estimated,
        removedIds: new Set(removed.map((wp) => wp.id)),
        distanceNm: distanceToDestinationNm,
      },
    }
  }, [enabled, loading, waypoints, icao, loaded, pickedId])

  const startPicking = useCallback(() => setPicking(true), [])
  const stopPicking = useCallback(() => setPicking(false), [])
  const reset = useCallback(() => {
    setPickedId(null)
    setPicking(false)
  }, [])

  const pick = useCallback(
    (id: string) => {
      const index = waypoints.findIndex((wp) => wp.id === id)
      if (!result || index < result.options.min || index > result.options.max) return false
      setPickedId(id)
      setPicking(false)
      return true
    },
    [waypoints, result],
  )

  useEffect(() => {
    if (!picking) return
    if (!result) return setPicking(false)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicking(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [picking, result])

  return { enabled, setEnabled, loading, cut: result?.cut ?? null, picking, startPicking, stopPicking, pick, reset }
}

export type ArrivalCutState = ReturnType<typeof useArrivalCut>
