# Infinite Planner design system ("Studio")

The look of the tool pages: Convert, Sketch, Dashboard, shared plans. Compact, neutral, one blue accent.
The homepage, guide, FAQ and the site header keep the original look; the admin dashboard has its own green accent.
Scope: everything below applies inside `.studio-theme` (set by the planner layout and, for portals, on `<body>`).

## Grid and alignment

**The leftmost element of every page sits on the logo's x position.** The header and every page use the same
container (`container mx-auto px-4`), so the logo, the Back chevron, the page title, the first block of content,
and table/card edges all share one left edge. Nothing is centred in the page: narrow content (a form) is
left-aligned in a narrower column, never floated to the middle.

`PageShell` (`components/ds/page-shell.tsx`) is the one frame that enforces it, with identical vertical rhythm:

| Element | Position |
|---|---|
| Logo / Back chevron / title / content | same x (container left edge) |
| Back link | first row, then 12px gap |
| Title + one line of context (`PageHeader`) | same y on every page |
| Content | below the title block, `width="full"` or `"narrow"` (max 32rem, still left-aligned) |

Pages: Convert, Sketch, Dashboard and shared plans all render through `PageShell`. Only the content differs.

## Principles

- **Operate first.** These pages are tools. Clarity and scanability beat decoration; brand lives in details (the blue, the square route arrow). The logo lives in the header only.
- **One elevation per element.** A surface is either filled (`bg-muted/50`, no border) or outlined (`border`), never both, and shadows stay at `shadow-sm` on inputs sitting on a filled surface.
- **Less chrome, less text.** One title and one line of context per page. No repeated headings, no kickers or eyebrow labels above titles, hints behind a (?) tooltip rather than under the field.
- **State is quiet.** A valid field shows a check mark; only impossible input turns red. Nothing flashes green/red while the user types.

## Tokens

Defined in `app/globals.css` (HSL channels, used as `hsl(var(--token))` via Tailwind).

| Role | Token | Light | Dark |
|---|---|---|---|
| Page | `--background` | 0 0% 98.5% | 0 0% 11% |
| Surface (cards, popovers) | `--card` / `--popover` | 0 0% 100% | 0 0% 14% |
| Quiet fill | `--muted` | 0 0% 95% | 0 0% 16% |
| Hover / selected | `--accent` | 0 0% 94% | 0 0% 18% |
| Text | `--foreground` / `--muted-foreground` | 9% / 40% | 93% / 64% |
| Hairline | `--border` / `--input` | 89% / 85% | 20% / 22% |
| Accent (the only colour) | `--primary`, `--ring` | 221 83% 53% | 217 91% 60% |
| Danger | `--destructive` | 0 72% 51% | 0 63% 45% |
| Radius | `--radius` | 0.375rem (cards up to `rounded-2xl` for hero surfaces) | |
| Activity ramp | `--hm-0` ... `--hm-4` | blue ramp, light to dark = more | inverted |

Control sizes are tokens too, so a page can be roomy or compact without touching components:
`--control-h` (32px here, 40px on the public site), `--control-h-sm`, `--control-h-lg`, `--control-px`.

## Type

Inter for text, IBM Plex Mono for data (airport codes, coordinates, waypoint names, flight numbers).

| Use | Class |
|---|---|
| Page title (every tool page) | `text-xl font-semibold tracking-tight` (`PageHeader`) |
| Body | `text-sm` |
| Secondary / hint | `text-xs text-muted-foreground` |
| Section caption in panels | `.studio-label` (mono, 11px, uppercase, tracked) |
| Data | `font-mono` |

## Components

| Component | File | Notes |
|---|---|---|
| `Button`, `Input`, `Checkbox`, `Dialog`, `Table`... | `components/ui/*` | shadcn primitives; sizes read the `--control-*` tokens |
| `PageShell` | `components/ds/page-shell.tsx` | The frame of every tool page: container, Back link, title block, content width |
| `PageHeader` | `components/ds/page-header.tsx` | Title + one line + actions (the admin imports it through `components/admin/page-header.tsx`) |
| `AirportInput` | `components/ds/airport-input.tsx` | Airport field taking an ICAO code, IATA code, name or city, with keyboard-navigable suggestions (`/api/airports`); the form only receives the ICAO code. 56px, same height as the primary button next to it |
| `IcaoInput` | `components/ds/icao-input.tsx` | Plain 4-letter code field (Sketch will move to `AirportInput`) |
| `StartLayout` | `components/convert/start-layouts.tsx` | Convert before import: form on the left, how-it-works on the right |
| `RouteArrow` | `components/route-arrow.tsx` | Square-ish arrow icon for `ORIGIN > DESTINATION` (the font's arrow glyph is too wide) |
| `PanelSection` | `components/flight-plan-editor.tsx` | Titled block of the options panel, `.studio-label` header with optional (?) hint |
| `FlightTimeField` | `components/flight-time-field.tsx` | Hours + minutes inputs |
| `ActivityHeatmap` | `components/admin/activity-heatmap.tsx` | Rolling 12-month per-day grid, used by the admin overview |
| `ActivityOverview` | `components/dashboard/activity-overview.tsx` | Dashboard card: four headline numbers (small-caps label, large value) over the current calendar year's grid, which stretches to the card width, with current streak and legend in the footer |

## Next candidates

- Move `PanelSection` into `components/ds/`.
- Use `AirportInput` in the Sketch header row (currently an inline variant with its own classes) and drop `IcaoInput`.
- Replace remaining one-off border colours (`border-emerald-500/70`...) with the state conventions above.
