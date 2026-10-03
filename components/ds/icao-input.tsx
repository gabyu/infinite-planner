"use client"

import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface IcaoInputProps {
  id: string
  label: string
  value: string
  /** True once the value is a complete, valid ICAO code. */
  valid: boolean
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// A 4-letter airport code field. Filled, borderless surface; the state is carried by a quiet
// check mark (valid) or a red ring (characters that can never form a code), never by a
// green or red border while the user is still typing.
export function IcaoInput({ id, label, value, valid, onChange, placeholder, className }: IcaoInputProps) {
  const invalid = /[^A-Za-z]/.test(value)

  return (
    <div className={cn("space-y-2 text-left", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={4}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 border-transparent bg-background px-3 text-center font-mono text-2xl uppercase tracking-[0.18em] shadow-sm placeholder:text-muted-foreground/40",
            "focus-visible:ring-offset-0",
            invalid && "ring-2 ring-destructive focus-visible:ring-destructive",
          )}
        />
        {valid && (
          <Check
            aria-label="Valid code"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500"
          />
        )}
      </div>
    </div>
  )
}
