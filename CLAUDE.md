# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Infinite Conflict Turn-Based Strategy Simulator - A deterministic simulation engine for a 4X MMORPG strategy game. Currently migrating from a simple build planner to a full turn-based simulator.

**Status**: 🚧 Migration in progress - implementing new simulation engine while preserving existing functionality.

**Key Architecture Principles**:
1. **Deterministic simulation** - Same inputs always produce same outputs
2. **Framework-free engine** - Pure TypeScript with no UI dependencies
3. **Three-layer architecture** - Engine → Orchestration → UI
4. **TDD-first development** - Tests drive implementation

## Development Commands

### Essential Commands
```bash
npm install          # Install dependencies
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run all tests with Vitest
npm run lint         # Run ESLint
```

### Running Specific Tests
```bash
npm run test src/lib/game/__tests__/agent.test.ts        # Run single test file
npm run test -- --watch                                   # Run tests in watch mode
npm run test -- --coverage                                # Run with coverage report
npm run test -- -t "enqueueItem"                          # Run tests matching pattern
```

## Core Architecture

### Migration Strategy (ACTIVE)

**Current State**: Parallel development with existing code preserved
- Existing code in `src/lib/game/` continues to work
- New engine being built in `src/lib/sim/`
- Gradual migration with adapter pattern for data

### New Architecture (In Development)

#### 1. **Simulation Engine Layer** (`src/lib/sim/engine/`)
- Pure TypeScript, framework-free, deterministic
- No React/Next/DOM imports allowed
- Core modules:
  - `types.ts`: Domain types (PlanetState, WorkItem, LaneState)
  - `validation.ts`: Queue guards and batch clamping
  - `lanes.ts`: Lane activation and progression
  - `completions.ts`: Completion timing and effects
  - `outputs.ts`: Production and consumption calculations
  - `turn.ts`: Deterministic turn sequencing

#### 2. **Orchestration Layer** (`src/lib/game/`)
- Commands API for all mutations
- State management with timeline/snapshots
- Selectors for read-only projections
- Bridge between engine and UI

### Existing Architecture (Being Migrated)

1. **Game Logic Layer** (`src/lib/game/`)
   - Currently contains agent.ts, dataManager.ts, types.ts
   - Will be moved to `src/lib/game/legacy/` during migration
   - Data from `game_data.json` will be adapted to new format

2. **UI Components Layer** (`src/components/`)
   - Presentational and container components
   - Components call game logic functions but never reimplement rules
   - Must use `"use client"` directive for React hooks

3. **App Routes Layer** (`src/app/`)
   - Next.js 14 App Router pages and layouts
   - `page.tsx`: Main client component, houses primary state and UI layout
   - `layout.tsx`: Root layout with fonts and global styles
   - `error.tsx`, `not-found.tsx`: Minimal error pages

### State Management Pattern

- **Local React State**: Uses `useState` for all UI and player state
- **No Global Store**: Deliberately avoided (see ADR 2025-10-11)
- **Agent Functions**: Pure functions that mutate and return structured results
- **React Re-renders**: Explicit state updates trigger re-renders

### Data-Driven Design

All game entities (units, structures, research) are defined in `src/lib/game/game_data.json`:
- **Canonical IDs**: Use `id` field (e.g., `"army_barracks"`) for all references
- **Cost System**: Supports `resource` costs (metal, mineral, food, energy) and `unit` costs (consumed/non-consumed)
- **Requirements**: Structures or research flags needed before building
- **Operations**: Production, consumption, and effects that apply on completion

When adding new game content:
1. Define in `game_data.json` first
2. Use `GameData.getStructureById(id)` or `GameData.getUnitById(id)` in code
3. Never hardcode game data in components or agent functions

### Testing Philosophy

- **Test-First Approach**: Write tests before implementing new game logic
- **Unit Tests**: All game logic in `src/lib/game/__tests__/`
- **UI Tests**: Page and component tests in `src/app/__tests__/`
- **Vitest + Testing Library**: Configured with jsdom environment
- **Integration Tests**: Test complete tick cycles, queue operations, resource flows

