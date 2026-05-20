# PERF-001: Add batch mutation support to Timeline

**Priority**: Critical  
**Complexity**: M  
**Estimated impact**: 60-75% reduction in repack cost; foundation for PERF-002 and PERF-003  
**Files**: `src/lib/game/state.ts`, `src/lib/game/commands.ts`

## Problem

Every call to `timeline.mutateAtTurn()` triggers `recomputeAll()`, which re-simulates 50+ turns of game state. Operations like `repackQueue` call `mutateAtTurn` once to clear the queue, then call `queueItem`/`queueWaitItem` per extracted item — each of which calls `mutateAtTurn` again. For a queue with N items, this means N+1 full timeline recomputes where only 1 is needed.

The same problem affects `repackAllLanes` (4 lanes × N items), `cancelEntryByIdSmart` + cascade detection, and `replayCommands` during URL loading.

## Contract: no reads inside a batch

**Critical constraint**: `getStateAtTurn` must NOT be called inside a `withBatch` callback. The simulation chain is paused during a batch — any read returns pre-mutation (stale) state. Callers that need forward-scanned state (e.g. `repackQueue`'s lane-availability search) must complete all reads before opening the batch, or be restructured so writes happen in a single deferred write phase (see PERF-003).

In debug/development mode, enforce this with an assertion:
```ts
getStateAtTurn(index: number): PlanetState {
  if (this._batchDepth > 0 && process.env.NODE_ENV !== 'production') {
    throw new Error('getStateAtTurn called inside withBatch — reads are stale during a batch');
  }
  // ...existing logic
}
```

## Proposed solution

Add a `withBatch` method to `Timeline`:

```ts
private _batchDepth = 0;
private _batchMinIndex = Infinity;

withBatch(fn: () => void): void {
  this._batchDepth++;
  try {
    fn();
  } finally {
    this._batchDepth--;
    if (this._batchDepth === 0) {
      if (this._batchMinIndex < Infinity) {
        this.recomputeAll(this._batchMinIndex);
      }
      // Zero mutations inside batch — skip recompute entirely
      this._batchMinIndex = Infinity;
    }
  }
}
```

Modify `recomputeAll` to defer when inside a batch, tracking the **minimum** dirty index:

```ts
recomputeAll(fromIndex: number = 1): void {
  if (this._batchDepth > 0) {
    this._batchMinIndex = Math.min(this._batchMinIndex, fromIndex);
    return; // deferred — but state array is still mutated immediately
  }
  // Reset stable state, completion buffer, recompute forward
  // ...existing logic unchanged
}
```

**Key invariant**: `mutateAtTurn` still writes to the state array immediately — only the forward simulation (recomputeAll) is deferred. The batch holds the minimum dirty index so the final flush recomputes from the earliest affected turn.

**Re-entrancy**: The `_batchDepth` counter handles nested `withBatch` calls correctly — inner batches defer to the outermost flush.

**Zero-mutation fast path**: If `_batchMinIndex` is still `Infinity` at flush time, skip the recompute entirely.

### Call sites to wrap

- `repackQueue` in commands.ts — wrap the queue-clear + re-insert loop
- `repackAllLanes` in commands.ts — wrap all 4 lane repacks
- Cascade removal loop in page.tsx — wrap the while loop that removes dependent items
- `replayCommands` in urlState.ts — wrap per planet (see PERF-002)

## Acceptance criteria

- [ ] `withBatch` exists on Timeline with correct re-entrancy (depth counter)
- [ ] `recomputeAll` is called exactly once after a batch regardless of how many mutations occurred inside
- [ ] The minimum dirty index is used for the flush (a mutation at T2 followed by T5 flushes from T2)
- [ ] Zero-mutation batch skips recompute entirely
- [ ] In development mode, `getStateAtTurn` inside a batch throws an assertion error
- [ ] Final state after batch is **identical** to the equivalent sequential non-batched mutations (add snapshot comparison test)
- [ ] `repackQueue` on a 10-item queue triggers exactly 1 `recomputeAll` call (verify via spy in Vitest)
- [ ] `repackAllLanes` triggers exactly 1 `recomputeAll` for all 4 lanes combined
- [ ] All existing tests pass unchanged
