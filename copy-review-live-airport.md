# Copy review: live airport info

**Editor tabs (new):** the panel now has Departure, Cruise, Arrival and Options tabs (Cruise appears only when the plan has waypoints between the two ends). Strings: `copy.editor.tabDeparture` = Departure, `tabCruise` = Cruise, `tabArrival` = Arrival (Options is the existing `optionsHeading`). All `// PROVISIONAL`. The old "Waypoints" tab label is gone; the list header still reads "Waypoints · N".

Keys are in `lib/copy.ts` (`copy.live` and `atisWindText`). Every line is marked `// PROVISIONAL`: production is blocked until you approve (`pnpm check:copy`). The card sits at the top of the Departure tab and of the Arrival tab, above Ground movements and the waypoints (one line when collapsed, the runway chips and the ATIS text when open; the chips carry no "Departing" / "Landing" label, the tab already says which end it is). It is hidden when live data is switched off.

**To decide first (weather):** the weather lines above come from real METARs (NOAA, public domain). The game's own ATIS wind repeats the latest METAR about 45-60 minutes late, so a METAR wind may differ slightly from what the game says at the same moment. Have someone read NOAA's disclaimer before launch: no implied endorsement, no presenting the data as official.

**To decide first:**
1. **Wind unit.** The ATIS says "Wind 240 at 5" with no unit. The panel shows "240° at 5 kt", assuming knots (Infinite Flight uses knots). Check one against the game before approving.
2. **"Expert Server" in the source line.** The panel only ever shows the Expert Server's ATIS. Keep the mention, or use plain "Live from Infinite Flight"?
3. **Source line and Infinite Flight's terms.** Check the credit wording against the current terms when you verify them (the brief asks for this).

| Key | Where / when | Current text |
|---|---|---|
| `groundWaypoints` | Label of the Ground movements switch in the Departure and Arrival tabs; the text never changes with the switch state (on keeps the taxi in the plan, off removes it). Replaces the heading "Ground movements" and the two buttons "Departure" / "Arrival". The hint under it (`groundHint`, already approved) stays on desktop | Ground movement waypoints |
| `heading` | Block title | Live airport info |
| `departure`, `arrival` | Row titles | Departure, Arrival |
| `loading` | While the first answer is awaited | Looking for the ATIS... |
| `atisLetter` | Before the ATIS letter, top right of a row | Information (then the letter, e.g. OSCAR) |
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
| `noAtisShort` | Start of the collapsed line when there is no ATIS but a wind: "No ATIS · 280° at 12 kt · Departing 28R" | No ATIS |
| `runwayIntoWind` | The wind clearly favours exactly one runway end and it is pre-selected | Into the wind. |
| `bestHeadwind` | Several ends are close (or parallel runways tie): the best ones are named, nothing is pre-selected | Best headwind: 28L, 28R. |
| `lightWind` | Wind under 3 kt or variable: nothing is marked or chosen | Light wind: any runway. |
| `noWeather` | No ATIS and no METAR within 25 NM | No recent weather report nearby. |
| `weatherUnavailable` | No ATIS and NOAA could not be reached | Weather isn't available right now. |
| `weatherCredit` | After the source line, when a METAR wind is shown. Names the source only; NOAA's disclaimer forbids implying its endorsement, so keep it to this | Weather: NOAA Aviation Weather Center. |
| `weatherSourceText` | Source line: the airport's own METAR, or a neighbouring station with its distance | METAR KSFO, 04:53Z. / From KOAK, 12 NM away, 04:53Z. |
| `runwayComponentsText` | The wind on the chosen runway (also the tooltip of each chip) | 28R: headwind 5 kt, crosswind 3 kt from the right. (tailwind / left likewise) |
| `source` | Foot of the block | Live from the Infinite Flight Expert Server. Simulation only. |

Not shown: nothing is shown when live data is off, when the key is missing on that environment, or for a code that is not an airport.
