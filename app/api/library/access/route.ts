import { json } from "@/lib/flight-plan-server"
import { getViewer, isLibraryOpenFor } from "@/lib/library"

// Whether the library is open to whoever is asking (launched, or they are an admin). The planner uses it to
// decide whether to offer "Public" when sharing. Display only: publishing is checked again on the server.
export const dynamic = "force-dynamic"

export async function GET() {
  return json({ open: await isLibraryOpenFor(await getViewer()) })
}
