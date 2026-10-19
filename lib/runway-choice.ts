// The runway chosen for one end of a plan (departure or arrival). Pure functions, no React.
//
// Two sources, and the pilot always wins:
//   - the ATIS: when it names exactly one runway for that end, that runway is the choice. With several (22L and 21R)
//     nothing is chosen for the pilot, since all of them are in use;
//   - the wind, only where there is no ATIS: the one runway end the wind clearly favours (lib/runway-wind.ts), pre-selected;
//   - the pilot's own tap. It is stored on its own, apart from anything the ATIS says, so a later ATIS can never
//     replace it. It only goes away when the pilot taps it again, or when the airport on that end changes.

/** What the pilot tapped: kept by the editor, one per end. */
export type HandChoice = { icao: string; runway: string }

export type EndChoice = {
  runway: string
  by: "atis" | "wind" | "hand"
  /** False when the pilot's runway is not among the ones the current ATIS lists (it changed since they chose). */
  inAtis: boolean
}

/**
 * The runway that counts for this end: the pilot's tap when it is for this airport, else the ATIS's single runway, else
 * (where there is no ATIS) the end the wind clearly favours.
 */
export function effectiveChoice(hand: HandChoice | null, icao: string, atisRunways: string[], windPick: string | null = null): EndChoice | null {
  if (hand && hand.icao === icao) return { runway: hand.runway, by: "hand", inAtis: atisRunways.includes(hand.runway) }
  if (atisRunways.length === 1) return { runway: atisRunways[0], by: "atis", inAtis: true }
  if (atisRunways.length === 0 && windPick) return { runway: windPick, by: "wind", inAtis: true }
  return null
}

/** A tap on a runway: it becomes the pilot's choice; tapping the pilot's own choice again clears it. */
export function tapRunway(hand: HandChoice | null, icao: string, runway: string): HandChoice | null {
  if (hand && hand.icao === icao && hand.runway === runway) return null
  return { icao, runway }
}

/** The runways to show as chips: the given list (the ATIS's, or every end of the airport), plus the pilot's own when it is not in it. */
export function chipRunways(choice: EndChoice | null, runways: string[]): string[] {
  return choice && choice.by === "hand" && !runways.includes(choice.runway) ? [...runways, choice.runway] : runways
}
