// The two steps of the airport block (Departure and Arrival tabs): confirm the runway, then load, save or keep a
// procedure, after which the block folds into one line. Pure state, held by the editor so that it survives switching
// tabs; never saved.

export interface AirportFlow {
  /** The airport this state belongs to: another code starts over. */
  icao: string
  /** The runway the pilot tapped. Null: step 1 is open. */
  runway: string | null
  /** Set once step 2 is over: what the folded line shows. */
  done: { runway: string; leg: string | null } | null
  /** The block as the pilot or the flow left it. Null: the default for the screen (open on desktop, folded on a phone). */
  open: boolean | null
}

export function flowFor(flow: AirportFlow | null, icao: string): AirportFlow {
  return flow && flow.icao === icao ? flow : { icao, runway: null, done: null, open: null }
}

/** A tap on a runway tile. A result obtained on another runway no longer applies. */
export function confirmRunway(flow: AirportFlow, runway: string): AirportFlow {
  return { ...flow, runway, done: flow.done?.runway === runway ? flow.done : null, open: true }
}

/** "change": step 1 again. */
export function reopenRunway(flow: AirportFlow): AirportFlow {
  return { ...flow, runway: null }
}

/** Apply, Save or Keep mine. */
export function finishFlow(flow: AirportFlow, runway: string, leg: string | null): AirportFlow {
  return { ...flow, runway, done: { runway, leg }, open: false }
}

export function setFlowOpen(flow: AirportFlow, open: boolean): AirportFlow {
  return { ...flow, open }
}
