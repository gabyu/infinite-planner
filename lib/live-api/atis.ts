// Reads what the Infinite Flight ATIS text says. Pure functions, no I/O.
//
// Wording seen live (2026-10-18), three sentences:
//   "<Airport>, ATIS information OSCAR, time 1517 ZULU, Wind 240 at 5 Visibility 21, Temperature 20, Dew Point 4, QNH 1020."
//   "Landing Runway 03, Departing Runway 03."          /   "Landing Runways 30L and 30R, Departing Runways 30L and 30R."
//   (a closing sentence)
// Only two airports' runway sentences have been seen, so the parser is strict: anything it does not recognise comes
// back as null / empty and the caller falls back to showing the text and letting the pilot choose. It never guesses.

export type AtisWind = { from: number | null; speedKt: number; gustKt: number | null }

export type ParsedAtis = {
  letter: string | null
  wind: AtisWind | null
  qnh: number | null
  landing: string[]
  departing: string[]
}

// One runway designator: "3", "03", "30L", "30R", "30C". Returns "03" style, or null when it is not one.
function runwayId(token: string): string | null {
  const match = /^(\d{1,2})([LRC])?$/i.exec(token.trim())
  if (!match) return null
  const number = Number(match[1])
  if (number < 1 || number > 36) return null
  return `${String(number).padStart(2, "0")}${(match[2] ?? "").toUpperCase()}`
}

// "30L and 30R", "03", "09, 27L and 27R" -> ["30L","30R"]. One bad token drops the whole list: a half-read
// runway list is worse than none.
function runwayList(text: string): string[] {
  const ids: string[] = []
  for (const part of text.split(/,|\band\b/i)) {
    if (!part.trim()) continue
    const id = runwayId(part)
    if (!id) return []
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

function parseWind(text: string): AtisWind | null {
  if (/\bwind\s+calm\b/i.test(text)) return { from: null, speedKt: 0, gustKt: null }
  const match = /\bwind\s+(\d{1,3}|variable|vrb)\s+at\s+(\d{1,3})(?:\s+gusting\s+(?:to\s+)?(\d{1,3}))?/i.exec(text)
  if (!match) return null
  const from = /^\d+$/.test(match[1]) ? Number(match[1]) % 360 : null
  return { from, speedKt: Number(match[2]), gustKt: match[3] ? Number(match[3]) : null }
}

export function parseAtis(text: string): ParsedAtis {
  const letter = /\binformation\s+([A-Za-z]+)\b/i.exec(text)?.[1]?.toUpperCase() ?? null
  const qnhMatch = /\bQNH\s+(\d{3,4})\b/i.exec(text)
  const landing = /\blanding\s+runways?\s+([^.]*?)(?=,?\s*departing\b|\.|$)/i.exec(text)
  const departing = /\bdeparting\s+runways?\s+([^.]*)/i.exec(text)
  return {
    letter,
    wind: parseWind(text),
    qnh: qnhMatch ? Number(qnhMatch[1]) : null,
    landing: landing ? runwayList(landing[1]) : [],
    departing: departing ? runwayList(departing[1]) : [],
  }
}