Example test locations:
- Game logic: `src/lib/game/__tests__/agent.test.ts`
- Integration: `src/lib/game/__tests__/integration.test.ts`
- UI pages: `src/app/__tests__/page.test.tsx`

## Architectural Decision Records (ADRs)

**Critical Process Requirement**: All contributors must add an ADR entry to `ARCHITECTURAL_DECISIONS.md` for non-trivial architectural changes:
- Introducing global stores or state management libraries
- Adding server-side APIs or backend services
- Changing how game data is structured or persisted
- Modifying the separation between game logic and UI
- Adding new dependencies that change runtime behavior

ADR entries must be:
- 1-2 sentences describing the decision and rationale
- Added at the top of the file (most recent first)
- Dated in YYYY-MM-DD format

See existing ADRs in `ARCHITECTURAL_DECISIONS.md` for examples.

## LLM Collaboration Guidelines

When working with this codebase:

1. **Spec Structure**: Follow the template in `LLM_AND_DEV_GUIDELINES.md` for change proposals
2. **Minimal Edits**: Provide focused diffs, not complete file rewrites
3. **Explicit Acceptance Criteria**: List 3-5 concrete checks for success
4. **ADR Generation**: Include ADR entry for architectural impacts
5. **Test Requirements**: Include tests for logic changes, manual test plan for UI changes

## File Organization Conventions

- Client components: Must start with `"use client"` directive
- Game logic: Must be framework-agnostic (no React imports in `src/lib/game/`)
- Static data: JSON files in `src/data/`
- Tests: Adjacent to modules in `__tests__/` directories

## Important Constraints

- **No React in Game Logic**: `src/lib/game/` must remain React-free for testability
- **Game Data is Truth**: Never hardcode unit/structure definitions; always use `game_data.json`
- **State Mutations**: Agent functions can mutate PlayerState but must be called from React components
- **Prerequisites**: Always validate via `validateRequirements()` before allowing builds
- **Cost Deduction**: Happens at enqueue time, not completion time

## Key Design Patterns

### New Engine Patterns
1. **Three-Lane Architecture**: Building → Ship → Colonist with strict execution order
2. **Queue-time vs Activation-time Validation**: Static constraints at queue, dynamic at activation
3. **Completion Buffers**: Map<turn, WorkItem[]> for deferred completions
4. **Deterministic Turn Sequence**: Fixed order ensures reproducible state
5. **Worker Reservation System**: Workers reserved at activation, released at completion

### Migration Patterns
1. **Adapter Pattern**: Transform existing game_data.json to new ItemDefinition format
2. **Parallel Directories**: New code in `src/lib/sim/` while preserving `src/lib/game/`
3. **Gradual Migration**: Phase-based approach maintaining working app throughout

### Testing Patterns
1. **TDD Workflow**: RED → GREEN → REFACTOR for each ticket
2. **Fixture-Based Testing**: Shared test scenarios in `src/test/fixtures/`
3. **Coverage Gates**: ≥90% coverage requirement for engine code

## Reference Documentation

- Architecture overview: `ARCHITECTURE.md`
- ADR tracker: `ARCHITECTURAL_DECISIONS.md`
- LLM/Developer guidelines: `LLM_AND_DEV_GUIDELINES.md`
- UI specification: `UI_SPEC_Florent.md`

## Hosting

### StaticHost.eu

This project is configured for hosting on [StaticHost.eu](https://statichost.eu).

1.  **Configuration**:
    - `next.config.js` is set to `output: 'export'` for static site generation.
    - `statichost.yml` defines the build command (`npm install && npm run build`) and output directory (`out`).

2.  **Deployment**:
    - Push changes to the `main` branch on GitHub.
    - Connect the repository in the StaticHost.eu dashboard.
    - Deployment is automatic on push.
