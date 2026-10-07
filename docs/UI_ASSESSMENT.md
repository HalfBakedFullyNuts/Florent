# UI/UX Assessment — v0.2.70 (2026-10-06)

Scope: every surface of the planner — header, build-list shelf, planet bar, dashboard, timeline,
Add to Queue, Planet Queue, shared-list view, the five modals, toast, easter-egg dialog — at
1600px and 390px, empty and with the "Newbie Build List" fixture loaded.

Severity: **P0** broken or misleading · **P1** slows planning or excludes users · **P2** visual noise.

## 1. Broken or misleading (P0)

| # | Surface | Finding |
|---|---------|---------|
| 1 | Mobile, empty plan | Page is 475px wide in a 390px viewport — the build-list button row overflows. |
| 2 | Mobile queue | Item names collapse to one letter ("C.", "F.", "M.") — the queue is unreadable on phones. |
| 3 | Buildings table | Header has 7 columns, body has 8 (demolish column has no `<th>`), so the sticky header overlaps icons and "E" sits over nothing. |
| 4 | Reset Queue | Tooltip says "current planet", action resets **all** planets, no confirmation, one click away from planet tabs. |
| 5 | Clear lane | Hidden inside the "34 items" catalog count pill; hover swaps the label; clears the queue with no confirmation. |
| 6 | Planet tab | "P1 T1" shows the planet's last-synced engine turn, not the turn you are viewing (reads "T1" while viewing T40). |
| 7 | Add to Queue | Orbital-space cost is never shown — the cost columns only know ground `space`. |
| 8 | Background | Star layers and the purple gradient in `layout.tsx` are fully covered by the page root's opaque background; Inter is configured but never loaded, so text falls back to system UI. |

## 2. Information design (P1)

- **Unlabelled numbers.** Item rows print `1.500 1.000 5.000 1 −10⚡ 4T` with no header; seven fixed cost columns are mostly empty dashes.
- **Inconsistent number formats.** Stocks use `67.800`, building outputs use raw `+2100`, caps use `100k`, outputs use `+133,2`.
- **Inconsistent resource colours.** RP is yellow in tables, purple in the docs; scientists share RP's yellow; ground space is a dull `amber-600`.
- **Cause after effect.** The dashboard (effect) sits above the turn slider (cause); scrolling to the queue loses both.
- **Duplicated controls.** Two identical Structures/Ships/Colonists/Research tab bars drive the same state.
- **Cryptic status strip.** `NOW B: S: C: R:` and emoji badges `🏗 T37 🚀 T1 👥 T9` need decoding; the research lane has no badge.
- **Misplaced actions.** Copy Share Link / Saves / Export act on the whole build list but live under "Planet Queue"; Load/Delete/Refresh compete with the title in the header.
- **Score** floats alone in yellow between panels with no label context.

## 3. Visual consistency (P2)

- ~760 raw Tailwind palette classes vs ~362 theme-token uses; ~25 arbitrary hex values, mostly in modals.
- Eight accent families on one screen: pink, cyan, emerald, sky, violet, amber, fuchsia, red.
- Three icon systems: emoji (lanes, badges, warnings), inline SVG (action buttons), lucide (modals).
- Radii 4 / 6 / 8 / 12 / 16 / 24px; gradients on buttons; glass blur on a busy nebula photo.
- Item and queue names set in monospace; numbers in proportional figures elsewhere.
- Modals use a newer, calmer language (eyebrow + title + close) than the main page.

## 4. Accessibility (P1)

- **Keyboard:** Structures/Research item rows are clickable `div`s — buildings cannot be queued without a mouse.
- **Focus:** 51 `outline-none` vs 3 `focus-visible` styles; most controls show no focus indicator.
- **Modals:** none close on Escape.
- **Contrast:** brand pink `#e91e63` as text is 3.9:1 on panels; input borders are 1.35:1.
- **Screen readers:** the mobile build-list block sits inside `aria-hidden` but stays focusable; emoji carry meaning without labels in several places.
- **Targets:** queue steppers 20px, demolish button 16px on desktop.

