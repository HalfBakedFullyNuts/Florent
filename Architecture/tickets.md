# Implementation Tickets for 4X MMORPG Turn-Based Strategy Simulator

## Overview
This document contains refined implementation tickets for transitioning from the current build planner to a full turn-based simulation engine. The implementation follows TDD principles and maintains a clear separation between the deterministic engine and UI layers.

## Implementation Phases

### Phase 0: Preparation & Refactoring Strategy
**Goal**: Prepare codebase for new architecture while preserving working functionality

### Phase 1: Core Engine (Tickets 1-8)
**Goal**: Build deterministic simulation engine with no UI dependencies

### Phase 2: Integration Layer (Tickets 9-12)
**Goal**: Create orchestration layer between engine and UI

### Phase 3: UI Migration (Tickets 13-19)
**Goal**: Migrate UI to use new engine through commands/selectors

### Phase 4: Testing & Performance (Tickets 20-22)
**Goal**: Comprehensive testing and performance validation

---

## Phase 0: Preparation Tickets

## 0) **Codebase Refactoring Strategy**

**Summary**
Document and execute the transition strategy from existing code to new architecture.

**Scope**
* Create parallel directory structure (`src/lib/sim/`) alongside existing (`src/lib/game/`)
* Preserve existing functionality during transition
* Map existing data structures to new engine types
* Create migration checklist

**Files**
* `docs/MIGRATION.md` - Migration strategy document
* `src/lib/sim/README.md` - New engine documentation
* `src/lib/game/legacy/` - Move existing code here temporarily

**Acceptance Criteria**
* Existing app continues to work during migration
* Clear mapping document between old and new types
* Migration checklist with verification steps

**Dependencies**
* None

---

## Phase 1: Core Engine Tickets

## 1) **Engine skeleton & domain types**

**Summary**
Create the pure, framework-free simulation engine structure and domain types.

**Scope**
* Introduce engine directories and empty modules with exported signatures only
* Add all domain TS types and enums from pseudocode
* Create type guards and validation interfaces

**Files**
* `src/lib/sim/engine/types.ts` - Core types (PlanetState, WorkItem, LaneState, etc.)
* `src/lib/sim/engine/validation.ts` (stubs) - Validation function signatures
* `src/lib/sim/engine/lanes.ts` (stubs) - Lane management signatures
* `src/lib/sim/engine/completions.ts` (stubs) - Completion handling signatures
* `src/lib/sim/engine/outputs.ts` (stubs) - Production/consumption signatures
* `src/lib/sim/engine/growth_food.ts` (stubs) - Growth and food signatures
* `src/lib/sim/engine/turn.ts` (stubs) - Turn sequencing signatures
* `src/lib/sim/engine/buffers.ts` (stubs) - Completion buffer signatures
* `src/lib/sim/engine/helpers.ts` - Clone and utility function signatures
* `src/lib/sim/rules/constants.ts` - Game constants
* `src/lib/sim/rules/order.ts` - Lane execution order
* `src/lib/sim/defs/schema.ts` - ItemDefinition types and guards

**Implementation Details**
```typescript
// Key types from pseudocode to implement:
type ResourceId = 'metal' | 'mineral' | 'food' | 'energy' | string;
type LaneId = 'building' | 'ship' | 'colonist';
type UnitType = 'structure' | 'ship' | 'soldier' | 'scientist';
type Status = 'pending' | 'active' | 'completed';
```

**Acceptance Criteria**
* Compiles with no implementation logic (just signatures and exports)
* No imports from React/Next/DOM
* All types from pseudocode are properly defined
* Type guards for runtime validation included

**Test Plan (TDD)**

* Type-only compile check (no tests yet).

**Dependencies**

* None.

---

## 2) **Rules & constants (growth/food/order)**

**Summary**
Centralize core constants and the canonical turn order.

