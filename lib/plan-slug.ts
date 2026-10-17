// URLs of the library, shared by the server and the client (no server-only imports here).
//
// A plan page lives at /explore/plans/{origin}-{destination}[-{flightnumber}]-{publicId}, e.g.
// /explore/plans/lfpg-klax-af65-k3x9p2qa. Only the trailing public id identifies the plan; the rest is
// there for readers and search engines, and a wrong one is redirected to the canonical form.

// Same alphabet as generate_public_id() in the database: no 0 o 1 i l u.
export const PUBLIC_ID_PATTERN = /^[2-9a-hj-km-np-tv-z]{8}$/

export function isPublicId(value: string) {
  return PUBLIC_ID_PATTERN.test(value)
}

interface SlugSource {
  origin: string
  destination: string
  flightNumber: string | null
  publicId: string
}

export function planSlug({ origin, destination, flightNumber, publicId }: SlugSource) {
  return [origin, destination, flightNumber, publicId]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase())
    .join("-")
}

export function planPath(source: SlugSource) {
  return `/explore/plans/${planSlug(source)}`
}

// The public id at the end of a slug, or null when the slug doesn't end in one.
export function publicIdFromSlug(slug: string): string | null {
  const last = slug.split("-").pop() ?? ""
  return isPublicId(last) ? last : null
}

export function routeHubPath(origin: string, destination: string) {
  return `/explore/routes/${origin.toLowerCase()}-${destination.toLowerCase()}`
}

// Every plan that departs from or arrives at an airport, and every plan of one flight number. The codes are
// written the way pilots write them: KPHX, AF69.
export function locationPath(icao: string) {
  return `/explore/location/${icao.toUpperCase()}`
}

export function flightNumberPath(flightNumber: string) {
  return `/explore/flight_number/${flightNumber.toUpperCase()}`
}
