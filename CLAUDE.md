# CLAUDE.md

Guidance for Claude Code and other AI agents working in this repository.

## Project Overview

**Infinite Conflict Turn-Based Strategy Simulator** — deterministic simulation engine for a 4X MMORPG strategy game. Currently migrating from a simple build planner to a full turn-based simulator.

**Status**: 🚧 Migration in progress — new engine in `src/lib/sim/` running in parallel with legacy code in `src/lib/game/`.

**Core principles**:
1. Deterministic simulation — same inputs always produce same outputs
2. Framework-free engine — pure TypeScript, no UI dependencies
3. Three-layer architecture — Engine → Orchestration → UI
4. TDD-first — tests drive implementation

## Development Commands

```bash
npm install                                              # Install
npm run dev                                              # Dev server at :3000
npm run build                                            # Production build
npm run test                                             # All tests (Vitest)
npm run lint                                             # ESLint
npm run test src/lib/game/__tests__/agent.test.ts        # Single file
npm run test -- --watch                                  # Watch mode
npm run test -- -t "enqueueItem"                         # Pattern match
```

## Architecture

**Engine** (`src/lib/sim/engine/`) — pure TS, no React/Next/DOM. Modules:
- `types.ts` — domain types (PlanetState, WorkItem, LaneState)
- `validation.ts` — queue guards, batch clamping
- `lanes.ts` — lane activation and progression
- `completions.ts` — completion timing and effects
- `outputs.ts` — production / consumption math
- `turn.ts` — deterministic turn sequencing

**Orchestration** (`src/lib/game/`) — Commands API, timeline/snapshots, selectors. React-free **except** `GameStateContext.tsx`.

**UI** (`src/components/`, `src/app/`) — Next.js 14 App Router. Client components must start with `"use client"`.

## Hard Rules for Agents

These rules override any default behavior. Violating them causes silent breakage.

### 1. Mutate state via `GameController` only
All UI mutations route through the `controller` from `useGameState()`. Legacy wrappers in `agent.ts` have been purged.
```tsx
const { gameState, controller, viewTurn } = useGameState();
controller.queueItem(viewTurn, itemId, quantity);
controller.cancelEntryByIdSmart(viewTurn, laneId, entryId);
controller.reorderQueueItem(viewTurn, laneId, entryId, newIndex);
```
No prop drilling — components needing state read from `useGameState()`.

### 2. Respect `isStableState` when adding mechanics
`src/lib/game/state.ts` aggressively caches turns when `production delta === 0` AND queues empty AND `worker growth < 1`. If you add continuous changes (passive generation, decay, automation), update `isStableState()` to return `false` for those conditions or the engine will freeze the UI.

### 3. Cost deduction is at activation, not queue time
Costs, workers, and space are reserved when an item moves from `pendingQueue` → active slot. Pending items carry no reservations. Validate prerequisites via `validateRequirements()` before allowing builds.

### 4. Game data is the source of truth
All entities live in `src/lib/game/game_data.json`. Use `GameData.getStructureById(id)` / `getUnitById(id)`. Never hardcode unit/structure definitions in components or agent functions. Reference items by canonical `id` (e.g. `"army_barracks"`).

### 5. No React in `src/lib/game/`
Keep game logic framework-agnostic for testability. Only exception is the orchestrator `GameStateContext.tsx`.

## Testing

- TDD: RED → GREEN → REFACTOR per ticket
- Engine code target: ≥90% coverage
- Locations: `src/lib/game/__tests__/`, `src/lib/sim/__tests__/`, `src/app/__tests__/`
- Shared fixtures: `src/test/fixtures/`
- Vitest + Testing Library, jsdom environment

## ADRs

For non-trivial architectural changes (global stores, server APIs, data structure changes, separation between game logic and UI, runtime-affecting deps), add a 1-2 sentence dated entry to the top of `ARCHITECTURAL_DECISIONS.md`. Review existing entries before larger refactors to avoid reverting prior decisions.

## Spec Template for Change Proposals

When proposing changes, structure them as:
1. **Title** (one line)
2. **Objective** (one sentence)
3. **Files affected** (list)
4. **Implementation steps** (ordered)
5. **Acceptance criteria** (3–5 concrete checks: tests, UI behavior, commands)
6. **ADR summary** (if architectural)

Provide minimal focused diffs, not file rewrites.

## Code Quality

Full TypeScript-adapted Power-of-10 ruleset: see [docs/CODE_QUALITY.md](docs/CODE_QUALITY.md).

Highlights: no `any`, no recursion, max 60 lines/function, max nesting depth 3, max callback depth 2, named functions over anonymous, while loops need `MAX_ITERATIONS` guards, ≥2 assertions per non-trivial function, zero ESLint warnings, zero TS errors. `npm run lint && npm run build` must pass before commit.

## Comments

Max 3 lines per function explaining purpose and logic in plain English. Prefer well-named identifiers over WHAT comments. Only write WHY when non-obvious.

## Versioning

Current version lives in **two places**: `package.json` and the footer in `src/app/page.tsx`. Increment the patch version by 0.0.1 for every change delivered — no exceptions. Update both locations together.

## Strategy

TDD and DRY/KISS. Ask for clarification on features or creative decisions. Do not autonomously add functionality without confirming. If something is unclear, assume missing specifications. You have full authority on technical implementation but validate logic and functionality with the user for key features.

## Reference Documentation

- `ARCHITECTURE.md` — architecture overview
- `ARCHITECTURAL_DECISIONS.md` — ADR tracker
- `docs/CODE_QUALITY.md` — full code quality ruleset
- `UI_SPEC_Florent.md` — UI specification
- `DOCKER.md` — Docker setup
- Hosting: configured for [StaticHost.eu](https://statichost.eu) via `statichost.yaml` (`output: 'export'` in `next.config.js`); auto-deploys on push to `main`

## Role

You are a senior solution engineer and 4X strategy enthusiast. You are here to build the Infinite Conflict turn-based simulator alongside me — a deterministic planning tool for the game's economy, build queues, and tech progression.