**Scope**
* `WORKER_GROWTH_BASE = 0.01` (1% per turn)
* `BONUS_PER_FACILITY = 0.005` (0.5% per leisure center/hospital)
* `FOOD_PER_WORKER = 0.002` (200 food per 100k workers per turn)
* `ABUNDANCE_MIN = 0.0` (0%)
* `ABUNDANCE_MAX = 2.0` (200%)
* `ABUNDANCE_DEFAULT = 1.0` (100%)
* Canonical order: **building → ship → colonist → colonist conversion → production → worker growth → worker food upkeep**

**Files**
* `src/lib/sim/rules/constants.ts`
* `src/lib/sim/rules/order.ts`

**Implementation Details**
```typescript
// Food consumption based on game_data.json:
// "amount_per_100_pop": 1 means 1 food per 100 population
// For 100k workers: 1000 food per turn
// Per worker: 0.01 food per turn
// BUT user specified 0.002 (200 per 100k), so use that as override

export const FOOD_CONSUMPTION = {
  PER_WORKER: 0.002,      // 200 food per 100k workers
  PER_100_POP: 0.2        // Equivalent to amount_per_100_pop
};
```

**Acceptance Criteria**
* Constants match user specifications
* Food consumption: 0.002 per worker (not 0.01 from JSON)
* Abundance range: 0-200% (0.0 to 2.0 multiplier)
* No logic drift (single source of truth)

**Tests**
* Unit tests assert constants and order are exported

**Dependencies**
* Ticket 1

---

## 3) **Validation primitives**

**Summary**
Implement static queue guards and dynamic batch clamp.

**Scope**

* `hasPrereqs(state, def)`
* `housingExistsForColonist(state, def, qty)`
* `energyNonNegativeAfterCompletion(state, def, qty)` (forward check via simulated effects + net outputs)
* `canQueue(state, def, requestedQty)` (static constraints only)
* `clampBatchAtActivation(state, def, requested)` (resources, workers, space for structures, colonist housing, energy forward check; pending if 0)

**Files**

* `src/lib/sim/engine/validation.ts` (+ unit tests)

**Acceptance Criteria**

* All unit tests from testingstrategy pass for this module.

**Dependencies**

* Tickets 1–2.

---

## 4) **Lane activation & progression**

**Summary**
Implement lane logic to activate items, deduct at activation, and progress work.

**Scope**

* `tryActivateNext(state, laneId)`
* `progressActive(state, laneId)`
* Deduct **resources** and **reserve workers/space (structures only)** at activation; units ignore space.
* If `clampBatchAtActivation(...)` returns 0 → keep pending.
* On zero `turnsRemaining`: mark completion (colonists handled later).

**Files**

* `src/lib/sim/engine/lanes.ts` (+ unit tests)

**Acceptance Criteria**

* Activation only when idle; correct deductions/reservations.
* Batch clamp + pending behavior validated.

**Dependencies**

* Tickets 1–3.

---

## 5) **Completions & colonist conversion**

**Summary**
Handle start-of-turn completions and in-turn colonist conversion with proper timing.

**Scope**
* Start-of-turn for structures/ships: apply effects, release workers/space
* Colonist conversion **between colonist lane and production**: convert 1 worker → colonist
* Worker production: Outpost produces 200 workers/turn (no lane, direct to population)
* Completion buffers keyed by turn for deferred completions

**Files**
* `src/lib/sim/engine/completions.ts` - Completion logic
* `src/lib/sim/engine/buffers.ts` - Turn-keyed completion queue

**Implementation Details**
```typescript
// Buffer implementation approach:
interface CompletionBuffer {
  private completions: Map<number, WorkItem[]>; // turn -> items

  enqueue(turn: number, item: WorkItem): void;
  drain(turn: number): WorkItem[];
  clear(): void;
}

// Three distinct completion types:
// 1. Structures/Ships -> queue for next turn start
// 2. Colonists (soldier/scientist) -> immediate conversion in same turn
//    - Reserves workers_occupied during training (10 for soldier, 20 for scientist)
//    - Cost includes: { type: "unit", id: "worker", amount: 1, is_consumed: true }
//    - On completion: refund (n-1) workers to idle, convert 1 to colonist
//    - Example: Soldier reserves 10, returns 9 idle, creates 1 soldier
// 3. Worker production from outpost -> direct to population during production phase
```

