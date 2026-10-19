# Copy review: live airport info

Keys are in `lib/copy.ts` (`copy.live` and `atisWindText`). Every line is marked `// PROVISIONAL`: production is blocked until you approve (`pnpm check:copy`). The block sits in the editor's Options tab, under Ground movements, once per airport (departure and arrival). The whole block is hidden when live data is switched off.

**To decide first:**
1. **Wind unit.** The ATIS says "Wind 240 at 5" with no unit. The panel shows "240° at 5 kt", assuming knots (Infinite Flight uses knots). Check one against the game before approving.
2. **"Expert Server" in the source line.** The panel only ever shows the Expert Server's ATIS. Keep the mention, or use plain "Live from Infinite Flight"?
3. **Source line and Infinite Flight's terms.** Check the credit wording against the current terms when you verify them (the brief asks for this).

| Key | Where / when | Current text |
|---|---|---|
| `heading` | Block title | Live airport info |
| `departure`, `arrival` | Row titles | Departure, Arrival |
| `loading` | While the first answer is awaited | Looking for the ATIS... |
| `atisLetter` | Before the ATIS letter, top right of a row | Information (then the letter, e.g. OSCAR) |
| `landing`, `departing` | Runway rows | Landing, Departing |
| `wind`, `windCalm`, `windVariable` | Wind row | Wind, Calm, Variable |
| `atisWindText` | Wind value | 240° at 5 kt / Variable at 5 kt / 240° at 12 kt, gusting 25 kt |
| `noAtis` | No ATIS (no air traffic control with an ATIS online) | No ATIS at this airport right now. |
| `unavailable` | Infinite Flight did not answer, key refused, or too many airports followed | Live data isn't available right now. |
| `runwaysNotRead` | ATIS present but the runways could not be read | The runways couldn't be read from this ATIS. Read the text. |
| `showText`, `hideText` | Toggle for the full ATIS text | Show the ATIS text, Hide the ATIS text |
| `runwayTap` | Under the runways when the ATIS lists several and nothing is chosen | Tap the runway you'll use. |
| `runwayFromAtis` | The ATIS named exactly one runway and it is the choice | From the ATIS. |
| `runwayYours` | The pilot tapped a runway that the ATIS lists | Your choice. |
| `runwayYoursNotInAtis` | The pilot's runway is no longer in the ATIS (it changed since) | Your choice. Not in the ATIS now. |
| `source` | Foot of the block | Live from the Infinite Flight Expert Server. Simulation only. |

Not shown: nothing is shown when live data is off, when the key is missing on that environment, or for a code that is not an airport.
