# Florent UI & Design Documentation — "Emission" (v0.2.72)

Current-state reference for the planner UI. The assessment that led here, with contrast
measurements and open behaviour questions, is in `docs/UI_ASSESSMENT.md`.

---

## 1. Page layout

Order follows cause → effect: pick the turn, read the economy, then plan.

```
┌ App bar ──────────────────────────────────────────────────────────────────────┐
│ ◆ INFINITE CONFLICT SIMULATOR                 [Copy share link] [Saves] [Export] │
│ BUILD LIST [Choose a build list ▾] [Load] [Delete] [↻]   LIST NAME [ ] AUTHOR [ ] │
├ Planet bar ───────────────────────────────────────────────────────────────────┤
│ [P1 Homeworld][P2 …] [+ Add planet 1/4]                 SCORE 651,8 [Reset plan] │
├ Turn deck (sticky ≥ md) ──────────────────────────────────────────────────────┤
│ TURN ‹ [40] › of 200  Start Mid End                       ☑ Advance after queuing │
│ IN PROGRESS          1 ──── 50 ──── 100 ──── 150 ──── 200                  FREE  │
│ ▣ Mineral Extractor  ▬▬ ▬▬▬ ▬▬│▬▬ ▬▬▬▬ ▬▬▬                                 T41   │
│ ⛴ Idle                         │        ▬▬▬▬ ▬▬▬▬ ▬▬▬▬                      T1    │
│ 👥 Idle               ▬         │                                            T9    │
│ ⚗ PL 8               ▬▬▬▬▬▬▬▬▬│▬▬▬▬           (hover a bar: item + turns)  —     │
├ Economy: Resources | Population | Ships | Buildings ───────────────────────────┤
├ [Structures | Ships | Colonists | Research]  ⚠ Worker housing near capacity  +2 ┤
│ Add to Queue (catalog)                 │ Planet Queue (newest first, now line)   │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

- **Warnings** share the lane-switcher row: the most severe shows inline, "+N" opens the rest, so they never shift the page.
- **Phones (< 768px):** single column; a Build / Queue switch shows one panel; the turn deck is not sticky; catalog rows put costs on a labelled second line; queue rows put the turn range on a second line.
- **Max width:** 1800px, 16px gutters on phones, 24px from `md`.

## 2. Tokens

Defined once as CSS variables in `src/app/globals.css` and mirrored in `tailwind.config.js`
(`bg-dust`, `text-ink-2`, `border-filament`, …). Legacy `pink-nebula-*` classes are aliases.

| Token | Hex | Role |
|-------|-----|------|
| `void` | `#0E0A14` | Page ground, input wells |
| `dust` | `#18121F` | Panels |
| `veil` / `veil-hi` | `#221A2D` / `#2B2238` | Raised rows, hover, selected segment |
| `filament` | `#342843` | Hairlines, panel borders |
| `edge` | `#76688E` | Input borders (3.3:1, meets non-text contrast) |
| `ink` / `ink-2` / `ink-3` | `#EEE8F4` / `#B8AEC8` / `#9489A6` | Text tiers, all ≥ 4.5:1 |
| `halpha` (+ `-soft`, `-deep`) | `#F2508C` | Brand, the viewed turn, the one primary action |
| `oiii` | `#5FD4C4` | Selection and keyboard focus |
| `danger` / `caution` | `#FF7A7A` / `#F5B544` | Destructive actions, errors / delays, warnings |

Resource colours (`text-res-*`) share one lightness so no column dominates:
metal, mineral, food, energy, rp, workers, soldiers, scientists, ground, orbital.
Use `RESOURCE_META` in `src/components/ui/resources.ts` — never hardcode a resource colour.

**Accent rules**
- H-alpha appears at most once per surface as an action (`btn-primary`), plus the turn cursor, the "now" divider and the active queue row.
- O-III only marks what is selected or focused.
- Status is never colour alone: icons (lucide) and text accompany every warning or state.

## 3. Type

| Role | Face | Where |
|------|------|-------|
| Display | Turret Road 800, uppercase | The wordmark only |
| UI and data | Source Sans 3, 400–700 | Everything else |

Both are self-hosted at build time through `next/font` (no runtime Google request): one variable
Source Sans 3 file and a single Turret Road weight.
`body` sets `font-variant-numeric: tabular-nums`, so every number column aligns without monospace.

**Weight rule:** data (table cells, queue rows, catalog figures, counts) is 14px semibold; labels
and meta are 11–13px at 400–600 in `ink-2`/`ink-3`. Thin regular text at 13px read poorly on
normal-DPI screens.

**Number formats** (`src/components/ui/resources.ts`)
- `formatThousands` — whole numbers grouped with `.`: `30.123`
- `formatSigned` — per-turn deltas with `,` decimal: `+1.200,5`, `-50,2`
- `formatWithK` — capacities: `50k`
- `formatScore` — like `formatSigned` without the sign: `651,8`
- Turns read `T40` (a point in time) and durations read `4T` (a length).

## 4. Primitives

All in `globals.css` (`@layer components`) unless noted.

| Class / component | Use |
|-------------------|-----|
| `.panel`, `.panel-head`, `.panel-title` | Every card: 12px radius, one hairline, 48px head |
| `.well` | Recessed cell (summaries, code) |
| `.eyebrow` | 11px uppercase labels and table heads |
| `.btn` + `.btn-primary` / `-secondary` / `-ghost` / `-danger`, `.btn-sm`, `.btn-icon` | The only button styles: 36px / 28px tall, 8px / 6px radius |
| `.field`, `.field-sm` | Text and number inputs |
| `.seg` + `.seg-item[aria-pressed]` | Lane switcher, planet tabs, Build/Queue, modal tabs |
| `.chip` | Counts, badges, "Locked" |
| `.data-table` | Dashboard tables: right-aligned figures, quiet heads |
| `.callout` + `border-l-*` | Warnings, errors, shared-list banner |
| `ui/Modal.tsx` | Every dialog: backdrop, Escape, focus trap, focus return |
| `ConfirmDialog` + `.btn-destructive` | Destructive actions (Reset plan, Clear lane): Cancel first, confirm button names the result |
| `LaneTabs`, `ui/LaneIcon` | The lane switcher and its icons (Building2, Rocket, Users, FlaskConical) |

Icons are lucide-react only, 16px in buttons, `aria-hidden` next to a text label.
Spacing sits on a 4px grid; panels pad 16px; rows are 32–44px tall.

## 5. Accessibility contract

- Every interactive element is a real `button`, `a` or `input`; catalog rows that queue on click expose an inner "Queue {item}" button.
- Keyboard focus is always visible: a 2px O-III ring that `outline-none` classes cannot remove.
- Dialogs close on Escape and keep Tab inside until closed.
- `prefers-reduced-motion` disables all transitions and animation.
- Text tiers and resource colours meet WCAG AA on every surface they sit on.

## 6. Adding UI

1. Reach for a primitive above before writing utility soup; add a new primitive to `globals.css` if two places need it.
2. Use tokens, never raw Tailwind palette classes (`slate-*`, `cyan-*`, …) or hex.
3. Keep one primary action per surface.
4. Check 390px, 1024px and 1600px widths and a keyboard-only pass.
