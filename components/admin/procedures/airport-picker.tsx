"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AirportInput } from "@/components/ds/airport-input"

// Any airport of the bundled dataset, by code, name, city or IATA: the same field as the import form. Picking one opens it.
export function AirportPicker({ current }: { current: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  return (
    <div className="w-full sm:w-64">
      <AirportInput
        id="procedures-airport"
        label="Open an airport"
        bare
        value={value}
        valid={/^[A-Z]{4}$/.test(value)}
        placeholder="Open an airport"
        compact
        onChange={(icao) => {
          setValue(icao)
          if (/^[A-Z]{4}$/.test(icao) && icao !== current) router.push(`/admin-dashboard/procedures?airport=${icao}`)
        }}
      />
    </div>
  )
}
