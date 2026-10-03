"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RouteArrow } from "@/components/route-arrow"
import { SharedPlanMap } from "@/components/shared-plan-map"
import {
  flightPlanEditPath,
  formatFlightTime,
  sourceLabel,
  type FlightPlanSource,
  type FlightPlanStatus,
  type StoredWaypoint,
} from "@/lib/flight-plans"

interface PlanDetails {
  id: string
  status: FlightPlanStatus
  source: FlightPlanSource
  flight_number: string | null
  origin_airport: string
  destination_airport: string
  origin_airport_name: string | null
  destination_airport_name: string | null
  flight_time_minutes: number | null
  waypoints: StoredWaypoint[]
}

// Read-only look at one of the user's plans (draft or exported): the route on a map and its
// details. Drafts offer Edit, exported plans offer Download.
export function PlanViewDialog({ planId, onClose }: { planId: string; onClose: () => void }) {
  const [plan, setPlan] = useState<PlanDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/flight-plans/${planId}`)
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (ok && body) setPlan(body as PlanDetails)
        else setError(body?.error ?? "Couldn't load this flight plan.")
      })
      .catch(() => !cancelled && setError("Couldn't reach the server."))
    return () => {
      cancelled = true
    }
  }, [planId])

  const flightTime = plan ? formatFlightTime(plan.flight_time_minutes) : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {plan ? (
              <span className="font-mono">
                {plan.origin_airport}
                <RouteArrow />
                {plan.destination_airport}
              </span>
            ) : (
              "Flight plan"
            )}
            {plan?.status === "draft" && (
              <Badge variant="secondary" className="font-sans text-[11px] font-normal">
                Draft
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {plan
              ? [
                  plan.origin_airport_name && plan.destination_airport_name
                    ? `${plan.origin_airport_name} to ${plan.destination_airport_name}`
                    : null,
                  plan.flight_number,
                  sourceLabel(plan.source),
                  flightTime,
                  `${plan.waypoints.length} waypoints`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : (error ?? "Loading...")}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[360px] w-full">
          {plan ? (
            <SharedPlanMap waypoints={plan.waypoints} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {error ?? "Loading the map..."}
            </div>
          )}
        </div>

        {plan && (
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            {plan.status === "draft" ? (
              <Button asChild>
                <Link href={flightPlanEditPath(plan)} className="no-underline">
                  <Pencil /> Edit draft
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <a href={`/api/flight-plans/${plan.id}/fpl`} download>
                  <Download /> Download FPL
                </a>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
