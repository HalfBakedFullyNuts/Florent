# Changelog

All notable changes to **Infinite Conflict — Turn-Based Strategy Simulator** are documented here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows semantic-style patch bumping (every delivered change bumps the patch by 0.0.1, per project policy).

---

## [0.2.18] — 2026-05-05

### Changed
- Page sections now share the same centered 1800px content rail, with horizontal gutters applied outside the rail instead of shrinking individual cards.
- Dashboard, timeline, queue panels, unavailable-state cards, warnings, and error strips now align with the build-list selector, share metadata strip, planet tabs, and shared-list banner.

### Tests
- Re-verified PlanetDashboard, build-list selector, Saves modal, Export modal, restore handoff tests, and lint.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.18`.

---

## [0.2.17] — 2026-05-04

### Fixed
- Desktop planet tab bars now align to the same centered 1800px content rail as the build selector, shared-list banner, dashboard, timeline, and queue panels.

### Tests
- Re-verified PlanetDashboard, build-list selector, Saves modal, Export modal, restore handoff tests, and lint.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.17`.

---

## [0.2.16] — 2026-05-04

### Fixed
- Desktop dashboard Buildings tables now restore roomier fixed column sizing at medium-and-up breakpoints while keeping the compact proportional mobile layout.
- Long building names no longer inherit the mobile wrapping pressure on desktop, keeping the four-card dashboard readable again.

### Tests
- Re-verified PlanetDashboard, build-list selector, Saves modal, Export modal, restore handoff tests, and lint.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.16`.

---

## [0.2.15] — 2026-05-04

### Fixed
- Mobile planet tabs now align in a predictable two-column grid, with Reset Queue spanning its own row instead of floating to the right after wrapping.
- Mobile timeline quick-jump controls now split into clean full-width rows for Start/Mid/End and lane-empty shortcuts.
- Mobile dashboard gutters now match the rest of the page, and the Buildings table uses proportional columns so the right-edge Energy values are not clipped.

### Changed
- UI guidelines now call out explicit mobile grids for mixed-intent controls and proportional mobile dashboard tables.

### Tests
- Re-verified PlanetDashboard, build-list selector, Saves modal, Export modal, restore handoff tests, and lint.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.15`.

---

## [0.2.14] — 2026-05-04

### Changed
- Export Build Queue now uses the polished glass/vault modal style with clearer scope badges, icon-led export options, and modern fallback/notification states.
- Add/Edit Planet, Planet Import, auto-wait confirmation, and dependency-warning popups now share the same modal shell, header rhythm, focus styling, and intent-colored actions as the Saves modal.
- UI guidelines now define the shared modal surface pattern for export, planet configuration, import, confirmation, and warning popups.

### Tests
- Re-verified Export modal, Saves modal, build-list selector, restore handoff tests, and lint.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.14`.

---

## [0.2.13] — 2026-05-04

### Changed
- Saves modal now uses the same polished glass/vault treatment as the new build-list selector, with clearer tab styling, themed scroll areas, and distinct action colors for load, save, export, and delete.
- Imported raw state fragments without share metadata now default to "Imported build list" instead of implying they are shared links.

### Fixed
- Restoring named saves, recent local builds, and imported owned lists now carries an explicit owned/shared restore intent through the reload handoff, so owned lists are not cached back as shared lists.
- "Save as mine" now strips shared identity from both the saved summary and the encoded payload, preventing exported or re-imported copies from resurrecting the original shared author/name.
- Owned save exports defensively strip stale embedded share metadata from older saved payloads.
- File import now reports read errors instead of silently leaving the import box empty.

### Tests
- Added Saves modal coverage for owned restore, shared restore, pasted shared-link restore, and shared-to-owned metadata stripping.
- Re-verified restore handoff, build-list selector, save-file parsing, Saves modal tests, and lint.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.13`.

---

## [0.2.12] — 2026-05-04

### Added
- Binary share-link encoding shortens exported URLs while preserving backwards compatibility with existing encoded build links.
- Build-list selector and queue panels received clearer visual hierarchy, themed scrollbars, and persistent action controls.
- Queue action buttons now use distinct intent colors and icons: Copy Share Link, Open Saves, Export Current, and Export Full List.
- Shared list name and author fields now live directly on the page, so copying a share link no longer interrupts the flow with prompts.
- Save import now accepts pasted shared URLs, `#state=...` fragments, raw encoded payloads, and `.florent.json` files.

