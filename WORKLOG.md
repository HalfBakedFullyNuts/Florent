# Worklog

A chronological narrative of how **Infinite Conflict — Turn-Based Strategy Simulator** evolved. Reconstructed from git history (commits `6c330af` → `8352096`) and merged PRs ([#1](https://github.com/HalfBakedFullyNuts/Florent/pull/1)–[#5](https://github.com/HalfBakedFullyNuts/Florent/pull/5)) on the [HalfBakedFullyNuts/Florent](https://github.com/HalfBakedFullyNuts/Florent) repo.

For per-version bullet points, see [`CHANGELOG.md`](CHANGELOG.md).
For architectural rationale, see [`Architecture/ARCHITECTURAL_DECISIONS.md`](Architecture/ARCHITECTURAL_DECISIONS.md).

---

## May 2026 — Global research and colony-start controls

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
