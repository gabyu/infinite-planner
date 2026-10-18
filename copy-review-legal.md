# Copy review: legal and compliance correctif

All keys are in `lib/copy.ts` under `legalCopy`. The text in the catalog is the **Calm** option, marked `// PROVISIONAL` on every line: `pnpm check:copy` fails, and so does the production build, until you approve. Staging is not affected.
Reply with a choice per row (or per block), e.g. "Report: Short, Publishing: Calm".
No user-facing line mentions third-party terms or any legal reasoning. The Terms headings and text are the lawyer's (`content/terms.ts`) and are not in this review.

Character limits: switch helper line ≤ 70, labels ≤ 24, dialog title ≤ 40, dialog text ≤ 90, tags ≤ 24.

## Publishing is not offered for this plan

Shown where the person meets the limit: under or beside the visibility switch (editor options, dashboard row) when the plan comes from a converted file or is a copy of one, and as the error if the server refuses. Same sentence in both places. **Fun** is not recommended: it is a refusal, it should not joke.

| Key | Where / when | Serious | Calm (current) | Short | Fun (not recommended) |
|---|---|---|---|---|---|
| `publishOnlyOwnDesigns` | Switch helper line (disabled) and API error | Only flight plans designed in Route Sketch can be published. | Only flight plans you design in Route Sketch can be published. | Publish routes drawn in Route Sketch. | Only your own Route Sketch creations make it to Explore. |

## A plan an admin took off Explore

Shown to the owner only, in place of the visibility switch on their dashboard row. Neutral: no reason, no hint of a complaint. **Fun** is not recommended.

| Key | Where / when | Serious | Calm (current) | Short | Fun (not recommended) |
|---|---|---|---|---|---|
| `planNotAvailable` | Dashboard row of the owner's plan | This flight plan is not available on Explore. | This flight plan isn't available on Explore right now. | Not available on Explore. | This one is taking a break from Explore. |

## Simulation only

A small line where a plan is viewed or downloaded: under the Download button on a plan page, and under Export FPL in the editor. The longer sentence ("For flight simulation use only. Not for real-world navigation.") already closes the footer of the Explore pages and stays.

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `simulationOnly` | Under Download / Export buttons | For flight simulation only | Simulation only | Sim only | Strictly for the sim: keep it off the real flight deck |

## Report control and form

Control: small link under the plan's stats, for signed-in people who are not the author. Form: dialog with five reasons, a text box and two buttons.

| Key | Where / when | Serious | Calm (current) | Short | Fun |
|---|---|---|---|---|---|
| `reportLink` | Link on a plan page | Report this flight plan | Report | Report | Something wrong? Tell us |
| `reportTitle` | Dialog title | Report a flight plan | Report this flight plan | Report | Spotted a problem? |
| `reportIntro` | Dialog text | State the reason for your report. Only administrators can read it. | Tell us what's wrong. Only the admins see your report. | What's wrong? Only admins see this. | Tell us what's off. Only the admins will read it. |
| `reportReasonInappropriate` | Reason 1 | Inappropriate content | Inappropriate content | Inappropriate | Not okay for the community |
| `reportReasonCopyright` | Reason 2 | Copyright infringement | Copyright infringement | Copyright | This isn't theirs to share |
| `reportReasonWrongData` | Reason 3 | Incorrect or corrupted data | Wrong or broken data | Wrong data | The route looks off |
| `reportReasonSpam` | Reason 4 | Spam | Spam | Spam | Spam |
| `reportReasonOther` | Reason 5 | Other | Something else | Other | Something else entirely |
| `reportDetailsPlaceholder` | Text box | Additional details (optional) | Details (optional) | Details (optional) | Anything else we should know? |
| `reportSend` | Send button | Submit report | Send report | Send | Send it in |
| `reportThanksTitle` | Dialog title after sending | Report received | Thanks for your report | Thanks | Thanks for the heads-up |
| `reportThanksBody` | Dialog text after sending | An administrator will review it. | An admin will look at it. | We'll take a look. | We'll take it from here. |
| `reportError` | Error in the dialog | Your report could not be sent. Try again. | Couldn't send your report. Please try again. | Not sent. Try again. | That didn't go through. Give it another go. |
| `reportOwnPlan` | Error if the author reports their own plan | You cannot report your own flight plan. | This is your own flight plan. | That's your own plan. | You can't report your own handiwork. |

## Not in this review

- Terms of Service and Privacy Policy wording: the lawyer's. The Terms text is one file, `content/terms.ts`.
- The FAQ lines about Explore and the arrival route (no more SID/STAR wording): small factual edits, listed in the PR.