**Acceptance Criteria**
* Soldier/scientist training consumes 1 worker (from cost specification)
* Colonists complete and convert in same turn (step 4)
* Structures/ships complete at start of next turn
* Workers from outpost added during production phase (not via lane)
* Workers reserved during construction released at completion

**Dependencies**
* Tickets 1–4

---

## 6) **Outputs: abundance & upkeep**

**Summary**
Calculate net outputs per turn and apply to stocks.

**Scope**

* `computeNetOutputsPerTurn(state)` = Σ(baseOutputsPerUnit × abundance × count) − Σ(upkeeps)
* `addOutputsToStocks(state, outputs)` (no caps)
* `applyEffectsOnComplete` (counts, housing, space caps, etc.)

**Files**

* `src/lib/sim/engine/outputs.ts` (+ unit tests)

**Acceptance Criteria**

* Abundance math: e.g., 300 × 0.7 = 210.
* Upkeep subtracts (e.g., energy upkeep) per completed unit.

**Dependencies**

* Tickets 1–5.

---

## 7) **Growth & food upkeep**

**Summary**
Implement growth bonuses and food consumption.

**Scope**

* `computeGrowthBonus(state)` (+0.5% each for leisure center/hospital)
* `foodUpkeepForWorkers(state)` (0.002/worker, floored)
* Growth only if food after production > 0; food upkeep clamps at 0.

**Files**

* `src/lib/sim/engine/growth_food.ts` (+ unit tests)

**Acceptance Criteria**

* Tests for growth % calculation and food floor behavior pass.

**Dependencies**

* Tickets 1–6.

---

## 8) **Turn runner (deterministic sequencing)**

**Summary**
Implement `runTurn` using the canonical order.

**Scope**

* start-of-turn completions
* lanes: building → ship → colonist
* colonist conversion
* production → growth → food upkeep
* duration math: `d=4` occupies T..T+3; effects at start of T+4
* `simulate(initial, n)`

**Files**

* `src/lib/sim/engine/turn.ts` (+ unit tests)

**Acceptance Criteria**

* All “turn.ts” unit matrix cases from testingstrategy pass.

**Dependencies**

* Tickets 1–7.

---

## 9) **Timeline & recomputation**

**Summary**
Manage snapshots, invalidation, and recompute from edited turn.

**Scope**

* `getStateAtTurn(T)`
* `recomputeFromTurn(T0)` → truncate and re-run deterministic engine forward
* Storage for `states: PlanetState[]` and current turn index.

**Files**

* `src/lib/game/state.ts` (+ integration tests)

**Acceptance Criteria**

* Editing at T3 recomputes T4+ deterministically.

**Dependencies**

* Tickets 1–8.

---

## 10) **Game integration: commands API**

**Summary**
Public mutation API for the app; all UI actions call these.

**Scope**

* `queueItem(turn, defId, requestedQty)` → uses `canQueue`, push pending in lane
* `reorderQueue(turn, lane, from, to)` → recompute from `turn`
* `cancelEntry(turn, lane, entryId)` → pending: remove; active: immediate refund + release; then remove and try activate next
* `nextTurn()` / `setTurn(T)` / `loadScenario(defs, seedState)`

**Files**

* `src/lib/game/commands.ts` (+ integration tests)

**Acceptance Criteria**

* Deterministic behavior; no direct engine calls from components.

**Dependencies**

* Tickets 1–9.

---

## 11) **Game integration: selectors**

**Summary**
Read-only projections for UI.

**Scope**

* `getPlanetSummary(turn)` → stocks, outputs/turn (net), ground/orbital used+cap, housing caps, workers total/idle/busy, **“+X workers”** hint
* `getLaneView(turn, lane)` → entries with status, finalQty, turnsRemaining, ETA
* `getWarnings(turn)` → reason codes/messages

**Files**

* `src/lib/game/selectors.ts` (+ integration tests)

