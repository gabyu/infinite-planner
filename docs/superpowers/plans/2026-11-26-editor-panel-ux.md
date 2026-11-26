# Editor Panel UX Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans). Steps use checkboxes.

**Goal:** a calmer editor panel: two-step airport flow, one-line waypoint rows, grouped Options, a low export block.

**Architecture:** the existing components are reshaped; the step state is a small pure module (`lib/airport-steps.ts`)
held by the editor so it survives tab switches. Native `<details>` for the two foldable blocks.

**Spec:** [2026-11-26-editor-panel-ux-design.md](../specs/2026-11-26-editor-panel-ux-design.md). All behaviour and copy
come from it.

## Global Constraints
- No new dependency, no database change, nothing about what is exported, saved or published.
- Strings live in `lib/copy.ts`; the spec's copy is approved, so no `// PROVISIONAL` marker.
- Follow DESIGN.md. Never commit the unrelated local changes (.gitignore, CLAUDE.md, RESTORE.md, public/images/zaidee.webp).
- Push only `staging`. `main` is not touched.

## Review Focus
- An airport changed after "done": the block must open again, with no old runway or leg.
- "Restore original" must still work after the block folds (the guides stay mounted).
- A taxi preview left pending when leaving Options must be dropped.
- Signed out, or procedures not allowed: step 1 only, nothing folds by itself.
- Phone width: the export block and the folded block keep the waypoint list usable.

## Tasks
### 1. Step state and wording rules
Files: create `lib/airport-steps.ts`, `scripts/test-airport-steps.ts`; modify `lib/copy.ts`, `lib/runway-choice.ts`,
`scripts/test-runway-choice.ts`, `package.json`.
Produces: `AirportFlow {icao, runway, done: {runway, leg} | null, open: boolean | null}`, `flowFor(flow, icao)`,
`confirmRunway(flow, runway)`, `reopenRunway(flow)`, `finishFlow(flow, runway, leg)`, `setFlowOpen(flow, open)`.
- [ ] Failing tests: reset on another airport; confirming another runway clears done; finish folds; whole-knot wind text;
  short mismatch text.
- [ ] Implement, tests pass, commit.

### 2. Airport block and procedures
Files: `components/editor/live-airports.tsx`, `components/editor/runway-guides.tsx`.
Consumes task 1. `AirportCard` gets `flow`, `onFlow(next)`, `steps: boolean`; `RunwayGuides` gets
`onDone(runway, leg)`.
- [ ] Block per the spec, commit with task 3.

### 3. Panel: one scroll, one-line rows, Options groups, toasts
Files: `components/flight-plan-editor.tsx`, `components/editor/waypoint-list.tsx`,
`components/editor/ground-movements.tsx`.
- [ ] Implement, `pnpm exec tsc --noEmit` shows no new error, commit.

### 4. Export block and lock
Files: create `components/editor/help-tip.tsx`, `components/editor/plan-lock.tsx`; modify
`components/editor/export-without-arrival.tsx`, `components/visibility-switch.tsx`, `components/flight-plan-editor.tsx`.
- [ ] Implement, commit.

### 5. Verify and ship to staging
- [ ] `pnpm lint`, `pnpm check:copy`, `pnpm test:airport-steps`, `test:runway-choice`, `test:runway-wind`,
  `test:runway-guide`, `test:export-trim`, `pnpm build`.
- [ ] Browser pass (desktop and 390 px), CHANGELOG entry, merge into `staging`, push, check the deployment.
