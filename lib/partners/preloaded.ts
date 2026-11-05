import type { parseKML } from "@/lib/kml-parser"

// What /import hands to the editor once the partner's file was fetched and parsed on the server. Plain data only.
export interface PreloadedImport {
  importId: string
  partnerId: string
  origin: string
  destination: string
  route: ReturnType<typeof parseKML>
  banner: { attribution: string; aerohubId: string | null; callsign: string | null; flightUrl: string | null }
}
