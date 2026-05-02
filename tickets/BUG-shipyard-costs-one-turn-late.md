# BUG: Shipyard (and similar large buildings) costs deducted one turn late

**Severity**: Medium — incorrect stock display misleads planning  
**Affects**: Building lane, specifically items with high resource/worker costs that follow a prerequisite  
**Status**: Open

---

## Symptom

When viewing the turn the Shipyard commences building, its resource costs (48 000 metal, 32 000 mineral, 60 000 workers) are **not yet visible as deducted**. Only on the following turn do the stocks show the deduction.

Expected: T_N shows Shipyard active **and** stocks reduced.  
Actual: T_N shows Shipyard active, stocks unchanged. T_N+1 shows stocks reduced.

---

## Relevant code

| File | Section | Role |
|------|---------|------|
| `src/lib/sim/engine/turn.ts` | Phase 2b loop (lines 59–66) | Re-activates freed lanes after predecessor completes |
| `src/lib/sim/engine/turn.ts` | Phase 6 (line 73) | Production added to stocks |
| `src/lib/sim/engine/lanes.ts` | `tryActivateNext` | Calls `clampBatchAtActivation`, deducts costs, sets `lane.active` |
| `src/lib/sim/engine/validation.ts` | `clampBatchAtActivation` (line 299) | Checks prereqs, resources, workers, space — returns 0 to stall |
| `src/lib/game/commands.ts` | `queueItem` mutation (lines 89–93) | Eager activation on queue via `tryActivateNext` |
| `src/lib/game/state.ts` | `mutateAtTurn` (line 302) | Applies mutation then calls `recomputeAll(index + 1)` |

---

## Turn execution order (per `runTurn`)

```
Phase 1   – drain completionBuffer (ship effects from prior turn)
Phase 2-4 – for each lane: tryActivateNext → progressActive
            └─ if structure completes → sameTurnCompletions[]
Phase 2b  – processCompletions(sameTurnCompletions)   ← prereq effects land HERE
            for each lane: tryActivateNext             ← re-activation attempt
Phase 5   – colonist conversions
Phase 6   – production added to stocks                ← resources grow HERE
Phase 7   – clamp stocks to 0
Phase 8   – worker growth
            state.currentTurn += 1
```

**Critical observation**: Phase 2b (where the Shipyard would activate after Launch Site completes) runs **before** Phase 6. The activation check in `clampBatchAtActivation` therefore uses the turn's *opening* stocks, not the stocks that will exist *after* this turn's production increment.

---

## Hypothesis A — Phase 2b activates before production closes the gap (most likely)

### Scenario

1. Launch Site completes at the start of turn T's computation.
2. `processCompletions` updates `completedCounts['launch_site'] = 1`.
3. **Phase 2b** fires: `tryActivateNext` → `clampBatchAtActivation` checks stocks.
   - At this point `stocks.metal` might be, say, 47 200 (48 000 needed).
   - `clampBatchAtActivation` returns `0` → Shipyard stays pending.
4. **Phase 6** runs: metal production adds +3 000 → `stocks.metal = 50 200`.
5. `state.currentTurn += 1` → this state is stored as turn T.

6. Next state (turn T+1) clones T, then `runTurn`:
   - **Phase 2-4**: `tryActivateNext` → `clampBatchAtActivation` → 50 200 ≥ 48 000 → **Shipyard activates**, costs deducted.
   - `state.currentTurn += 1` → stored as turn T+1.

**Result**: `getStateAtTurn(T)` shows Shipyard pending. `getStateAtTurn(T+1)` shows Shipyard active + costs deducted. The user sees a 1-turn gap.

### Why the Shipyard is especially prone to this

The Shipyard has the largest absolute cost of any building (48 000 metal, 32 000 mineral, 60 000 workers). The margin between "just barely can't afford on the turn the prereq lands" and "can afford one turn later" is very likely to be hit in normal play, whereas cheaper buildings clear the threshold comfortably.

---

## Hypothesis B — Eager activation in `queueItem` mutation stalls; item slips into the next run-turn cycle

### Scenario

1. User queues Shipyard at turn T with the building lane empty.
2. `queueItem` mutation fires `tryActivateNext` on `states[T-1]`.
3. `clampBatchAtActivation` checks stocks in `states[T-1]`.
   - Resources accumulated through turn T-1 are insufficient by a small margin.
   - Returns `0` → Shipyard goes to `pendingQueue`, not activated.
4. `recomputeAll(T)` computes `states[T]` from `states[T-1]`:
   - **Phase 2-4**: `tryActivateNext` → same pre-production stocks → still `0`.
   - **Phase 6**: production runs → `states[T]` stocks increase.
5. `states[T+1]` is computed from `states[T]`:
   - **Phase 2-4**: `tryActivateNext` → now sufficient → **Shipyard activates**.

**Result**: `getStateAtTurn(T)` shows Shipyard pending. `getStateAtTurn(T+2)` shows it active — a **2-turn** delay in this variant.

This variant is less likely given the user reports exactly 1 turn, but worth verifying by checking whether the Shipyard was queued with an empty lane or behind Launch Site.

---

## Why this wasn't caught by existing tests

The `activation-deduction.test.ts` regression test added for the Phase 2b fix checks that the **second queued item activates on the same turn** as the first completes. It does not stress-test the boundary condition where the second item's `clampBatchAtActivation` returns `0` specifically because Phase 6 hasn't run yet. The fixture uses generous resource amounts, so the clamp never returns 0 in tests.

---

## Suggested investigation steps

1. **Reproduce with the debug state**: Load the shared URL, identify the exact turn the Shipyard goes active in `getStateAtTurn`, and check `states[activationTurn - 1].stocks` vs `states[activationTurn].stocks` to confirm which hypothesis applies.

2. **Add a targeted test**: Queue Launch Site + Shipyard with stocks set so that at the turn Launch Site completes, resources are 1 metal short of the Shipyard's cost. Assert that the Shipyard activates on the same turn Launch Site completes (not T+1). This test should currently **fail** if Hypothesis A is correct.

3. **Fix direction for Hypothesis A** (if confirmed): Move Phase 6 production **before** Phase 2b (or run a second Phase 6 + Phase 2b pass after production). Trade-off: changes the canonical turn order and may have ripple effects on other timing tests. Discuss before implementing.

4. **Fix direction for Hypothesis B** (if confirmed): The eager activation in `queueItem` should ideally use the *end-of-turn* stocks rather than the *start-of-turn* stocks. One approach: after `mutateAtTurn` completes and `recomputeAll` runs, check if the item is still pending in `states[T]` and advance to `states[T+1]` for the activation window.

---

## Affected items (potential, by cost profile)

Any building with costs high enough that production timing matters:

| Item | Metal | Mineral | Workers |
|------|-------|---------|---------|
| Shipyard | 48 000 | 32 000 | 60 000 |
| Command Carrier | — | — | large |
| Research Lab | 24 000 | 16 000 | 25 000 |
| Colony | large | large | large |

---

*Ticket created 2026-05-02. Version at time of filing: 0.1.1.*