**Acceptance Criteria**

* Matches end-of-turn snapshot logic and growth hint.

**Dependencies**

* Tickets 1–10.

---

## 12) **Data adapter: game_data.json integration**

**Summary**
Create minimal adapter to use existing `game_data.json` directly with new engine, maintaining authoritative data format.

**Scope**
* Read and interpret existing `game_data.json` without modification
* Map to `ItemDefinition` interface for engine consumption
* Create initial `PlanetState` with specified starting conditions
* Provide test fixtures for development

**Files**
* `src/lib/sim/defs/adapter.ts` - Interpret game_data.json for engine
* `src/lib/sim/defs/seed.ts` - Initial planet state factory
* `src/test/fixtures/minimal.ts` - Minimal test scenario
* `src/test/fixtures/standard.ts` - Standard start scenario

**Implementation Details**
```typescript
// Mapping from game_data.json to ItemDefinition:
interface DataMapping {
  // STRUCTURES:
  // - build_requirements.workers_occupied → costsPerUnit.workersToReserve
  // - build_requirements.space_cost → costsPerUnit.spaceGround/spaceOrbital
  // - cost[] → costsPerUnit.resources
  // - operations.production → effectsOnComplete.baseOutputsPerUnit
  // - operations.consumption → upkeepPerUnit.energyPerUnit
  // - operations.effects → effectsOnComplete.housingDelta/spaceDelta
  // - Lane: always 'building'

  // UNITS:
  // - category: 'colonist' → lane: 'colonist', colonistKind: soldier/scientist
  // - category: 'ship' → lane: 'ship'
  // - build_requirements.workers_occupied → costsPerUnit.workersToReserve (for colonists)
  // - worker conversion: cost includes { type: "unit", id: "worker", is_consumed: true }
  // - build_time_turns → durationTurns
}

// Initial planet state (per user specification):
const INITIAL_STATE = {
  stocks: { metal: 30000, mineral: 20000, food: 1000, energy: 0 },
  abundance: { metal: 1.0, mineral: 1.0, food: 1.0, energy: 1.0 }, // 100%
  population: { workersTotal: 20000, workersIdle: 20000, soldiers: 0, scientists: 0 },
  space: { groundUsed: 8, groundCap: 60, orbitalUsed: 0, orbitalCap: 40 },
  structures: {
    'outpost': 1,
    'metal_mine': 3,
    'mineral_extractor': 3,
    'farm': 1,
    'solar_generator': 1
  }
};
```

**Acceptance Criteria**
* game_data.json used as-is without modification
* All structures and units correctly mapped to lanes
* Workers occupied correctly interpreted (5000 = 5000 workers)
* Initial state matches specification (30k metal, 20k mineral, etc.)
* Food consumption: 0.002/worker (200 food per 100k workers per turn)

**Dependencies**
* Tickets 1, 6–8

---

## 13) **UI: TurnSlider (read-only)**

**Summary**
Render snapshots for selected turn without mutation.

**Scope**

* A slider/select to choose `T` and show current snapshot summary overlay/WIP markers.

**Files**

* `src/components/TurnSlider.tsx`

**Acceptance Criteria**

* Changing slider never mutates state; selectors drive the view.

**Dependencies**

* Tickets 9–11.

---

## 14) **UI: PlanetSummary**

**Summary**
Show planet stocks, outputs/turn, space caps, housing caps, workers & growth hint.

**Scope**

* Consume `getPlanetSummary(turn)` and render.

**Files**

* `src/components/PlanetSummary.tsx`

**Acceptance Criteria**

* Reflects selected turn snapshot; shows “+X workers at end of turn”.

**Dependencies**

* Tickets 11, 13.

---

## 15) **UI: LaneBoard – Building**

**Summary**
Lane component for structures with DnD, queueing, and reorder.

**Scope**

* Display entries, support reordering via `reorderQueue`, queue via `queueItem`.
* Inline errors when `canQueue` fails.

**Files**

