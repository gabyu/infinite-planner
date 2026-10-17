"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { copy } from "@/lib/copy"

interface FlightNumbersFieldProps {
  id: string
  /** Every number of the flight: the first is the primary one (page titles, links), the rest are codeshares. */
  value: string[]
  onChange: (numbers: string[]) => void
}

export const MAX_FLIGHT_NUMBERS = 6
const clean = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)

// A flight can go by several numbers (an airline number and its codeshares). They are chips in one field: type a
// number and press Enter, comma or space (or leave the field) to add it; the cross removes one.
export function FlightNumbersField({ id, value, onChange }: FlightNumbersFieldProps) {
  const [draft, setDraft] = useState("")

  // Adds one or several numbers (a pasted "AF69 KL1234" is two), skipping repeats, up to the maximum.
  const commit = (text: string, keep = "") => {
    const next = [...value]
    for (const part of text.split(/[\s,;]+/)) {
      const number = clean(part)
      if (number && !next.includes(number) && next.length < MAX_FLIGHT_NUMBERS) next.push(number)
    }
    setDraft(keep)
    if (next.length !== value.length) onChange(next)
  }

  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring">
      {value.map((number, index) => (
        <span
          key={number}
          className="inline-flex items-center gap-1 rounded border bg-muted/50 py-0.5 pl-1.5 pr-0.5 font-mono text-xs"
          title={index === 0 ? copy.editor.flightNumberPrimary : undefined}
        >
          {number}
          <button
            type="button"
            aria-label={`${copy.editor.flightNumberRemove} ${number}`}
            onClick={() => onChange(value.filter((other) => other !== number))}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {value.length < MAX_FLIGHT_NUMBERS && (
        <Input
          id={id}
          value={draft}
          onChange={(e) => {
            const text = e.target.value
            if (/[\s,;]/.test(text)) {
              // A separator was typed or pasted: everything before the last one is a number; the rest stays in the field.
              const parts = text.split(/[\s,;]+/)
              commit(parts.slice(0, -1).join(" "), clean(parts[parts.length - 1]))
            } else setDraft(clean(text))
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit(draft)
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? copy.editor.flightNumberPlaceholder : copy.editor.flightNumberAddPlaceholder}
          aria-label={copy.editor.flightNumbersLabel}
          autoComplete="off"
          spellCheck={false}
          className="h-7 min-w-[7rem] flex-1 border-0 bg-transparent px-1 font-mono shadow-none focus-visible:ring-0"
        />
      )}
    </div>
  )
}