## 5. What works and stays

Deterministic data, the turn as the central axis, drag-to-queue, clickable turn ranges, quantity
shortcuts (`+ ++ +++ ∞`), wall-clock toggle, manual links, and the modal structure.

## 6. Redesign direction — "Emission"

Nebulae glow pink because of hydrogen-alpha emission; their teal fringes are oxygen-III. The
palette takes both lines from the subject instead of decorating with them:

| Token | Hex | Role |
|-------|-----|------|
| `void` | `#0E0A14` | Page ground |
| `dust` | `#18121F` | Panels |
| `veil` | `#221A2D` | Raised rows, inputs, table heads |
| `filament` | `#342843` | Hairlines |
| `ink` / `ink-2` / `ink-3` | `#EEE8F4` / `#B8AEC8` / `#9489A6` | Text tiers (all ≥ 4.5:1 on panels) |
| `h-alpha` | `#F2508C` | Brand, "now", primary action (dark text on it, 5.9:1) |
| `o-iii` | `#5FD4C4` | Selection and keyboard focus |

Resource hues are retuned to equal lightness so no column shouts: metal `#C9CDD6`, mineral `#FF7A6B`,
food `#7FD88F`, energy `#6DB3FF`, RP `#C59BFF`, workers `#FFAE5C`, soldiers `#FF8FA3`, scientists `#F4D35E`,
ground `#D9A86C`, orbital `#8FA2FF` (all ≥ 7:1 on `dust`).

Type: **Turret Road** (the game's own display face) for the wordmark and the turn readout only;
**Source Sans 3** (successor of the game's body face) for everything else, tabular figures for every number.
Fonts self-hosted through `next/font` — no runtime Google request.

Signature: the **turn deck** — a sticky bar whose slider is drawn as a four-line spectrum: one track
per lane, queued work drawn as emission bars, idle turns left dark, the H-alpha cursor crossing all four.
Idle gaps in a build order become visible at a glance.

Layout order follows cause → effect: app bar → planet bar → turn deck (sticky) → warnings → economy →
one lane switcher → catalog | queue.

## 7. Resolved in v0.2.71

| Finding | Resolution |
|---------|------------|
| §1.1, §1.2 mobile overflow and one-letter names | No horizontal scroll at 390px; queue rows wrap the turn range to a second line |
| §1.3 buildings header mismatch | Demolish column has a header; table scrolls sideways on phones instead of crushing names |
| §1.4 Reset label | Button reads "Reset plan"; tooltip says it removes every colony, queue and research |
| §1.5 hidden Clear lane | Explicit "Clear" button in the Planet Queue header, disabled when the lane is empty |
| §1.6 planet tab turn | Tab shows `P1 · Homeworld`; colonies show their start turn on hover |
| §1.7 orbital space | One "Space" column shows `GS` or `OS` per item |
| §1.8 dead layers, unloaded font | Removed; fonts self-hosted |
| §2 unlabelled numbers | Catalog has a sticky column header; only columns a lane uses are shown |
| §2 cause after effect | Sticky turn deck above the economy; one lane switcher for both panels |
| §2 cryptic strip | Deck lists each lane's item in progress and first free turn beside its spectrum track |
| §3 consistency | Zero raw palette classes left in components; one icon set (lucide) |
| §4 accessibility | Keyboard queuing, visible focus everywhere, Escape closes dialogs, AA contrast |

## 8. Decisions after review (v0.2.72)

1. Reset plan asks for confirmation — done.
2. Clear lane asks for confirmation — done.
3. The queue stays newest-first.
4. The exported PNG uses the Emission palette and Source Sans 3 — done.

Review feedback also applied: item names on hover over the turn-deck tracks; data text set at
14px semibold (readability on normal-DPI screens); warnings moved into the lane-switcher row so
they no longer shift the page; one variable font file instead of four static weights.
First load measured: production is ~0.1 s to interactive (old build ~0.2 s); the slow first load
seen locally is `npm run dev` wiping `.next` and compiling for ~3.7 s.