* `src/components/LaneBoard/LaneBoard.tsx` (parametric by lane)
* `src/components/LaneBoard/QueueItemRow.tsx`
* `src/components/LaneBoard/QueueToolbar.tsx`

**Acceptance Criteria**

* Reorder triggers recompute from that turn; entries show status/ETA; queueing disallows impossible items.

**Dependencies**

* Tickets 10–11.

---

## 16) **UI: LaneBoard – Ship**

**Summary**
Same as building, with batch inputs and clamping at activation.

**Scope**

* Batch input for ships; show requested vs finalQty when active.

**Files**

* reuse LaneBoard; configure for `ship`

**Acceptance Criteria**

* Batch requested is accepted at queue time; clamped at activation; pending if 0 feasible.

**Dependencies**

* Tickets 10–11, 15.

---

## 17) **UI: LaneBoard – Colonist**

**Summary**
Lane for colonists (soldiers, scientists), respecting housing at activation.

**Scope**

* Batch input; colonist housing guard; show conversion timing in ETA.

**Files**

* reuse LaneBoard; configure for `colonist`

**Acceptance Criteria**

* Cannot queue beyond housing cap; shows correct completion/conversion timing.

**Dependencies**

* Tickets 10–11, 15.

---

## 18) **Cancel & refund UX**

**Summary**
Allow cancel of pending/active entries with correct refunds/releases.

**Scope**

* Wire UI to `cancelEntry` and refresh via selectors.

**Files**

* Update lane components

**Acceptance Criteria**

* Cancel active → immediate resource refund, release workers/space, lane may auto-activate next; deterministic.

**Dependencies**

* Tickets 10, 15–17.

---

## 19) **Warnings & errors surfacing**

**Summary**
Display reason codes/messages consistently in UI.

**Scope**

* Map `canQueue` reasons and other validation messages to readable labels with codes.

**Files**

* `src/components/Warnings.tsx`
* Minor changes in lane components

**Acceptance Criteria**

* Users see why an item can’t be queued (REQ_MISSING, HOUSING_CAP, ENERGY_NEG_AFTER_COMPLETION, NO_SPACE).

**Dependencies**

* Tickets 11, 15–17.

---

## 20) **Engine unit tests (≥90% coverage)**

**Summary**
Implement all unit tests specified in testingstrategy for engine modules.

**Scope**

* Tests for: validation, lanes, completions, outputs, growth_food, turn.

**Files**

* `src/lib/sim/engine/**/*.test.ts`
* `src/test/fixtures/*` (defs, initial state, builders)

**Acceptance Criteria**

* ≥90% line/branch coverage on `src/lib/sim/engine/**`.
* All matrices pass.

**Dependencies**

* Tickets 2–8.

---

## 21) **Integration tests: timeline, commands, selectors**

**Summary**
Prove recomputation, determinism, and command flows.

**Scope**

* `state.ts`, `commands.ts`, `selectors.ts` happy-paths & edge cases.

**Files**

* `src/lib/game/**/*.(test|spec).ts`

**Acceptance Criteria**

* Editing T3 invalidates T4+ and recomputes deterministically.
* Queue/reorder/cancel/nextTurn flows pass.

**Dependencies**

* Tickets 9–12.

---

## 22) **Performance smoke test**

**Summary**
Ensure simulate/recompute is fast for medium scenarios.

**Scope**

* Benchmark 500 turns with realistic queues; assert runtime under agreed threshold (document number).

**Files**

* `src/lib/sim/engine/turn.perf.test.ts` (or similar)

**Acceptance Criteria**

* Meets performance threshold on dev hardware.

**Dependencies**

* Tickets 8, 20.

---

### Notes for the assignee(s)

* Follow **TDD**: write failing tests first per ticket, then implement, then refactor.
* Keep `src/lib/sim/**` **framework-free** (no React/Next/DOM).
* All UI mutations must go through `src/lib/game/commands.ts`.
* Determinism is king: editing past turns must recompute future snapshots from a clean baseline every time.

If you’d like, I can also generate these as GitHub issue bodies (one per ticket) with checklists for AC that you can paste directly.
