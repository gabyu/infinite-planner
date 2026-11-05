"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AircraftField } from "@/components/editor/aircraft-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TrimAirport } from "@/lib/ground-trim"
import type { FlightPlanSummary } from "@/lib/flight-plans"
import { runwayEnds } from "@/lib/runway-guide"

export interface PlanDetails {
  flight_number: string | null
  aircraft: string | null
  departure_runway: string | null
  arrival_runway: string | null
}

interface PlanDetailsDialogProps {
  plan: FlightPlanSummary | null
  onClose: () => void
  /** Called with what the server saved. */
  onSaved: (planId: string, details: PlanDetails) => void
}

// The runway ends of an airport (08L, 08R, 26L...), from the same reference data the editor reads. [] when it can't be loaded:
// the field then shows only the current value.
async function loadRunways(icao: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/airports/${icao}/runways`)
    if (!response.ok) return []
    const airport = (await response.json()) as TrimAirport
    return Array.from(new Set(runwayEnds(airport).map((end) => end.name))).sort()
  } catch {
    return []
  }
}

function RunwaySelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[]; onChange: (runway: string) => void }) {
  // A saved runway the airport data does not list (it changed, or was typed by an older version) stays selectable.
  const all = value && !options.includes(value) ? [value, ...options] : options
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">Not set</option>
        {all.map((runway) => (
          <option key={runway} value={runway}>
            {runway}
          </option>
        ))}
      </select>
    </div>
  )
}

// Edit the details of a flight plan from the dashboard: flight number, aircraft and the two runways. They live in our system only,
// so this works on an exported plan too; the route and the downloaded file never change.
export function PlanDetailsDialog({ plan, onClose, onSaved }: PlanDetailsDialogProps) {
  const [flightNumber, setFlightNumber] = useState("")
  const [aircraft, setAircraft] = useState("")
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [departureOptions, setDepartureOptions] = useState<string[]>([])
  const [arrivalOptions, setArrivalOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planId = plan?.id
  useEffect(() => {
    if (!plan) return
    setFlightNumber(plan.flight_number ?? "")
    setAircraft(plan.aircraft ?? "")
    setDeparture(plan.departure_runway ?? "")
    setArrival(plan.arrival_runway ?? "")
    setError(null)
    setDepartureOptions([])
    setArrivalOptions([])
    let cancelled = false
    void loadRunways(plan.origin_airport).then((list) => !cancelled && setDepartureOptions(list))
    void loadRunways(plan.destination_airport).then((list) => !cancelled && setArrivalOptions(list))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  async function save() {
    if (!plan) return
    setSaving(true)
    setError(null)
    const details = {
      flightNumber: flightNumber.trim().toUpperCase() || null,
      aircraft: aircraft.trim() || null,
      departureRunway: departure || null,
      arrivalRunway: arrival || null,
    }
    try {
      const response = await fetch(`/api/flight-plans/${plan.id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error ?? "Couldn't save the details.")
        return
      }
      onSaved(plan.id, {
        flight_number: details.flightNumber,
        aircraft: details.aircraft,
        departure_runway: details.departureRunway,
        arrival_runway: details.arrivalRunway,
      })
      onClose()
    } catch {
      setError("Couldn't save the details.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            {plan && <span className="font-mono">{plan.origin_airport} → {plan.destination_airport}</span>} The route and the downloaded file stay as they are.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="details-flight-number">Flight number</Label>
            <Input
              id="details-flight-number"
              value={flightNumber}
              maxLength={12}
              autoComplete="off"
              placeholder="AF65"
              onChange={(event) => setFlightNumber(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="details-aircraft">Aircraft</Label>
            <AircraftField id="details-aircraft" value={aircraft} onChange={setAircraft} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RunwaySelect id="details-departure" label="Departure runway" value={departure} options={departureOptions} onChange={setDeparture} />
            <RunwaySelect id="details-arrival" label="Arrival runway" value={arrival} options={arrivalOptions} onChange={setArrival} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
