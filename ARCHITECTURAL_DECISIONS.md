# Architectural Decision Records

One- to two-sentence entries, newest first, per CLAUDE.md.

## 2026-10-06 — "Emission" design system replaces glass/nebula styling
UI colour, type and component styling now come from one token set (CSS variables in `app/globals.css` exposed to Tailwind via `@theme`; `pink-nebula-*` kept as aliases) plus shared primitives (`.panel`, `.btn-*`, `.field`, `.seg`, `.chip`, `.data-table`, `.callout`, `ui/Modal`); fonts are self-hosted via `next/font` (Source Sans 3, Turret Road) instead of a runtime Google Fonts link. Raw Tailwind palette classes in components are replaced by tokens — see docs/UI_ASSESSMENT.md §6.

## 2026-10-06 — Tailwind CSS v4 with CSS-first config
`tailwind.config.js` is gone: theme tokens live in `@theme` and plugins in `@plugin` inside `src/app/globals.css`, built via `@tailwindcss/postcss`. Utilities now sit in real CSS cascade layers, so a utility always beats base/plugin styles regardless of specificity — state-dependent styling (e.g. a checked checkbox) must be expressed with variants like `checked:` rather than relying on plugin selectors.

## 2026-10-06 — Build runtime moved to Node 24 LTS
StaticHost (`statichost.yaml`) and Docker images now use Node 24 because Node 20 reached end-of-life on 2026-04-30; `@types/node` tracks Node 22, the lowest version still used for local development, so typed APIs exist on every runtime.

## 2026-10-06 — Next 16 + React 19, ESLint 9 flat config
Upgraded to Next 16 (Turbopack build, static export unchanged) and React 19; `next lint` is gone, so linting runs `eslint .` from `eslint.config.mjs` on ESLint 9 (ESLint 10 is blocked until eslint-plugin-react/jsx-a11y/import support it). `react-hooks/set-state-in-effect` is disabled because existing effects are valid without the React Compiler, and test files must now type-check because the Next 16 build checks them.

## 2026-08-22 — Static defs catalog hoisted out of PlanetState (`defsRegistry`)
`PlanetState` no longer embeds the item-definition catalog; engine/game code resolves defs via `sim/engine/defsRegistry.ts` (`setDefsCatalog`/`getDefs`/`registerDef`, bootstrapped once in `game/gameState.ts`). This removes ~31 KB of duplicated static data from every timeline snapshot and turns JSON cloning from the hot-path bottleneck into a non-issue.

## 2026-08-22 — Single merged data adapter
`sim/defs/adapter.client.ts` was deleted; `sim/defs/adapter.ts` is now the one converter (score_value + unique flags + research-unlock prerequisite injection), eliminating two drifting conversion pipelines.

## 2026-08-22 — Engine decoupled from orchestration layer
The engine no longer imports `game/`: demolish id primitives moved into `sim/engine/demolish.ts`, and lane events are reported through an injectable `sim/engine/telemetry.ts` hook that `game/logger.ts` registers at module load.

## 2026-08-22 — Work-item IDs are monotonic counters, not clock/random
`generateWorkItemId()` emits `wi_<seq>`; `GameController` seeds the counter past ids found in restored states so reloaded saves never collide. Replay determinism no longer depends on `preserveId` discipline to avoid wall-clock leakage.

## 2026-08-22 — Dependency warning analyses the view turn
Cancelling an item with dependents now runs `getDependentQueueItems` against the currently viewed turn's state (previously end-of-timeline, where everything is completed and dependents can never break) and renders `DependencyWarningModal`; `getDependentQueueItems` returns `{laneId, entry}` pairs.
