import { SIMULATION_DISCLAIMER } from "@/lib/brand"

// The simulation-only notice that closes every footer of the site.
export function FooterSimulationNotice() {
  return <p className="mt-2 text-sm text-gray-500">{SIMULATION_DISCLAIMER}</p>
}
