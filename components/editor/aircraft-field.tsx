"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { copy } from "@/lib/copy"

interface AircraftFieldProps {
  id: string
  value: string
  onChange: (aircraft: string) => void
}

// The names Infinite Flight offers, asked once per page load. Never stored: only what the person picks is saved with the plan.
let known: string[] | null = null
let asking: Promise<string[]> | null = null
function loadAircraft(): Promise<string[]> {
  if (known) return Promise.resolve(known)
  asking ??= fetch("/api/live/aircraft", { cache: "no-store" })
    .then((response) => response.json())
    .then((data: { aircraft?: unknown }) => {
      known = Array.isArray(data.aircraft) ? data.aircraft.filter((name): name is string => typeof name === "string") : []
      return known
    })
    .catch(() => [])
    .finally(() => {
      asking = null
    })
  return asking
}

// A text field with the game's aircraft as suggestions. It works as a plain field when the list is not available (live data
// off, no key, a failed call), so saving never depends on it.
export function AircraftField({ id, value, onChange }: AircraftFieldProps) {
  const [options, setOptions] = useState<string[]>(known ?? [])
  useEffect(() => {
    let cancelled = false
    void loadAircraft().then((names) => !cancelled && setOptions(names))
    return () => {
      cancelled = true
    }
  }, [])
  const listId = `${id}-list`
  return (
    <>
      <Input
        id={id}
        value={value}
        maxLength={60}
        list={options.length > 0 ? listId : undefined}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        placeholder={copy.editor.aircraftPlaceholder}
        aria-label={copy.editor.aircraftLabel}
        className="h-[var(--control-h,2.25rem)] text-sm"
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
    </>
  )
}
