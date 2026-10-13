import type { Metadata } from "next"
import { Visualizer } from "@/components/visualizer/visualizer"
import { getRecentFlights } from "@/lib/recent-flights"

// Same freshness as the homepage globe (one hour).
export const revalidate = 3600

// A hidden screensaver page: not linked anywhere and kept out of search results.
export const metadata: Metadata = {
  title: "Infinite Planner",
  robots: { index: false, follow: false, nocache: true },
}

export default async function VisualizerPage() {
  const flights = await getRecentFlights(20)
  return <Visualizer flights={flights} />
}
