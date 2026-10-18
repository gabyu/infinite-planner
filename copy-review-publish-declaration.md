# Copy review: publish declaration

Keys are in `lib/copy.ts` (`legalCopy`). The text there is the **Calm** option, marked `// PROVISIONAL`: production is blocked until you approve. One dialog is used everywhere a plan is published (dashboard, Convert, Sketch, the editor); the checkbox appears only for a plan made from an imported file. The wording version stored with each declaration is `DECLARATION_WORDING_KEY` (`declarationCheckbox@1`): it changes if you change the checkbox wording.
Character limits: title ≤ 60, body ≤ 110, checkbox ≤ 170 before the link, buttons ≤ 16.

**To decide:** the body says "comes from a file you imported", and the dialog is the same for a plan drawn in Route Sketch, as the brief asks. For a Sketch plan that sentence is not true. Options: keep (as written), or use a neutral body, e.g. Calm "Publishing it shows it to the community." Tell me which.

| Key | Where / when | Serious | Calm (current) | Short | Fun (not recommended) |
|---|---|---|---|---|---|
| `declarationTitle` | Dialog title | Declaration of the right to share | Do you have the right to share this flight plan? | Right to share? | Is this one yours to share? |
| `declarationBody` **(approved: neutral)** | Dialog text | This flight plan was created from a file you imported. Publishing it makes it visible to the community. | This flight plan comes from a file you imported. Publishing it shows it to the community. | From your file. Publishing shows it to the community. | You brought this plan in. Ready to show the community? |
| `declarationCheckbox` + `declarationTermsLink` | Checkbox label, imported plans only; "Terms" opens the Terms in a new tab | I declare that I created this flight plan or have the right to share it, and that it does not come from a source that forbids sharing. See the Terms. | I created this flight plan, or I have the right to share it, and it does not come from a source that forbids sharing. See the Terms. | I made it or may share it, and its source allows sharing. See the Terms. | It's mine to share, and nobody said otherwise. See the Terms. |
| `declarationConfirm` | Button, disabled until the box is ticked | Publish | Share it | Share | Share it with the world |
| `declarationCancel` | Button; same as the X, Escape, click outside | Cancel | Not now | Cancel | Maybe later |
| `declarationRequired` | API error if the declaration is missing | A declaration is required to publish this flight plan. | Confirm you have the right to share this flight plan. | Declaration needed. | Hold on: confirm it's yours to share. |

## Not new strings

- Removed with the share-link controls: "Copy link" and "Link copied" (no replacement; the plan's page shows the visibility switch only).
- The sign-in screen for anonymous visitors of Explore pages was written in the members-only change; there are no old share tokens left, see the PR notes.
