"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AirportInput } from "@/components/ds/airport-input"

// Any airport of the bundled dataset, by code, name or city; picking one opens its page.
export function AirportSearch({ current }: { current: string }) {
  const router = useRouter()
  const [value, setValue] = useState("")
  return (
    <div className="max-w-sm">
      <AirportInput
        id="procedures-airport"
        label="Find an airport"
        value={value}
        valid={/^[A-Z]{4}$/.test(value)}
        placeholder="Code, name or city"
        onChange={(icao) => {
          setValue(icao)
          if (/^[A-Z]{4}$/.test(icao) && icao !== current) router.push(`/dev/procedures?airport=${icao}`)
        }}
      />
    </div>
  )
}
