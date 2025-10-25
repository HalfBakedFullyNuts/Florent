# testingstrategy.md

A pragmatic, **TDD-first** plan to validate the turn-based simulation engine and its app integration. This document tells you **what to test, how to test it, and where to put tests** so we get deterministic, maintainable behavior.

---

## 1) Goals & scope

**Goals**

* Guarantee the simulation is **deterministic**, **order-sensitive** in the right places, and **pure** (no side effects).
* Prove the rules: lane order, activation timing, batch clamping, energy strictness, colonist conversion timing, production/growth/food sequence.
* Keep UI thin: most logic validated at **domain** and **integration** layers.

**Out of scope**

* Visual style and layout (covered by visual review).
* Server persistence (MVP can be in-memory; when added, test via repository adapters).

---

## 2) Test layers

1. **Unit tests (domain / pure engine)**
   Location: `src/lib/sim/engine/**/*.test.ts`

   * Each function in the engine gets focused tests with simple fixtures.
   * No framework or UI imports.

2. **Integration tests (app orchestration)**
   Location: `src/lib/game/**/*.(test|spec).ts`

   * `commands.ts` + `state.ts` + `selectors.ts` working together.
   * Proves timeline recomputation, drag & drop reorder, cancel/refund flows.

3. **Component tests (lightweight)**
   Location: `src/components/**/*.(test|spec).tsx`

   * Sanity: Turn slider is read-only; LaneBoard triggers the right commands; error messages surface reason codes.

*(Project already includes Vitest; we’ll stick to it.)*

---

## 3) Engine modules & functions to test

### 3.1 `validation.ts`

**Functions**

* `hasPrereqs(state, def)`
* `housingExistsForColonist(state, def, qty)`
* `energyNonNegativeAfterCompletion(state, def, qty)`
* `canQueue(state, def, requestedQty)`  *(static constraints only)*
* `clampBatchAtActivation(state, def, requested)` *(dynamic clamp: resources, workers, space for structures, housing for colonists, energy forward-check)*

**Unit test matrix**

* **Prereqs**

  * ✓ Missing required structure → `false`
  * ✓ Present required structure(s) → `true`
* **Colonist housing (queue-time & activation-time)**

  * ✓ Cap exactly fits requested (OK)
  * ✓ Cap overrun by 1 (reject)
  * ✓ Increasing cap by building finishing **this turn** still must exist **at activation** for colonists (reject if not available yet)
* **Energy strictness (forward check)**

  * ✓ Completing a producer makes `netEnergy ≥ 0` (OK)
  * ✓ Completing a consumer (upkeep) would drive `netEnergy < 0` (reject)
* **canQueue**

  * ✓ Rejects `REQ_MISSING`, `HOUSING_CAP`, `ENERGY_NEG_AFTER_COMPLETION`, `NO_SPACE`
  * ✓ Accepts items that are statically possible (even if present stocks/workers are insufficient now → will clamp at activation)
* **clampBatchAtActivation**

  * ✓ Clamps by **resources** (floor division across multiple resource costs)
  * ✓ Clamps by **workersToReserve**
  * ✓ Clamps by **space** for structures only
  * ✓ Clamps by **housing** for colonists
  * ✓ **Energy forward-check** reduces quantity until future net energy ≥ 0
  * ✓ Returns `0` (keeps pending) when dynamically infeasible

### 3.2 `lanes.ts`

**Functions**

* `tryActivateNext(state, laneId)`
* `progressActive(state, laneId)`

**Unit test matrix**

* **Activation timing**

  * ✓ Only activates when lane idle
  * ✓ Deducts **resources** and **reserves workers** at activation (not queue)
  * ✓ Structures reserve **space** at activation; ships/colonists do not
* **Batch clamping & pending**

  * ✓ Requested > feasible → activates with clamped `finalQty`
  * ✓ Feasible `finalQty = 0` → remains `pending` (no mutation)
* **Progression**

  * ✓ `turnsRemaining` decrements; on zero → completion recording per type
* **Lane order sensitivity**

  * ✓ Building activation can consume stocks & workers before ships; ships before colonists
  * ✓ Reversing lane order changes what activates/clamps (we will not reverse, but test ensures order matters)

