import type { Metadata } from "next"
import { Visualizer } from "@/components/visualizer/visualizer"
import { getRecentFlightsLive } from "@/lib/recent-flights"
import { privatePageMetadata } from "@/lib/seo"

// Fresher than the homepage (5 minutes): this page is made to be left open.
export const revalidate = 300

// A hidden screensaver page: not linked anywhere and kept out of search results.
export const metadata: Metadata = privatePageMetadata("Flight visualizer")

export default async function VisualizerPage() {
  const flights = await getRecentFlightsLive(100)
  return <Visualizer flights={flights} />
}
