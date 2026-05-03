# Changelog

All notable changes to **Infinite Conflict — Turn-Based Strategy Simulator** are documented here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows semantic-style patch bumping (every delivered change bumps the patch by 0.0.1, per project policy).

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