### Changed
- Active lane tabs now use a cyan/sky selected treatment with lane icons, separating navigation state from action buttons.
- Ported the latest `main` global-research review fixes into this branch without removing PWA/share/cache work.
- Updated UI design documentation to codify the new lane-tab and queue-action button guidelines.

### Fixed
- Legacy localStorage-to-IndexedDB migration now exits safely when IndexedDB or usable localStorage is unavailable, removing noisy test/dev warnings.
- Vitest now binds jsdom's browser storage under Node 25 so page tests no longer emit `--localstorage-file` warnings.
- Local queue planning now accepts items gated by scheduled global research and holds them until the research completion turn.
- Local queue research gates now revalidate after global research cancel/reorder changes, preventing stale scheduled unlocks from activating.
- Imported save files now recompute display metadata from the encoded payload instead of trusting stale or edited JSON metadata.
- Build-list dropdown stacking now stays above planet rows and dashboard content.
- Planet-limit research planning uses completion milestones and avoids brute-force turn scans.
- Research reordering rejects dependency-inverting moves.
- Debug/share/export flows include current research lane state and chunk Discord output for non-Nitro message limits.
- Export copy now falls back to a textarea clipboard path when the Clipboard API is blocked, and current-turn export falls back to the full queue instead of appearing empty before the first completion.
- Image export no longer forces a download when clipboard image copy is blocked; it keeps download as an explicit fallback action.
- Share links now canonicalize to the app root URL, avoiding bad static-export routes when opened in a fresh/incognito tab.
- Share-link copying now uses the safe clipboard fallback path in restricted or older browser contexts.
- PWA service-worker registration now skips and cleans up local dev hosts including `localhost`, `127.0.0.1`, and IPv6 loopback.
- PWA service worker now unregisters itself on local dev hosts and refuses to cache 404 responses as the app shell, preventing stale localhost share links from opening the not-found page.
- Blocked front-of-queue global research now stalls research activation without freezing global RP accrual.
- Restoring a selected save now cancels any pending autosave first, preventing the previous build from overwriting the selected restore hash before reload.

### Tests
- Verified full Vitest suite, lint, production build, and localhost smoke checks during this patch sequence.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.12`.

---

## [0.2.11] — 2026-05-04

### Fixed
- Cached shared build lists now show an explicit opened date - time timestamp in the Build List selector and Shared saves tab.
- Shared build lists are defensively sorted newest-first by opened timestamp before rendering.

### Tests
- Added selector coverage for newest-first shared-list ordering and timestamped shared labels.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.11`.

---

## [0.2.10] — 2026-05-04

### Fixed
- Build List selector now includes recent non-shared auto-saves under "Your lists", so local builds are visible even before they have been named.
- Selector refreshes when saves, shared cache entries, or history entries change elsewhere in the app.

### Added
- Recent local builds can be deleted from the selector, alongside named saves and cached shared lists.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.10`.

---

## [0.2.9] — 2026-05-04

### Fixed
- Dev startup now clears the stale `.next` compiler cache before launching, avoiding server errors where Next tries to load missing chunks after a static export build or branch switch.
- The clean script now removes both `out` and `.next` so local rebuilds start from a consistent cache state.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.9`.

---

## [0.2.8] — 2026-05-04

### Added
- Main-page Build List selector for loading local named saves and shared lists cached from opened share links.
- Selector clearly separates "Your lists" from "Shared lists cached on this device" and notes that shared lists are local cache only.
- Delete action in the selector removes either owned saves or cached shared lists from this device.

### Tests
- Added component coverage for owned/shared list display, shared-list load, and owned-list delete.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.8`.

---

## [0.2.7] — 2026-05-04

### Added
- Share links can now carry a build-list name and author, entered when copying a share link.
- Opened shared links now display a "Shared list" banner with the list name and author.
- Saves now include a separate Shared tab for build lists opened from other players, keeping them distinct from the user's named saves.

### Changed
- Share metadata is preserved in URL/local snapshots while editing an opened shared list.
- IndexedDB schema upgraded to v2 with a dedicated `shared` store.

### Tests
- Added coverage for share metadata round-tripping, shared-link loading UI, and save-summary extraction.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.7`.

---

## [0.2.6] — 2026-05-04