### 3.3 `completions.ts`

**Functions**

* `queueStartOfNextTurnCompletion(state, wi)`
* `applyQueuedStartOfTurnCompletions(state)`
* `applyColonistConversions(state)` *(refund n−1 workers/unit, convert 1 to colonist; runs between colonist lane and production)*

**Unit test matrix**

* **Structures/ships**

  * ✓ Effects apply at **start of next turn**
  * ✓ Workers & structure space released at that moment
* **Colonists**

  * ✓ Completion triggers **same turn** conversion step
  * ✓ For each unit: release lane reservation; `workersTotal -= 1`, `workersIdle += (n−1)`, `soldiers/scientists += qty`
  * ✓ Production runs **after** conversion (thus production sees updated workers/idle figures only where relevant)

### 3.4 `outputs.ts`

**Functions**

* `computeNetOutputsPerTurn(state)` *(base outputs × abundance − upkeeps)*
* `addOutputsToStocks(state, out)`
* `applyEffectsOnComplete(state, def, qty)`

**Unit test matrix**

* **Abundance**

  * ✓ base=300, abundance=0.7 → net +210
  * ✓ Abundance per resource type independent
* **Upkeep**

  * ✓ Subtract per-unit energy upkeep for completed items
  * ✓ Net energy reported reflects generation−upkeep
* **Effects**

  * ✓ Housing/space increments apply per qty
  * ✓ Structure counts increment for dependent behaviors

### 3.5 `growth_food.ts`

**Functions**

* `computeGrowthBonus(state)` *(+0.5% per leisure center / hospital)*
* `foodUpkeepForWorkers(state)` *(0.002/worker)*

**Unit test matrix**

* **Growth bonuses**

  * ✓ No facilities → 1% base only
  * ✓ 1 leisure + 1 hospital → +1.0% total bonus (0.5 + 0.5) → growth 2.0% total
* **Food upkeep**

  * ✓ Exact floor behavior: `floor(workersTotal * 0.002)`

### 3.6 `turn.ts`

**Functions**

* `runTurn(stateT)` *(canonical order: building → ship → colonist → colonist conversion → production → growth → food upkeep)*
* `simulate(initial, n)`

**Unit test matrix**

* **Duration correctness**

  * ✓ Item of `d=4` queued at T occupies T..T+3; effects at start of T+4
* **Order-sensitive resource deductions**

  * ✓ Queue building, ship, colonist; earlier lanes reduce dynamic availability for later lanes
* **Colonist conversion timing**

  * ✓ Conversion happens **before** production, **same turn**
* **Growth gating**

  * ✓ Food after production > 0 → growth applies (cap only via housing timing rule)
  * ✓ Food ≤ 0 → no growth
  * ✓ Food never goes below 0 after upkeep (clamped)
* **Energy strictness guarantee**

  * ✓ No turn results in `netEnergy < 0` after any completion; activation forbids it

---

## 4) Integration tests (app layer)

### 4.1 `state.ts` (timeline + recomputation)

* **Recompute from turn**

  * ✓ Edit at T3 invalidates T4+ and recomputes deterministically
* **Determinism**

  * ✓ Same inputs produce identical sequence of snapshots (deep-equal)

### 4.2 `commands.ts` (mutations)

* **Queue item**

  * ✓ `canQueue` rejects statically impossible entries with reason codes
  * ✓ Accepted item lands `pending`; no cost deducted
* **Reorder in lane**

  * ✓ Drag from index i→j changes activation order; recompute from that turn
* **Cancel**

  * ✓ Pending → removed (no refunds needed)
  * ✓ Active → immediate full refund of paid resources, release workers/space, lane tries next item same tick; deterministic outcome
* **Next turn**

  * ✓ Advances 1 turn, snapshot index increments, selectors reflect new state

### 4.3 `selectors.ts`

* **Planet summary**

  * ✓ Returns stocks, outputs/turn (abundance-adjusted), space used/cap, housing caps, workers total/idle/busy, **growth hint** (“+X workers at end of turn”)
