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

### Docker (Development/Local)

Docker configuration is available for local development:
- See `DOCKER.md` for setup instructions
- `docker-compose.yml` for development environment
- `Dockerfile` and `Dockerfile.dev` for containerized builds

## Role
You are a senior solution engineer and Shadowrun enthusiast. You are here to build a tool to help me facilitate my Shadowrun campaigns and keep the party together.

## Code Quality Rules (TypeScript Adaptation)

These rules are adapted from NASA/JPL's "Power of 10" for safety-critical systems, modified for TypeScript/JavaScript idioms while preserving the spirit of defensive, maintainable code.

### 1. Simple Control Flow
- **No recursion**: Avoid direct or indirect recursive calls. Use iterative solutions with explicit loop bounds.
- **No complex control flow**: Prefer early returns over deeply nested conditionals. Maximum nesting depth: 3 levels.

### 2. Bounded Iterations
- **Array iterations are bounded**: `.forEach()`, `.map()`, `.filter()`, `.reduce()` on arrays are inherently bounded by array length—these are acceptable.
- **While loops require guards**: Any `while` loop must have a `MAX_ITERATIONS` constant and break condition to prevent infinite loops.
```typescript
const MAX_ITERATIONS = 1000;
let iterations = 0;
while (condition && iterations < MAX_ITERATIONS) {
  iterations++;
  // ... logic
}
if (iterations >= MAX_ITERATIONS) {
  throw new Error('Loop exceeded maximum iterations');
}
```

### 3. Controlled Collection Growth
- **Pre-size when possible**: If array size is known, pre-allocate with `new Array(size)`.
- **Cap dynamic collections**: Collections that grow dynamically should have maximum size limits enforced.
- **Document unbounded growth**: If a collection must grow unboundedly, add a comment explaining why and what bounds exist in practice.

### 4. Function Length Limit
- **Maximum 60 lines per function** (excluding comments and blank lines).
- **Split large functions**: Extract logical chunks into well-named helper functions.
- **Single responsibility**: Each function should do one thing well.

### 5. Assertion Density
- **Minimum 2 assertions per non-trivial function**: Use guard clauses to validate assumptions.
- **Assertions must have recovery**: Return error results or throw with descriptive messages.
- **Use TypeScript's type system**: Let the compiler catch what it can; use runtime checks for what it cannot.
```typescript
// Guard clause pattern (counts as assertion)
function processItem(item: Item | null): Result {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }
  if (item.quantity < 0) {
    return { success: false, error: 'Quantity must be non-negative' };
  }
  // ... main logic
}
```

### 6. Minimal Scope
- **Declare variables at point of use**: Use `const` by default, `let` only when reassignment is needed.
- **No `var`**: Always use block-scoped `const`/`let`.
- **Avoid module-level mutable state**: Prefer pure functions that take state as parameters.

### 7. Return Value Handling
- **Check all fallible operations**: Handle `null`, `undefined`, and error results explicitly.
- **Use Result types for operations that can fail**: Prefer `{ success: boolean, data?, error? }` over throwing.
- **Validate function parameters**: Check required parameters at function entry.

### 8. Type Safety (TypeScript-specific)
- **No `any` type**: Use `unknown` and narrow with type guards if type is truly unknown.
- **No type assertions without validation**: `as` casts should be preceded by runtime checks.
- **Strict null checks enabled**: Handle `null`/`undefined` explicitly.

### 9. Static Analysis
- **Zero ESLint warnings**: All code must pass linting with the project's ESLint config.
- **Zero TypeScript errors**: Strict mode enabled, no `@ts-ignore` without justification comment.
- **Run before commit**: `npm run lint && npm run build` must pass.

### 10. Callbacks and Higher-Order Functions
- **Named functions over anonymous**: Prefer named function declarations for debugging and stack traces.
- **No deeply nested callbacks**: Maximum callback depth of 2. Use async/await or extract to named functions.
```typescript
// Preferred: named functions
const isActive = (item: Item) => item.status === 'active';
const items = allItems.filter(isActive);

// Avoid: nested anonymous callbacks
const result = data.map(x => x.items.filter(y => y.children.some(z => z.active)));
```

## Reporting
Make extra comments of max. 3 lines per function that explain the purpose of the function and the logic behind it in plain English.

## Strategy

Work with test driven development and DRY/KISS principles. Ask me for clarification on features or creative decisions. Do not autonomously add functionality without confirming with the user. If something is not clear, assume missing specifications. You have full authority on the technical implementation of features but will validate logic and functionality with the user for key features.
