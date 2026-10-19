# Copy review: departure guides

Keys are in `lib/copy.ts` (`copy.guides`, `guideSummaryText`, `guidesForText`). Every line is marked `// PROVISIONAL`: `pnpm check:copy` fails, and so does a production build, until you approve. Staging is not affected.

The block sits in the editor's Departure tab, under the airport card, for signed-in people only. A guide is private to the person who saved it; nothing here is shared. The words "guide" and "departure guide" are deliberate: never SID or procedure. The simulation-only line already exists (`legalCopy.simulationOnly`, under Export FPL).

| Key | Where / when | Current text |
|---|---|---|
| `heading` | Title of the block | Departure guide |
| `guideSummaryText` | Under the title (this plan's departure) and on each saved guide: runway, where it headed, distance to the top of climb | 21L · west · 122 NM |
| `save`, `saving`, `saved` | Button that keeps this plan's departure as a guide | Save as guide / Saving... / Saved |
| `needsPlan` | Under the button and as the tooltip when the plan has not been saved yet (autosave comes first) | Available once your plan is saved. |
| `lowConfidence` | The detection could not tell which runway the departure used (for example a drawn route): the pilot taps the runway above, then saves | Couldn't tell which runway this departure used. Tap the runway above, then save. |
| `tapRunway` | Saved guides exist but no runway is tapped | Tap a runway above to see your saved guides for it. |
| `guidesForText` | Above the list, for the runway that was tapped | Your guides for 21R |
| `noGuides` | The list is empty for that runway | You have no saved guides for this runway. |
| `fitSame`, `fitParallel`, `fitSimilar`, `fitOther` | How a saved guide relates to the tapped runway | Same runway / Parallel runway / Similar heading / Other runway |
| `preview`, `hidePreview` | Shows the guide's path on the map (nothing changes in the plan) | Preview / Hide preview |
| `use` | Puts the guide's path into the plan in place of its departure (one undo step) | Use |
| `remove`, `removeConfirm` | Deletes a saved guide; the first press asks | Delete / Delete? |
| `joinWarning` | The guide was recorded on a runway with a different heading, so it joins the path with a straight leg | Different heading: check the terrain and obstacles on the joining leg. |
| `needsDraft` | Tooltip on Use for a plan that is already exported (locked) | This plan is locked. Duplicate it to use a guide. |
| `savedToast`, `appliedToast` | Confirmations (the second has the usual Undo button) | Guide saved / Departure guide applied |
| `errTooMany` | 300 guides saved already | You've reached the limit of 300 saved guides. |
| `errNotSaved`, `errNotDraft`, `errGeneric` | Errors | Save the plan first, then try again. / This plan is locked. Duplicate it to change it. / Something went wrong. Please try again. |

**To decide:** whether "Departure guide" and "Save as guide" are the right words (alternatives: "My departures", "Save departure"), and whether the join warning should say "terrain and obstacles" or something shorter.