### Fixed
- Share Link now encodes and persists the current plan at click time, so copied build links no longer depend on the debounced auto-save hash being up to date.
- Already-open PWA sessions now import a new `#state=...` link on hash change, covering installed-app link opens that reuse the current window instead of remounting the app.
- Auto-save now updates the share hash with `history.replaceState`, avoiding self-triggered hash imports and browser-history spam.

### Tests
- Added URL-state helper coverage and PWA-style share-link integration coverage.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.6`.

---

## [0.2.5] — 2026-05-04

### Fixed
- Planet-limit start-turn lookup now derives unlock turns from planned research completions instead of scanning up to 1,000,000 turns.
- Global research simulation now fails fast when an invalid front-of-queue prerequisite order cannot progress.
- Research reordering now rejects moves that put a research item before its prerequisites.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.5`.

---

## [0.2.4] — 2026-05-04

Port of the global research planning workflow from `main` onto the PWA/saves branch.

### Added
- Global research is now planned as a session-wide lane/resource, with RP stock, scientist output, research completions, and unlocks shared across all planets.
- Planet-limit research now gates additional planets by the actual unlock turn, including edit/add flows for future colonies.
- Added-planet setup supports custom starting population, starting economy structures, and a Duplicate Homeworld preset.

### Fixed
- Global research lane timing now simulates far enough to show actual RP-gated start/completion turns, including long waits beyond the visible 200-turn slider.
- Reset Queue now restores the session to Homeworld only while preserving the global research plan semantics from the imported workflow.
- Kept the branch's PWA, IndexedDB saves, save-history, and queue-restore fixes intact while adding global research command replay.

### Bumped
- `package.json`, `package-lock.json`, and `src/app/page.tsx` footer to `0.2.4`.

---

## [0.2.1] — 2026-05-04

Fixes for two regressions reported against v0.2.0's saves pass.

