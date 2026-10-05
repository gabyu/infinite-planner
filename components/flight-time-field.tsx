"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"

interface FlightTimeFieldProps {
  idPrefix: string
  value: number | null
  onChange: (minutes: number | null) => void
  // Bump this (e.g. when the dialog opens) to reload the inputs from `value`.
  resetKey?: unknown
}

const clampDigits = (value: string, max: number) => {
  const digits = value.replace(/\D/g, "").slice(0, 2)
  return digits === "" ? "" : String(Math.min(Number(digits), max))
}

// Hours + minutes inputs for the optional flight time. The value is whole minutes
// (null = not set); 0 h 0 min means not set too. Typing is kept as strings so a
// half-typed value ("" or "0") isn't rewritten under the cursor.
export function FlightTimeField({ idPrefix, value, onChange, resetKey }: FlightTimeFieldProps) {
  const [hours, setHours] = useState("")
  const [minutes, setMinutes] = useState("")

  useEffect(() => {
    setHours(value ? String(Math.floor(value / 60)) : "")
    setMinutes(value ? String(value % 60) : "")
    // Re-sync only on reset; typing is the source of truth in between.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const update = (nextHours: string, nextMinutes: string) => {
    setHours(nextHours)
    setMinutes(nextMinutes)
    const total = (Number.parseInt(nextHours, 10) || 0) * 60 + (Number.parseInt(nextMinutes, 10) || 0)
    onChange(total > 0 ? Math.min(total, 5999) : null)
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        id={`${idPrefix}-hours`}
        inputMode="numeric"
        value={hours}
        onChange={(e) => update(clampDigits(e.target.value, 99), minutes)}
        placeholder="0"
        className="w-14 text-center"
        aria-label="Hours"
      />
      <span className="text-xs text-muted-foreground">h</span>
      <Input
        id={`${idPrefix}-minutes`}
        inputMode="numeric"
        value={minutes}
        onChange={(e) => update(hours, clampDigits(e.target.value, 59))}
        placeholder="00"
        className="w-14 text-center"
        aria-label="Minutes"
      />
      <span className="text-xs text-muted-foreground">min</span>
    </div>
  )
}
