// The runway chosen for one end of a plan (departure or arrival). Pure functions, no React.
//
// Two sources, and the pilot always wins:
//   - the ATIS: when it names exactly one runway for that end, that runway is the choice. With several (22L and 21R)
//     nothing is chosen for the pilot, since all of them are in use;
//   - the pilot's own tap. It is stored on its own, apart from anything the ATIS says, so a later ATIS can never
//     replace it. It only goes away when the pilot taps it again, or when the airport on that end changes.

/** What the pilot tapped: kept by the editor, one per end. */
export type HandChoice = { icao: string; runway: string }

export type EndChoice = {
  runway: string
  by: "atis" | "hand"
  /** False when the pilot's runway is not among the ones the current ATIS lists (it changed since they chose). */
  inAtis: boolean
}

/** The runway that counts for this end: the pilot's tap when it is for this airport, else the ATIS's single runway. */
export function effectiveChoice(hand: HandChoice | null, icao: string, atisRunways: string[]): EndChoice | null {
  if (hand && hand.icao === icao) return { runway: hand.runway, by: "hand", inAtis: atisRunways.includes(hand.runway) }
  if (atisRunways.length === 1) return { runway: atisRunways[0], by: "atis", inAtis: true }
  return null
}

/** A tap on a runway: it becomes the pilot's choice; tapping the pilot's own choice again clears it. */
export function tapRunway(hand: HandChoice | null, icao: string, runway: string): HandChoice | null {
  if (hand && hand.icao === icao && hand.runway === runway) return null
  return { icao, runway }
}

/** The runways to show as chips: the ATIS's, plus the pilot's own when it is no longer in the ATIS (so it stays visible). */
export function chipRunways(choice: EndChoice | null, atisRunways: string[]): string[] {
  return choice && choice.by === "hand" && !choice.inAtis ? [...atisRunways, choice.runway] : atisRunways
}
