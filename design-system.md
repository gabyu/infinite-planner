# Infinite Planner: design system (as it exists in the code)

Generated 2026-10-16 from `app/globals.css`, `tailwind.config.ts`, `components/ui/*` and a scan of the Tailwind colour classes used across `app/` and `components/`. Nothing here is new: it is an inventory.

## 1. How colour works

Colours are **semantic tokens** (CSS variables in HSL, `H S% L%`) defined in `app/globals.css` and exposed to Tailwind in `tailwind.config.ts` (`bg-primary`, `text-muted-foreground`, `border-border`...). Four **themes** override the same token names, each with a light and a dark version:

| Theme | Where it applies | Class |
|---|---|---|
| Public (default) | Home, Explore, plan pages, help, legal | `:root` / `.dark` |
| Studio | Convert, Sketch, History, shared plans (Supabase Studio-like layout and density) | `.studio-theme` |
| Admin | Admin dashboard (same layout as Studio) | `.admin-theme` |

Since 2026-10-16 the Admin accent is the same blue as everywhere else (it used to be green).

## 2. Tokens and their job

| Token | Job |
|---|---|
| `background` / `foreground` | Page surface and default text |
| `card` / `card-foreground` | Cards, panels, dialogs' surface |
| `popover` / `popover-foreground` | Menus, tooltips, popovers |
| `primary` / `primary-foreground` | **The one accent**: main buttons, links, active states, focus, badges (as 15% tint) |
| `secondary` / `secondary-foreground` | Quiet filled controls, secondary buttons |
| `muted` / `muted-foreground` | Soft surfaces, secondary text, captions |
| `accent` / `accent-foreground` | Hover background of ghost/outline buttons and menu items |
| `destructive` / `destructive-foreground` | Delete, errors, warnings that destroy something |
| `border` | Hairlines, card outlines, separators (applied to every element by default) |
| `input` | Form control borders |
| `ring` | Keyboard focus ring |
| `--radius` | Corner radius (0.5rem public, 0.375rem Studio and Admin); `rounded-lg/md/sm` derive from it |
| `--hm-0` ... `--hm-4` | Activity heatmap ramp (grey, then four blues; reversed in dark so "more" is lighter) |

### Public theme values

| Token | Light (HSL) | Dark (HSL) |
|---|---|---|
| background | 0 0% 100% (white) | 222.2 84% 4.9% (near-black navy) |
| foreground | 222.2 84% 4.9% | 210 40% 98% |
| card, popover | same as background | same as background |
| primary | 221.2 83.2% 53.3% (blue, about #2563eb) | 217.2 91.2% 59.8% (lighter blue, about #3b82f6) |
| primary-foreground | 210 40% 98% | 222.2 47.4% 11.2% |
| secondary, muted, accent | 210 40% 96.1% | 217.2 32.6% 17.5% |
| muted-foreground | 215.4 16.3% 46.9% | 215 20.2% 65.1% |
| destructive | 0 84.2% 60.2% (red) | 0 62.8% 30.6% |
| border, input | 214.3 31.8% 91.4% | 217.2 32.6% 17.5% |
| ring | 221.2 83.2% 53.3% | 224.3 76.3% 48% |

### Studio and Admin theme values (neutral greys, the same accent blue)

| Token | Light | Dark |
|---|---|---|
| background | 0 0% 98.5% | 0 0% 11% |
| foreground | 0 0% 9% | 0 0% 93% |
| card, popover | 0 0% 100% | 0 0% 14% |
| primary | 221.2 83.2% 53.3% | 217.2 91.2% 59.8% |
| secondary, accent | 0 0% 94% | 0 0% 17% / 18% |
| muted | 0 0% 95% | 0 0% 16% |
| muted-foreground | 0 0% 40% | 0 0% 64% |
| destructive | 0 72% 51% (Studio) | 0 63% 45% (Studio) |
| border | 0 0% 89% | 0 0% 20% |
| input | 0 0% 85% | 0 0% 22% |
| ring | same as primary | same as primary |

Admin has no `destructive` override: it inherits the public one (red 0 84.2% 60.2% light, 0 62.8% 30.6% dark). That is a small inconsistency with Studio.

Studio and Admin also tighten control sizes: `--control-h` 2rem (public 2.5rem), `--control-h-sm` 1.75rem, `--control-h-lg` 2.25rem, `--control-px` 0.75rem.

## 3. Colours that are not tokens

These are hard-coded in components or CSS.

### Altitude ramp (routes, globe, cards, plan maps, Explore front)
Cyan near the ground, through blue, to violet then magenta at cruise (0 to 40,000 ft). Defined in `components/home/altitude-ramp.ts`, mirrored as 16 steps in the `.alt-N` / `.alt-stop-N` CSS classes.

| Stop | Light | Dark |
|---|---|---|
| 0 ft | #06b6d4 | #22d3ee |
| about 13,000 ft | #2563eb | #60a5fa |
| about 27,000 ft | #6a3fe6 | #9585f6 |
| 40,000 ft | #a22fe0 | #c27bfa |

### Tailwind palette classes used directly (count of uses)
- **Greys** (`gray-100` ... `gray-950`): about 90 uses, mostly the Convert/Sketch editor, footer, maps and help. They duplicate what `muted`, `border` and `foreground` already do.
- **Blue** (`blue-50`, `100`, `300`, `400`, `500`, `600`, `700`, `900/20`, `900/30`): about 45 uses. Notably the header's **active nav item** (`bg-blue-100 text-blue-700`, dark `bg-blue-900/30 text-blue-300`) and, since 2026-10-16, the active tab of the Explore front. This pair is the de facto "active state" colour.
- **Emerald** (`emerald-400/500/600`): about 9 uses, always for **valid / success** (checked airport inputs, "Success" alert).
- **Red** (`red-50`, `300`, `400`, `600`): about 10 uses, errors and destructive hints, next to the `destructive` token.
- **Amber** (`amber-400`, `600`): 2 uses, warnings.

### Other
- Link-preview image (`opengraph-image.tsx`): its own dark palette (#0e0e10 background, #17171a panel, #f5f5f7 ink, #8e8e93 muted, #3b82f6 accent).
- Maps: dark tiles are filtered (`.dark-map-tiles`).

## 4. Typography

| Role | Font | Tailwind |
|---|---|---|
| Text | Geist Sans | `font-sans` |
| Headlines | Funnel Display (self-hosted) | `font-display` |
| Codes, numbers, captions | IBM Plex Mono | `font-mono` |

`.studio-label`: 11px mono, uppercase, wide tracking, muted. Used for field and section labels.

## 5. Components (`components/ui`)

alert, avatar, badge, button, card, checkbox, dialog, dropdown-menu, input, label, separator, switch, table, toast, tooltip.

- **Button variants:** `default` (primary fill), `destructive`, `outline`, `secondary`, `ghost`, `link`. Sizes: `default`, `sm`, `lg`, `icon`.
- **Badge variants:** `default` (primary at 15% with primary text), `secondary`, `outline`.

## 6. Observations (not changed, for your decision)

1. There are effectively **three blues** in use for "active/selected": the `primary` token, the header's `blue-100/blue-700` pair, and raw `blue-600/400` for progress.
2. Hard-coded greys (`gray-*`) bypass the theme tokens, so they do not follow the theme switch.
3. Admin lacks its own `destructive` value, unlike Studio.
4. Green is no longer part of the brand: only `emerald` remains, for validation states.
