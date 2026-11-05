// Short names and search for the aircraft Infinite Flight offers (the list itself comes from the Live API, see
// app/api/live/aircraft). The codes are the ICAO type designators pilots know (A359, B77W); the few aircraft without one
// get the usual short name. An aircraft the map doesn't know yet shows its name without the manufacturer.

const CODES: Record<string, string> = {
  "A-10": "A10",
  "Airbus A220-300": "BCS3",
  "Airbus A318": "A318",
  "Airbus A319": "A319",
  "Airbus A320": "A320",
  "Airbus A320 NEO": "A20N",
  "Airbus A321": "A321",
  "Airbus A321 NEO": "A21N",
  "Airbus A330-200": "A332",
  "Airbus A330-200F": "A332F",
  "Airbus A330-300": "A333",
  "Airbus A330-800": "A338",
  "Airbus A330-900": "A339",
  "Airbus A340-600": "A346",
  "Airbus A350-1000": "A35K",
  "Airbus A350-900": "A359",
  "Airbus A380": "A388",
  "Boeing 717-200": "B712",
  "Boeing 737-700": "B737",
  "Boeing 737-8 MAX": "B38M",
  "Boeing 737-800": "B738",
  "Boeing 737-900": "B739",
  "Boeing 747-200": "B742",
  "Boeing 747-400": "B744",
  "Boeing 747-8": "B748",
  "Boeing 757-200": "B752",
  "Boeing 767-300": "B763",
  "Boeing 777-200ER": "B772",
  "Boeing 777-200LR": "B77L",
  "Boeing 777-300ER": "B77W",
  "Boeing 777F": "B77F",
  "Boeing 787-10": "B78X",
  "Boeing 787-8": "B788",
  "Boeing 787-9": "B789",
  "Bombardier Dash 8-Q400": "DH8D",
  "C-130H": "C130",
  "C-130J": "C30J",
  "C-130J-30": "C30J-30",
  "C-17": "C17",
  "Cessna 172": "C172",
  "Cessna 208": "C208",
  "Challenger 350": "CL35",
  "Cirrus SR22 GTS": "SR22",
  "CRJ-1000": "CRJX",
  "CRJ-200": "CRJ2",
  "CRJ-700": "CRJ7",
  "CRJ-900": "CRJ9",
  "CubCrafters XCub": "XCUB",
  "DC-10": "DC10",
  "DC-10F": "DC10F",
  "E175": "E75L",
  "E190": "E190",
  "F-14": "F14",
  "F-16": "F16",
  "F-22": "F22",
  "F/A-18E Super Hornet": "F18S",
  "MD-11": "MD11",
  "MD-11F": "MD11F",
  "P-38": "P38",
  "Piper PA28 Archer": "PA28",
  Spitfire: "SPIT",
  "TBM-930": "TBM9",
}

const MAKERS = /^(airbus|boeing|bombardier|cessna|piper|cirrus|cubcrafters)\s+/i

/** The short name of an aircraft: "Airbus A350-900" becomes "A359". Free text that isn't an Infinite Flight name stays as typed. */
export function aircraftCode(name: string): string {
  const clean = name.trim()
  return CODES[clean] ?? clean.replace(MAKERS, "")
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "")

/**
 * Finds aircraft from whatever part of the name or code is typed: "359", "a350", "350 900", "737 max" or "b77w" all work, in any
 * order. Every word typed has to match somewhere in the name or the code; codes that start with the text come first.
 */
export function searchAircraft(names: readonly string[], query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).map(squash).filter(Boolean)
  if (words.length === 0) return [...names]
  const first = words[0]
  const scored: { name: string; rank: number }[] = []
  for (const name of names) {
    const code = squash(aircraftCode(name))
    const haystack = `${squash(name)} ${code}`
    if (!words.every((word) => haystack.includes(word))) continue
    const rank = code.startsWith(first) ? 0 : squash(name.replace(MAKERS, "")).startsWith(first) ? 1 : 2
    scored.push({ name, rank })
  }
  return scored.sort((a, b) => a.rank - b.rank).map((entry) => entry.name)
}
