"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Match {
  icao: string
  name: string
  city: string
  iata: string
  country: string
}

interface AirportInputProps {
  id: string
  label: string
  /** The ICAO code the form holds ("" until a complete code is chosen or typed). */
  value: string
  valid: boolean
  onChange: (icao: string) => void
  placeholder?: string
  className?: string
}

const CODE = /^[A-Za-z]{4}$/
const known = new Map<string, Match | null>()

// "Paris (Roissy-en-France, Val-d'Oise)" -> "Paris (Roissy-en-France)"
const shortCity = (city: string) => city.replace(/,[^)]*\)/, ")")

async function search(query: string): Promise<Match[]> {
  const response = await fetch(`/api/airports?q=${encodeURIComponent(query)}`)
  if (!response.ok) return []
  const { results } = (await response.json()) as { results: Match[] }
  for (const match of results) known.set(match.icao, match)
  return results
}

// An airport field that takes either an ICAO code or a name / city / IATA code ("Paris", "Heathrow",
// "CDG") and suggests matching airports. The form still only ever receives an ICAO code: typing a
// complete 4-letter code is accepted as is (even one we don't know, scenery can be custom), picking a
// suggestion fills the code in. Suggestions come from /api/airports, so the dataset stays on the server.
export function AirportInput({ id, label, value, valid, onChange, placeholder, className }: AirportInputProps) {
  const listId = useId()
  const [text, setText] = useState(value)
  const [results, setResults] = useState<Match[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [chosen, setChosen] = useState<Match | null>(null)
  const requestRef = useRef(0)
  const nameRequestRef = useRef(0)

  // The form can set the code from outside (a FlightAware file name carries the airports).
  useEffect(() => {
    if (value && text.trim().toUpperCase() !== value) setText(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Name of the airport behind the current code, shown under the field.
  useEffect(() => {
    if (!value) return setChosen(null)
    if (known.has(value)) return setChosen(known.get(value) ?? null)
    const request = ++nameRequestRef.current
    search(value).then((matches) => {
      if (request !== nameRequestRef.current) return
      const match = matches.find((m) => m.icao === value) ?? null
      known.set(value, match)
      setChosen(match)
    })
  }, [value])

  // Suggestions while typing (debounced; stale answers are dropped).
  useEffect(() => {
    const query = text.trim()
    if (query.length < 2) {
      setResults([])
      return
    }
    const request = ++requestRef.current
    const timer = setTimeout(() => {
      search(query)
        .then((matches) => request === requestRef.current && (setResults(matches), setActive(0)))
        .catch(() => undefined)
    }, 150)
    return () => clearTimeout(timer)
  }, [text])

  const pick = (match: Match) => {
    setText(match.icao)
    setChosen(match)
    setOpen(false)
    onChange(match.icao)
  }

  const handleText = (next: string) => {
    setText(next)
    setOpen(true)
    const trimmed = next.trim()
    // A complete 4-letter code is the value; anything else (a name being typed) leaves the field incomplete.
    onChange(CODE.test(trimmed) ? trimmed.toUpperCase() : "")
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      pick(results[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const isCode = CODE.test(text.trim())
  const showList = open && results.length > 0
  const unknownCode = valid && !chosen && known.has(value)

  return (
    <div className={cn("relative space-y-2 text-left", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "h-14 border-transparent bg-background px-4 pr-9 text-lg md:text-lg shadow-sm placeholder:text-muted-foreground/40 focus-visible:ring-offset-0",
            isCode && "font-mono text-2xl md:text-2xl uppercase tracking-[0.18em]",
          )}
        />
        {valid && (
          <Check
            aria-label="Valid airport"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500"
          />
        )}

        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1.5 max-h-72 w-[max(100%,22rem)] overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {results.map((match, index) => (
              <li
                key={match.icao}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // mousedown, not click: the input must not lose focus (and close the list) first.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(match)
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2",
                  index === active && "bg-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{match.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[shortCity(match.city), match.country].filter(Boolean).join(", ")}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs">
                  <span className="block font-medium">{match.icao}</span>
                  {match.iata && <span className="block text-muted-foreground">{match.iata}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="min-h-4 truncate text-xs text-muted-foreground">
        {chosen ? chosen.name : unknownCode ? "Not in our airport list, used as typed" : ""}
      </p>
    </div>
  )
}
