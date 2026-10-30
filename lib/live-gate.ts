import "server-only"
import { getViewer } from "@/lib/library"

// Who may use the live airport card and the departure procedures. While LIVE_REQUIRES_ROLE is "true" (production, until the
// feature opens to everyone) only an admin or a contributor may; anywhere else it is open. Removing the variable opens it.
// The browser only asks and hides things; the live airport route checks this again on every call.
export async function canUseLive(): Promise<boolean> {
  if (process.env.LIVE_REQUIRES_ROLE !== "true") return true
  return (await getViewer()).canPreview
}