* **Lane view**

  * ✓ Each entry shows `status` (`pending|active|completed`), `finalQty`, `turnsRemaining`, ETA turn
* **Warnings**

  * ✓ Surfaces reason codes for queue-time rejections and any derived constraints that matter for the turn

---

## 5) Properties, invariants & fuzzing

Add property tests where useful (Vitest + fast-check or simple loops):

* **Invariants**

  * Workers bookkeeping: `workersTotal = workersIdle + Σ busyByLane`
  * Stocks never negative after food upkeep: `stocks[r] >= 0` for all `r` (clamped food)
  * Net energy never negative after completion: `computeNetOutputsPerTurn(state).energy >= 0`
  * Colonist caps: `soldiers ≤ cap.soldier`, `scientists ≤ cap.scientist`
  * Units (ships/colonists) do **not** consume space

* **Order sensitivity (fuzz)**

  * Generate random per-turn mixes; assert that swapping building/ship/colonist queue orders inside a turn changes outcomes **only** when rules allow it (i.e., resources/workers contention), and never violates invariants.

* **Idempotence**

  * Re-running `simulate` from the same initial + inputs yields byte-equal snapshots.

---

## 6) Fixtures & helpers

Create `src/test/fixtures/`:

* `defs.minimal.ts`: few structures (power gen, housing, mine with energy upkeep), one ship, soldier & scientist (with `workersToReserve`), clear abundances.
* `state.initial.ts`: simple planet with known stocks, space, housing caps, population.
* `builders.ts`: helpers to clone and modify `PlanetState`, queue items, advance N turns.

**Rule:** All engine tests import from fixtures; do **not** use app components or global stores.

---

## 7) Performance & regression

* **Performance smoke**: simulate 500 turns with medium queues; assert runtime < target threshold (document a sensible number for dev machines).
* **Regression snapshots**: for a couple of canonical scenarios, store JSON “golden” outputs; diff them on every change.

---

## 8) Coverage & CI gates

* Vitest config:

  * **Target**: ≥90% line/branch coverage for `src/lib/sim/engine/**`
  * Break build if coverage dips.
* Run tests on PR via your existing CI (no new tooling required).

---

## 9) TDD workflow (per ticket)

1. **RED**: Write a failing spec for the next function/behavior.
2. **GREEN**: Implement the **smallest** code to pass.
3. **REFACTOR**: Remove duplication, clarify names, keep engine pure.

**Suggested order**

1. `types.ts` + `constants.ts` (no tests, compile only)
2. `validation.ts` (queue-time guards)
3. `lanes.ts` (activation, clamping, pending)
4. `completions.ts` (start-of-turn & colonist conversions)
5. `outputs.ts` (abundance & upkeep)
6. `turn.ts` (full sequence)
7. `state.ts` & `commands.ts` (integration)
8. `selectors.ts` (summary & warnings)
9. Component smoke tests

---

## 10) Concrete test cases checklist (quick copy-paste)

* [ ] Duration `d=4` → occupies T..T+3, completes at start of T+4
* [ ] Activation deducts resources & reserves workers; queue-time does not
* [ ] Pending when `clampBatchAtActivation = 0`
* [ ] Building → Ship → Colonist lane order affects feasible batches
* [ ] Colonist: reserve `n` at activation; at completion: refund `n−1`, convert 1; happens **before** production
* [ ] Production: base × abundance; subtract energy upkeep
* [ ] Growth only if `food > 0` after production; food upkeep cannot take stock < 0
* [ ] Energy strictness: cannot activate if post-completion `netEnergy < 0`
* [ ] Colonist housing must exist at activation and fit requested quantity
* [ ] Units (ships/colonists) do **not** consume space; structures may
* [ ] Reorder inside lane re-evaluates from edited turn; deterministic recompute
* [ ] Cancel active → immediate full refund & release; lane may auto-activate next pending item

---

### Notes

* Keep the engine **framework-free**; tests must not import React/Next.
* Prefer **small, explicit** fixtures over elaborate shared state.
* When in doubt: add an **invariant** or **property test**.

That’s it. With this testing strategy, you can proceed **TDD** from the bottom up and land a robust, deterministic simulator that your UI can trust.
