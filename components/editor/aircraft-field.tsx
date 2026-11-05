"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { aircraftCode, searchAircraft } from "@/lib/aircraft"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

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

// A text field with the game's aircraft as suggestions, found from any part of the name or the short code ("359" finds the
// A350-900). It works as a plain field when the list is not available (live data off, no key, a failed call), so saving never
// depends on it.
export function AircraftField({ id, value, onChange }: AircraftFieldProps) {
  const [options, setOptions] = useState<string[]>(known ?? [])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    void loadAircraft().then((names) => !cancelled && setOptions(names))
    return () => {
      cancelled = true
    }
  }, [])
  // Typing exactly a known name (a saved aircraft, a pick) shows the whole list again, so it can be changed.
  const typed = options.includes(value) ? "" : value
  const matches = useMemo(() => searchAircraft(options, typed), [options, typed])
  const listId = `${id}-list`

  function pick(name: string) {
    onChange(name)
    setOpen(false)
  }

  return (
    <div
      ref={box}
      className="relative"
      onBlur={(event) => {
        if (!box.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Input
        id={id}
        value={value}
        maxLength={60}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => options.length > 0 && setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setActive(0)
          setOpen(options.length > 0)
        }}
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActive((index) => Math.min(index + 1, matches.length - 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
          } else if (event.key === "Enter") {
            event.preventDefault()
            pick(matches[Math.min(active, matches.length - 1)])
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
        placeholder={copy.editor.aircraftPlaceholder}
        aria-label={copy.editor.aircraftLabel}
        className="h-[var(--control-h,2.25rem)] text-sm"
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="mt-1 max-h-48 overflow-y-auto rounded-md border bg-background py-1 text-sm shadow-sm"
        >
          {matches.map((name, index) => (
            <li key={name} role="option" aria-selected={index === active}>
              <button
                type="button"
                // Picks before the field loses focus (mouse down), so the list doesn't close under the click.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(name)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left hover:bg-muted",
                  index === active && "bg-muted",
                )}
              >
                <span>{name}</span>
                <span className="font-mono text-xs text-muted-foreground">{aircraftCode(name)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
