import { SiteHeaderClient } from "@/components/site-header-client"
import { getLibraryLaunched } from "@/lib/library"

// The same header on every page. A server wrapper only to know whether the library is launched (a cached
// value, so pages stay static and refresh when the switch is flipped): the Explore link shows once it is.
export async function SiteHeader() {
  // A failed lookup counts as "not launched": the link just stays hidden.
  const launched = await getLibraryLaunched().catch(() => false)
  return <SiteHeaderClient showExplore={launched} />
}
