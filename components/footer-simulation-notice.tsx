"use client"

import { usePathname } from "next/navigation"
import { SIMULATION_DISCLAIMER } from "@/lib/brand"

// The simulation-only notice that closes the footer of the library's pages (plans, Explore, profiles).
const LIBRARY_PATHS = ["/explore", "/pilots", "/preview/"]

export function FooterSimulationNotice() {
  const pathname = usePathname()
  if (!LIBRARY_PATHS.some((prefix) => pathname.startsWith(prefix))) return null
  return <p className="mt-2 text-sm text-gray-500">{SIMULATION_DISCLAIMER}</p>
}
