# Worklog

A chronological narrative of how **Infinite Conflict — Turn-Based Strategy Simulator** evolved. Reconstructed from git history (commits `6c330af` → `8352096`) and merged PRs ([#1](https://github.com/HalfBakedFullyNuts/Florent/pull/1)–[#5](https://github.com/HalfBakedFullyNuts/Florent/pull/5)) on the [HalfBakedFullyNuts/Florent](https://github.com/HalfBakedFullyNuts/Florent) repo.

For per-version bullet points, see [`CHANGELOG.md`](CHANGELOG.md).
For architectural rationale, see [`Architecture/ARCHITECTURAL_DECISIONS.md`](Architecture/ARCHITECTURAL_DECISIONS.md).

---

## May 2026 — Global research and colony-start controls

**2026-05-05 — v0.2.23: Shared build lane board.**
The read-only shared-build landing view now lays Structures, Ships, Colonists, and Research out as four side-by-side lane columns on desktop, while falling back to two columns on tablets and one column on phones. Lane rows were compacted so turn windows, quantities, and durations remain easy to scan in the narrower columns.

**2026-05-05 — v0.2.22: Multi-planet exports and wait sharing.**
Exports now have a Selected planet vs All planets target so text, Discord, image, and game JSON can carry a whole multi-planet plan. The game JSON format has a v2 shape with planet-local build items grouped by planet and global research emitted once. Manual waits are now exported with duration, recorded into share links, replayed on open, and reorderable like other manual plan entries; auto-waits remain generated schedule artifacts.

**2026-05-05 — v0.2.21: Read-only shared build landing.**
Shared build links now open into a focused build-list preview instead of dropping recipients directly into the full planner. The preview shows all four lanes together, supports switching planets in multi-planet shares, and keeps the editor hidden until the recipient chooses `Edit BL`.

**2026-05-05 — v0.2.20: Queue-turn export semantics merged from main.**
The latest main export fix is integrated into this branch: text, Discord, image, and game JSON exports now use the queue/start turn players need to act on, not the later completion turn. Current-view exports also filter by queue/start turn so the export scope matches what someone can actually queue by the selected turn.

**2026-05-05 — v0.2.19: Shared mobile landing and game JSON export.**
Shared links now land mobile users on the Queue panel first, so recipients see the build list instead of the editing catalog. The export vault gained a game-facing JSON option that contains only build-list data: item ids, display names, lanes, turns, and quantities, with no Florent encoded state, save metadata, author fields, or local cache details. Plain `#state=` autosave/reload URLs without share metadata are also treated as local restores so they no longer pollute the Shared list.

**2026-05-05 — v0.2.18: Shared content rail alignment.**
The page now uses one consistent centered 1800px rail for its major strips and cards. Gutters live outside the rail, so the build-list selector, share metadata strip, planet tabs, shared-list banner, dashboard, timeline, and queue panels all start and end on the same desktop columns while keeping mobile padding intact.

**2026-05-04 — v0.2.17: Planet tab rail alignment.**
The Homeworld/Add Planet/Reset Queue strip now sits inside the same centered desktop content rail as the build-list selector, shared-list banner, dashboard, timeline, and queue panels. This keeps the desktop layout from feeling edge-to-edge while preserving the mobile two-column tab grid.

**2026-05-04 — v0.2.16: Desktop dashboard table repair.**
The mobile dashboard alignment pass now has explicit desktop breakpoints for the Buildings table. Phones keep the compact proportional columns that prevent Energy values from clipping, while desktop restores the roomier fixed-width table behavior so building names and resource columns do not get squeezed inside the four-card overview.

**2026-05-04 — v0.2.15: Mobile alignment pass.**
Mobile layout now uses explicit grids where free-wrapping flex rows had made controls drift out of alignment. Planet tabs keep Homeworld/Add Planet in a two-column rhythm and give Reset Queue its own full row, while timeline quick jumps split Start/Mid/End and lane-empty shortcuts into separate aligned rows. The planet dashboard now shares the same mobile gutters as the rest of the page, and the Buildings table uses proportional columns so energy values are not clipped on narrow screens.

**2026-05-04 — v0.2.14: Unified popup visual system.**
The remaining popup surfaces were updated to match the new save/build-list visual language. Export Build Queue now has a glass/vault shell, scope badges, icon-led export actions, and polished Discord/image fallback states. Add/Edit Planet, the nested Planet Import popup, auto-wait confirmation, and dependency warnings now use the same rounded modal shell, icon badge headers, themed scroll areas, and intent-colored actions. The UI spec was updated so future popup work follows this shared pattern instead of drifting back into one-off modal styles.

**2026-05-04 — v0.2.13: Save vault polish and restore intent hardening.**
The Saves modal was brought in line with the newer queue/build-list visual language: glassy vault panel, cyan selected tabs, themed scroll areas, and unambiguous intent colors for opening, saving, exporting, and deletion. The save/restore flow now carries explicit owned-vs-shared intent through the reload handoff, preventing named saves and owned imports from being cached as shared lists. "Save as mine" now removes shared metadata from both the display summary and the encoded payload, so copied shared lists stay genuinely owned when exported, re-imported, or opened later. Pasted raw state fragments now use a neutral imported-build label, and file-read failures surface in the modal instead of failing quietly.

**2026-05-04 — v0.2.12: Branch integration, sharing polish, and action clarity.**
The branch now carries the latest `main` global-research fixes while keeping the PWA/share/save-cache work intact. Share/export flows were tightened with binary URLs, Discord chunking, research-inclusive exports, clipboard image export, and safer debug/reset handling. The build-list selector and queue panels were polished with persistent controls, clearer stacking, themed scrollbars, cyan lane-tab selection, and distinct icon/color treatments for share, saves, current export, and full-list export actions. Legacy localStorage migration now avoids noisy failures when IndexedDB or usable localStorage is absent, and Vitest binds jsdom storage explicitly so Node 25 no longer emits `--localstorage-file` warnings in page tests. Follow-up PR review fixes allow scheduled global research to unlock future local queue planning without starting early, revalidate those local gates when global research is canceled or reordered, recompute imported save-file metadata from the encoded payload, keep share-link copying working without the Clipboard API, prevent local dev hosts from registering stale PWA service workers, keep global RP accruing while front-of-queue research is blocked by unmet prerequisites, and cancel pending autosaves before restoring a selected save so the old build cannot overwrite the target hash. The latest sharing pass moved list name/author editing onto the page instead of prompt popups, made pasted shared URLs importable from the Saves modal, canonicalized share links to the app root for incognito/fresh-tab opens, made exports more forgiving with clipboard fallbacks, current-turn-to-full-queue fallback, chunk progress, and optional image download fallback instead of forced downloads, and hardened the service worker so local dev unregisters stale workers and 404 pages cannot replace the cached app shell.

**2026-05-04 — v0.2.11: Shared opened timestamps.**
Shared build lists now display their opened date and time in selector/modal labels and are rendered newest-first so same-name shares remain distinguishable.

**2026-05-04 — v0.2.10: Local build visibility.**
The Build List selector now treats recent non-shared auto-saves as your local builds, refreshes when saves change, and lets those local entries be deleted from the selector.

**2026-05-04 — v0.2.9: Clean dev startup.**
The dev script now clears stale Next compiler output before launching, preventing missing server chunk errors after static export builds or branch changes.

**2026-05-04 — v0.2.8: Build-list selector.**
The main page now has a local build-list selector that separates your named saves from shared lists cached after opening links, with load/delete controls for both categories.

**2026-05-04 — v0.2.7: Shared-list identity.**
Share links now carry list name and author metadata, opened shared links show a clear shared-list banner, and the Saves modal keeps other players' lists in a separate Shared tab.

**2026-05-04 — v0.2.6: PWA-safe share links.**
Share links are now encoded at click time instead of waiting for debounced auto-save, and already-open PWA windows react to incoming `#state=...` links so another player's build list loads reliably.

**2026-05-04 — v0.2.5: Global research edge-case hardening.**
Planet-limit unlock lookup now avoids brute-force turn scans, and research drag/reorder rejects dependency-inverting moves so invalid queues cannot stall the planner.

**2026-05-04 — v0.2.3: Stable global research timing projections.**
Research lane display now runs the global research planner far enough to compute actual RP-gated start and completion turns, including long waits beyond the visible 200-turn simulator, so clicking a completion turn no longer changes the displayed schedule.

**2026-05-04 — v0.2.2: Reset Queue clears added planets.**
The Reset Queue button now returns planning to Homeworld only, removing added planet tabs and resetting the home queue while preserving the command-replay semantics through a dedicated reset-all command.

**2026-05-04 — v0.2.1: Global research + configurable added planets.**
Research points moved from planet-local stock to global session state, while scientists and unique research labs remain planet-local. PL research now acts as the true global planet-limit gate, the research lane renders consistently regardless of active planet, and added planets can be configured with starting population plus starting metal mines, mineral extractors, farms, and solar generators.

**2026-05-04 — Queue chronology regression fix.**
Normal planet queues once again render from the simulated future snapshot so local prerequisite stalls display correctly. Lane views keep chronological ordering internally, while the UI still shows latest/future entries first.

---

## October 2025 — Bootstrap and architecture

**2025-10-09 — Initial commit (`6c330af`).**
Repo reset and bootstrapped as `infinite-conflict-planner`. Next.js 14 + TypeScript + Tailwind scaffold, with `game_data.json` as the seed content source.

**2025-10-11 — Page hardening + first ADRs ([PR #1](https://github.com/HalfBakedFullyNuts/Florent/pull/1)).**
TypeScript / parsing fixes on the main page, conversion to a client component, and debug logging added. The architecture overview, ADR tracker, and LLM/developer guidelines landed (`4602406`). A "snapshot" reinit (`655bd77`) preserved a backup before merging in remote changes (`94df003`).

**2025-10-25 — Engine planning + game-data freeze (`33128b8`).**
A flurry of ADRs codify the foundational rules:
- Parallel `src/lib/sim/` directory alongside legacy `src/lib/game/`.
- `Map<turn, WorkItem[]>` completion buffers.
- Adapter pattern over `game_data.json` (no rewrite).
- **Three-lane architecture** (Building → Ship → Colonist) with strict execution order.
- **Queue-time vs activation-time** validation split: static checks at queue, dynamic clamping at activation.
- Framework-free engine, accessed only via the orchestration layer.
- Worker occupation values are literal; colonist training reserves multiple workers.

**2025-10-26 — Foundational refactor + queue/UI bundle ([PR #2](https://github.com/HalfBakedFullyNuts/Florent/pull/2), [PR #3](https://github.com/HalfBakedFullyNuts/Florent/pull/3)).**
- Second-pass refactor to "eliminate foundational problems" (`34740e6`).
- Eight tickets bundled: queue improvements + UI polish (`33ea1b3`).
- Removed idle-lane warnings (`854b73a`).
- Filtered ships/colonists by prerequisite requirements so the user only sees what they can plan toward (`6456714`).
- ADRs codify: completion-history persistence with muted styling, turn tracking on `WorkItem` lifecycle, **same-turn building completion** (ships still next-turn via buffer), continuous timeline display, and auto-advance to last-building completion.

**2025-10-27 → 30 — UI redesigns + batch queueing ([PR #4](https://github.com/HalfBakedFullyNuts/Florent/pull/4)).**
- UI / queue redesign (`27ed433`).
- Improved UI + turn-logic bug fixes (`b670809`).
- Batch queueing implemented (`66941e5`).
- Larger UI redesign and planet-queue styling pass (`100ae1c`, `69e20ea`).

---

## November 2025 — Timeline, research, multi-planet, deploy

**2025-11-06 → 11-08 — Fixed 200-turn timeline architecture (TICKET-1).**
The timeline becomes a fixed 200-turn array (`2b16cd6`). The follow-up commit (`7928968`) drives the test suite from 26 failures to 0 and fixes a critical Timeline bug along the way. Ship prerequisites and mock data fixed (`8b13677`).

**2025-11-11 — Research system (TICKET-7).**
Three commits in a single day:
- Vertical turn slider (`b492ce0`).
- **Research Points and Research Lane** (`d4c5a21`).
- Hotfix: undefined `researchLane` initialization (`60c47fc`).

The research lane joins building/ship/colonist as the fourth production lane.

**2025-11-11 — Export system (`9953dc0`).**
Export with abbreviations and image capture lands.

**2025-11-18 — UI polish + multi-planet ticket prep (`f335567`).**
Color-coded resource costs throughout.

**2025-11-24 — Wait items + auto-wait (`eea6b1e`).**
Explicit wait nodes can now be inserted into queues, and the engine auto-injects them when prereqs aren't yet built. This is the visible-gap UX that makes implicit waiting periods legible.

**2025-11-25 — Multi-planet support merged (`bf8f227`).**
Tabs across planets; URL-driven syncing; per-planet `GameController` instances.

**2025-11-26 — UI quality pass.**
- Replaced `html2canvas` with a native canvas-based image export (`47619ff`).
- Resource colors, full numbers, energy upkeep in queue display (`3b4132d`).
- Codebase cleanup (`54033a5`).

**2025-11-28 → 29 — StaticHost.eu deployment.**
Six commits to wire the static-export pipeline:
- Static export enabled in `next.config.js` (`a1b2d5f`).
- Hosting docs added (`533304a`).
- `statichost.yml` path + `npm ci` fix (`c2f879b`).
- Build artifacts committed under `out/` (`2004cdb`).
- File renamed `.yml` → `.yaml` to match docs (`96e8de4`); structure flattened (`aed25d9`).
- Final config tweaks (`56ea4d3`).

---

## January–March 2026 — Engine refactor

**2026-01-21 — Major simulation engine refactor + Docker (`3de6b07`).**
A large engine refactor consolidates work from late 2025. Docker setup added (`docker-compose.yml`, `Dockerfile`, `Dockerfile.dev`).

**2026-03-02 — ADR cluster (no commits, retroactive documentation).**
Several major decisions are documented on this date in `ARCHITECTURAL_DECISIONS.md`:
- **`GameStateContext`** replaces deep prop drilling.
- Legacy queue wrappers (`enqueueUnit`, `cancelQueueItemLegacy`, etc.) removed in favor of `GameController`.
- `viewTurn` decoupled from queue mutation — actions always operate on Turn 1; the slider is a viewer.
- `repackQueue()` replays intent to collapse timeline gaps and inject `isAutoWait` nodes.
- `getDependentQueueItems` clones state and re-runs validation to detect cascading prerequisite failures (the `DependencyWarningModal`).
- Stable-state caching (`isStableState`) fast-forwards turns where production, queues, and worker growth are exactly zero.

**2026-03-21 — Auto-collapsing queue items (`c8d2897`).**
Queue items auto-collapse and architecture optimizations.

---

## April 2026 — Validation hardening and the activation-time pivot

**2026-04-13 — Hydration mismatch in `PlanetTabs` (`153b95c`).**

**2026-04-27 — Hydration + queue cancellation bugs (`08ecc58`).**

**2026-04-28 — UX cluster.**
- npm dependency update (`31ebe2f`).
- Decoupled queueing from view turn; auto-advance off-by-one fix; queue UI styling cleanup (`d1179c3`).
- localStorage auto-save and "Copy Debug State" button; another React hydration fix (`3d73be7`).

**2026-04-29 — Auto-jump turn slider (`de0bbd7`).**
The slider now jumps to the turn the last queued building completes. Research Points are now validated when queuing research items. Another hydration fix in `PlanetTabs`.

**2026-04-30 — Activation-time pricing pivot ([PR #5](https://github.com/HalfBakedFullyNuts/Florent/pull/5)).**
Two commits, same day:
1. **`08ebcdd`** — first attempt: refactor resource deduction to **queue time**, with comprehensive refund logic and NaN guards in state calculations.
2. **`129d870`** — pivot: **activation-time resource deduction** with comprehensive queue validation.

The activation-time model is the one that sticks. The unified `canQueue` gate accepts any item whose costs are reachable via current stocks plus net production, rejecting only when prereqs are missing, the planet limit is hit, energy projection turns negative, or a required resource has non-positive net production. Auto-wait items are injected into a queued item's lane when its prereq is queued but unbuilt.

Same day, `f96b916`: auto-wait injection now computes wait turns from natural activation time, not `T1` (an off-by-one in time, not in count).

---

## May 2026 — Polish, bug pass, version footer

**2026-05-02 — Four queue bugs in one pass (`df31804`, merge `d5805e8`).**
- Research uniqueness — same research can no longer be queued twice.
- Re-add after remove — items can be re-queued cleanly.
- Reset button restored.
- Cascade direction — dependency cancellation cascades downstream, not upstream.

**2026-05-02 — Separate orbital space tracking (`bd50f33`).**
The 10 orbital structures now track against an orbital-space pool distinct from ground space.

**2026-05-03 — v0.1.1 (`a290ed3`).**
First versioned commit. Queue activation fixes, compact URL encoding, version footer.

**2026-05-03 — v0.1.2: Cost deduction at construction start (`8352096`).**
Closes the activation-time loop: resource (and RP) costs are now deducted exactly when an item moves from pending → active, in lockstep with worker and space reservation.

**2026-05-03 — v0.1.3: Documentation pass.**
- New `README.md` (the previous file was corrupted with broken character encoding — every character spaced out as if UTF-16 → UTF-8 had gone wrong).
- New `CHANGELOG.md` capturing the version history.
- New `WORKLOG.md` (this file).
- Version footer + `package.json` bumped 0.1.2 → 0.1.3.

---

## Recurring themes across the timeline

- **Hydration errors**: surfaced repeatedly (`08ecc58`, `153b95c`, `3d73be7`, `de0bbd7`) — Next.js SSR vs client-state mismatch is the most common bug class in this app.
- **The cost-deduction question**: oscillated between queue time, activation time, and "construction start" before settling on activation time as the single, unified policy in late April / early May 2026.
- **Auto-wait**: an aesthetic decision that ended up reshaping the engine — the visible-gap node forced clear semantics for `repackQueue()`, prerequisite-driven scheduling, and dependent cascading.
- **Test discipline**: TDD ratchet visible in `7928968` (26 → 0 failures) and the ADR-mandated ≥90% coverage gate for engine code.

## Open threads

- Migration from `src/lib/game/` (legacy) to `src/lib/sim/` (new engine) is **active, not complete**. Both directories coexist.
- `Architecture/OPEN_ISSUES.md` and `tickets/BUG-shipyard-costs-one-turn-late.md` are the live tracker for in-flight work.
- ADRs are the authoritative log of architectural decisions; dated bug analyses live in `claudedocs/`.