### Fixed
- **Auto-save history was always empty** ("No auto-save history yet" in the History tab even after queue changes). `pushHistory` in `savesDb.ts` was calling `store.add({ id: undefined, ... })` on the autoIncrement+keyPath history store. IndexedDB's spec rejects an explicit-undefined keyPath value with `DataError: Evaluating the object store's key path yielded a value that is not a valid key.` — for autoIncrement stores you must omit the field entirely. The error was swallowed by the call site's `.catch(console.warn)`, so the history just silently stayed empty. Fixed by stripping `id` from the value passed to `add()`.
- **Queue did not restore on refresh** even though the URL hash and localStorage held the right encoded payload. Two bugs stacked:
  1. `CommandHistory.loadFromSnapshot` in `urlState.ts` read v2 'q' commands with v1 indices: it used `cmd[3]` for itemCode (which is the qty in v2) and `cmd[4]` for qty (which is undefined in v2). Result: every queued item got rewritten as item code = qty. A queued Farm (item 11, qty 1) became `["q", 0, 1, 1]` (battleship) on reload, then failed the prereq check and silently dropped. Fixed by branching on `typeof cmd[3]` and reading the right indices for each format.
  2. The bootstrap `useEffect` in `page.tsx` called `replayCommands(createInitialGameState(), ...)` — a *fresh* game state with a *new* planet/timeline. The memoized `controller` (deps `[currentPlanetId]`) stayed bound to the *original* planet from `useState`'s initializer, never seeing the replayed mutations. Bootstrap now replays into the existing `gameState` so the controller's timeline gets mutated in place. Side-effects (`replayCommands`, `commandHistory.loadFromSnapshot`) are kept *outside* the `setGameState` updater — React StrictMode invokes updaters twice in dev to detect impurity, which had been queueing every command twice with duplicate deterministic IDs (`__s1` collision, console warning).
### Bumped
- `package.json` and `src/app/page.tsx` footer from `0.2.0` to `0.2.1`.

---

## [0.2.0] — 2026-05-03

A persistence + PWA pass — the app now installs to your home screen, works offline once visited, and remembers multiple plans across sessions.

### Added — Saves manager (IndexedDB)
- New **Saves** button in the Planet Queue header opens a modal with three tabs:
  - **Saves**: named, user-managed saves. Save current state, load, rename, delete, export-to-JSON.
  - **History**: the last 30 auto-saves (ring buffer). Lets you revert to any prior auto-save, not just the latest.
  - **Import**: upload a `.florent.json` file, or paste its JSON contents, then Load-now or Save-as-new-entry.
- Auto-save now writes to **both** the URL hash (unchanged, still shareable) and an IndexedDB `history` store. Identical-content snapshots are deduped so the history doesn't fill with no-ops.
- Storage layer at `src/lib/persistence/savesDb.ts` (uses [`idb`](https://www.npmjs.com/package/idb)) with two stores: `saves` (named) and `history` (auto-save ring buffer, capped at 30).
- One-time migration: existing single-slot `florent_save` localStorage values are seeded into the IndexedDB history on first load, then the migration flag is set so it doesn't run again.

### Added — JSON file export/import
- "Export" button on each save and on the Save-current panel writes a human-readable `.florent.json`:
  ```json
  { "format": 1, "name": "Tech rush", "exportedAt": "2026-…", "app": "florent",
    "metadata": { "planetCount": 1, "commandCount": 42, "planetNames": "Homeworld" },
    "encoded": "<v2 share-URL payload>" }
  ```
- Import reads the same shape, validates `app === "florent"`, and verifies the encoded payload decodes before letting you load it.
- Filenames are auto-generated as `<safe-name>_<YYYY-MM-DD-HH-mm>.florent.json`.

### Added — PWA shell
- `public/manifest.json` with name, theme colors, standalone display, icons in three sizes (192, 512, SVG) and `purpose: "maskable"` variants for Android shape-masking.
- Generated placeholder icons (SVG master + 16/32/180/192/512 PNGs) using the project's pink-nebula palette: radial gradient, "IC" monogram, subtle rounded ring. Master SVG and `scripts/generate-icons.js` (one-off Sharp-based renderer) both committed; rerun the script to regenerate.
- `public/sw.js` — hand-rolled service worker (~80 lines), registered from `layout.tsx` only on production hostnames so dev rebuilds don't trip its cache. Strategy:
  - HTML navigation: **network-first**, falls back to cached app shell when offline.
  - Same-origin static assets (`_next/`, `icons/`, `vendor/`, css/js/font/img): **cache-first with stale-while-revalidate** background refresh.
  - Cross-origin requests pass through.
- iOS Safari support: `apple-touch-icon` link, `apple-mobile-web-app-capable` meta, status-bar style `black-translucent`.

### Tests
- New `src/lib/persistence/__tests__/saveFile.test.ts` (7 tests): round-trip serialise/parse, rejection of non-JSON / non-Florent / un-decodable payloads, filename sanitisation, summary extraction. Full suite is now **400 passed / 1 skipped** (was 393).

### Bumped
- `package.json` and `src/app/page.tsx` footer from `0.1.9` to `0.2.0` (minor bump for the new feature surface).

---

## [0.1.9] — 2026-05-03

### Fixed
- **Drag handle / mobile arrow buttons disappeared once `viewTurn` advanced past queue items.** `canDrag` in `TabbedLaneDisplay.tsx` required `entry.status === 'pending' || 'active'`, but `getAdjustedLaneView` rewrites status to `'completed'` for any item whose finish turn is ≤ `viewTurn` — so previewing further into the timeline locked off reordering for everything you'd already passed. Cancel (✕) was always available regardless, so the restriction was inconsistent. Relaxed the check to `!disabled && !!onReorder && !isWaitItem`: any plan entry except auto-generated waits is now reorderable. Reordering past items is supported by the engine (`reorderQueueItem` re-runs the timeline from T1).

### Bumped
- `package.json` and `src/app/page.tsx` footer from `0.1.8` to `0.1.9`.

---

## [0.1.8] — 2026-05-03

### Fixed
- **`formatOutput` produced wrong European number format** in both `PlanetSummary.tsx` and `PlanetDashboard.tsx`: `1250.7` rendered as `+1,250.7` instead of `+1.250,7` because the thousands-separator regex inserted a `.` before the existing decimal `.`, then `replace('.', ',')` only swapped the first dot. Reworked to split on the decimal point first, then insert thousand separators only on the integer part. The two pre-existing test failures in `PlanetSummary.test.tsx` and `PlanetDashboard.test.tsx` now pass — full suite is **393 passed** (was 391/2).
- **`react-hooks/rules-of-hooks` follow-up**: cleaned up all 11 `exhaustive-deps` warnings in `page.tsx`, `TabbedItemGrid.tsx`, and `GameStateContext.tsx`. Two patterns:
  - **Real bugs fixed**: `executeCancellation` was missing `currentPlanet?.startTurn` and `isAutoJumpEnabled` (stale-closure risk on cancel-with-auto-jump); `tryQueue` was missing `getQty` and `humanizeReason` (now wrapped with `useCallback`); three callbacks (`confirmPendingCancellation`, `handleCancelItem`, `getMaxQuantity`) had unused `viewTurn` deps removed.
  - **Intentional cache-busting deps** (gameState in `currentState`/`fullPlanState`/`firstEmptyTurns`, currentPlanetId in controller useMemos): suppressed with `eslint-disable-next-line react-hooks/exhaustive-deps` and a comment explaining why — the controller mutates its internal timeline outside React's awareness, so we add `gameState` as a re-evaluation trigger.

### Removed
- **Dead code**: `findNextEmptyQueueTurn` in `src/app/page.tsx` (~50 lines). Defined but never called from anywhere except its own recursion.

### Changed
- `tsconfig.tsbuildinfo` is now gitignored and untracked. Was polluting `git status` on every `tsc` run.

### Bumped
- `package.json` and `src/app/page.tsx` footer from `0.1.7` to `0.1.8`.

---

## [0.1.7] — 2026-05-03

### Added — Mobile responsiveness pass

**Phase A — Make it usable on mobile**
- Main layout (`src/app/page.tsx`): "Add to Queue" and "Planet Queue" Cards stack vertically on `< md` (was hardcoded side-by-side, jamming both into ~163px each).
- `PlanetTabs`: tabs wrap to multiple lines on narrow widths instead of overflowing.
- `TabbedItemGrid` + `TabbedLaneDisplay`: tab headers wrap and become equal-width on mobile (`flex-1`); item-row card height scales to `60vh` on mobile.
- `TabbedItemGrid` item rows: switched from a 7-column fixed-width row (~620px min) to a two-row layout on mobile — name/duration/qty controls top, costs wrap below. Single-row table preserved on desktop via `md:contents` + `md:order-last`.
- `QueueLaneEntry`: tighter column gaps and smaller font on mobile.
- `HorizontalTimeline`: outer flex now wraps; slider gets its own row on mobile; auto-jump label has a shorter mobile copy; quick-jump and per-lane T1 buttons wrap.
- Action button row in Planet Queue header: `flex-wrap` with `flex-1` buttons that fill available width below the header on mobile.
- Header, planet tabs, warnings, timeline wrappers, main content: `px-3 md:px-6` (was `px-6` — wastes 48px of horizontal space on phones).

**Phase B — Make it look good**
- Mobile-only Build/Queue toggle bar (`src/app/page.tsx`): on `< md`, only one panel renders at a time so the user isn't scrolling through both stacked. Both render side-by-side on desktop.
- `AddPlanetModal`: three internal `grid-cols-2` blocks now `grid-cols-1 sm:grid-cols-2`. Action buttons stack on mobile with primary action on top via `order-1 sm:order-2`. Modal padding scales (`p-4 md:p-6`).
- Tap targets: primary action buttons use `min-h-[44px]` and `py-2.5` on mobile to meet the iOS 44×44pt guideline. Timeline step buttons enlarged to `w-11 h-11` on mobile.

**Phase C — Touch correctness**
- Replaced `alert()` for "link copied" with a transient toast (`fixed bottom-6 left-1/2`, auto-dismisses after 3s, `aria-live="polite"`).
- Touch-friendly reorder: added ▲▼ arrow buttons on mobile that call `onReorder` directly with `actualIndex ± 1`. Drag handle remains for desktop. Footer hint adapts ("Drag ⋮⋮" on desktop, "Tap ▲▼" on mobile). Avoids the iOS HTML5-drag flakiness without adding a touch backend.

### Changed
- Card heights: lane Cards use `h-[60vh] md:h-[600px]` so phones don't get a 600px-tall scroll region eating most of the viewport.

### Bumped
- `package.json` and `src/app/page.tsx` footer from `0.1.6` to `0.1.7`.

---

## [0.1.6] — 2026-05-03

### Fixed
- **`react-hooks/rules-of-hooks` violations in `src/app/page.tsx`**: 14 `useCallback` declarations (`handlePlanetSwitch`, `handleAddPlanet`, `handleCreatePlanet`, `handleQueueItem`, `handleQueueWait`, `executeCancellation`, `confirmPendingCancellation`, `handleCancelItem`, `handleQuantityChange`, `handleReorder`, `getMaxQuantity`, `handleAdvanceTurn`, `handleResetQueue`, plus `enrichEntriesWithValidation`) were declared *after* the early-return guard, meaning React would call them in different orders depending on whether the guard tripped. All hooks are now declared before the guard. No behavior change — purely an ordering fix.

### Added
- ESLint configuration (`.eslintrc.json` extending `next/core-web-vitals`). `npm run lint` now actually runs; previously it prompted for setup and was unenforceable.
- Project pre-commit hook in `.claude/settings.json`: `PreToolUse` matcher on `Bash(git commit:*)` runs `npm run lint && npm run build` and blocks the commit (exit 2) on failure.
- `docs/CODE_QUALITY.md` — full TypeScript-adapted Power-of-10 ruleset.

### Changed
- AI agent configuration consolidated. `Architecture/agents.md` and `LLM_AND_DEV_GUIDELINES.md` merged into `CLAUDE.md` (302 → 123 lines, no rules lost). Power-of-10 ruleset moved to `docs/CODE_QUALITY.md`.
- Project-shared agent settings now live in committed `.claude/settings.json`; `.claude/settings.local.json` is gitignored as per-user. `.claude/worktrees/` also gitignored.
- `.claude/settings.local.json` permission allowlist pruned (~20 stale entries removed: bare file paths, Windows leftovers, foreign user paths).
- Role section in `CLAUDE.md` updated from a Shadowrun copy-paste to the actual Infinite Conflict context.

### Removed
- Stale milestone reports superseded by `CHANGELOG.md`/`WORKLOG.md`: `BUGFIX_SUMMARY.md`, `PROGRESS_SUMMARY.md`, `RESEARCH_PROGRESS.md`, and 5 `claudedocs/PHASE_*` files.
- Empty orphan worktree directory `.claude/worktrees/pedantic-vaughan-1124cd/`.

### Bumped
- `package.json` and `src/app/page.tsx` footer from `0.1.4` to `0.1.6` (no `0.1.5` was released).

---

## [0.1.4] — 2026-05-03

### Fixed
- Planet Queue turn-range overlap: items activated mid-turn via Phase 2b (the post-completion re-activation pass in `runTurn`) recorded `startTurn = currentTurn` even though their first `progressActive` decrement only occurred the next turn. Back-to-back builds now display correctly (e.g. `T1–T4` followed by `T5–T8`, not `T1–T4` followed by `T4–T8`). Cost deduction timing is unchanged. (`src/lib/sim/engine/lanes.ts`)

### Documentation
- README: replaced the dead `agent.test.ts` reference with the real `queue-integrity.test.ts`, and changed the example `-t "enqueueItem"` filter to `-t "queue"` (Codex catch).

### Changed
- Bumped version footer in `src/app/page.tsx` and `package.json` from `0.1.3` to `0.1.4`.

---

## [0.1.3] — 2026-05-03

### Added
- `README.md` rewrite (the previous file was corrupted with broken character encoding).
- `CHANGELOG.md` (this file) — version history derived from git.
- `WORKLOG.md` — chronological narrative of the project's evolution.

### Changed
- Bumped version footer in `src/app/page.tsx` and `package.json` from `0.1.2` to `0.1.3`.

---

## [0.1.2] — 2026-05-03

### Added
- Separate orbital space tracking for the 10 orbital structures, distinct from ground space (commit `bd50f33`).

### Changed
- **Cost is now deducted at construction start** (commit `8352096`) — completing the activation-time pricing model. Resource and RP costs join workers and space in being reserved when an item leaves the pending queue.

### Fixed
- Four queue bugs in one pass (commits `df31804`, `d5805e8`):
  - Research uniqueness — the same research can no longer be queued twice.
  - Re-add after remove — items can be re-queued after removal without state corruption.
  - Reset button — restored to working order.
  - Cascade direction — dependency cancellation now cascades downstream, not upstream.

---

## [0.1.1] — 2026-05-03

### Added
- Compact URL encoding for shareable plans.
- Version footer in the UI (commit `a290ed3`).

### Fixed
- Queue activation edge cases.

---

## [0.1.0] — pre-0.1.1 (no formal tag)

The pre-versioned development period. Major themes below, grouped by phase.

### Phase: Activation-time pricing & validation hardening (April 2026)

- **Activation-time resource deduction** with comprehensive queue validation (PR [#5](https://github.com/HalfBakedFullyNuts/Florent/pull/5), commit `129d870`).
- Auto-wait injection now computes wait turns from the natural activation time, not `T1` (commit `f96b916`).
- Earlier iteration: resource deduction at queue time with refund logic and NaN guards (commit `08ebcdd`) — superseded by activation-time model.
- localStorage auto-save and "Copy Debug State" button (commit `3d73be7`).
- React hydration error fixes (commits `3d73be7`, `08ecc58`, `153b95c`, `de0bbd7`).
- Auto-jump turn slider — jumps to the turn the last queued building completes (commit `de0bbd7`).
- Research Point validation when queuing research items (commit `de0bbd7`).
- Decoupled queueing from view turn; auto-advance off-by-one fix; queue UI styling cleanup (commit `d1179c3`).

### Phase: Engine refactor & Docker (Jan–Mar 2026)

- Major simulation engine refactor and Docker setup (commit `3de6b07`).
- Queue items auto-collapse and architecture optimizations (commit `c8d2897`).

### Phase: Multi-planet, research, exports, deploy (Nov 2025)

- StaticHost.eu hosting configured: static export, `statichost.yaml`, build artifacts (commits `a1b2d5f`, `533304a`, `c2f879b`, `2004cdb`, `96e8de4`, `aed25d9`, `56ea4d3`).
- Multi-planet support merged from `feature/multi-planet-support` (commit `bf8f227`).
- Wait items + enhanced queue with auto-wait (commit `eea6b1e`).
- Color-coded resource costs throughout the UI (commit `f335567`, refined in `3b4132d`).
- Energy upkeep visible in queue display; full numbers (no abbreviations) (commit `3b4132d`).
- Research Points and Research Lane (TICKET-7) (commit `d4c5a21`).
- Vertical turn slider (commit `b492ce0`).
- Export system with abbreviations and image capture (commit `9953dc0`).
- Replaced `html2canvas` with native canvas-based image export (commit `47619ff`).
- Fixed 200-turn timeline architecture (TICKET-1) (commit `2b16cd6`).
- Test-suite green: 26 → 0 failures, plus a critical Timeline bug fix (commit `7928968`).
- Codebase cleanup and consolidation (commit `54033a5`).

### Phase: Engine foundation & UI redesign (Oct 2025)

- Initial commit (`6c330af`, 2025-10-09) — repo reset and project bootstrap.
- Architecture overview, ADR tracker, LLM/dev guidelines (PR [#1](https://github.com/HalfBakedFullyNuts/Florent/pull/1), commit `4602406`).
- Game data and implementation planning for the turn-based simulator (commit `33128b8`).
- Second foundational refactor (commit `34740e6`).
- Queue system improvements + UI enhancements bundle (8 tickets) (PR [#2](https://github.com/HalfBakedFullyNuts/Florent/pull/2), commit `33ea1b3`).
- Removed idle-lane warnings (commit `854b73a`).
- Filter ships and colonists by prerequisite requirements (commit `6456714`).
- UI / queue redesigns and batch queueing (PR [#4](https://github.com/HalfBakedFullyNuts/Florent/pull/4), commits `27ed433`, `66941e5`, `b670809`, `100ae1c`, `69e20ea`).
- Page TypeScript / parsing fix; client-component conversion; debug logging (commit `36d2544`).

---

## Pull Requests of note

- [PR #5](https://github.com/HalfBakedFullyNuts/Florent/pull/5) — Activation-time resource deduction and comprehensive queue validation.
- [PR #4](https://github.com/HalfBakedFullyNuts/Florent/pull/4) — Architecture & ADR guidelines (third merge).
- [PR #3](https://github.com/HalfBakedFullyNuts/Florent/pull/3) — Architecture & ADR guidelines (second merge).
- [PR #2](https://github.com/HalfBakedFullyNuts/Florent/pull/2) — Architecture & ADR guidelines (first merge).
- [PR #1](https://github.com/HalfBakedFullyNuts/Florent/pull/1) — Initial architecture & ADR guidelines docs.

---

## Legend

- **Added** — new functionality.
- **Changed** — modifications to existing behavior.
- **Fixed** — bug fixes.
- **Removed** — features taken out (none yet recorded post-cleanup).
- **Deprecated** — features marked for removal (none currently).
- **Security** — security-related changes (none currently).
