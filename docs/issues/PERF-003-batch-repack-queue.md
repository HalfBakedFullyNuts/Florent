# PERF-003: Single-pass repackQueue without per-item mutations

**Priority**: Hold — measure PERF-001 first  
**Complexity**: L  
**Estimated impact**: Marginal after PERF-001; meaningful only if repackQueue is still a bottleneck  
**Depends on**: PERF-001 (must be measured)  
**Files**: `src/lib/game/commands.ts`

## Problem

`repackQueue` (commands.ts line 761) currently:
1. Clears the queue via `mutateAtTurn` (1 recompute)
2. For each extracted item, scans forward with `canQueue` to find the earliest valid turn
3. Inserts auto-wait items via `queueWaitItem` (1 recompute each)
4. Re-queues the item via `queueItem` (1 recompute each)

With PERF-001 in place these recomputes collapse into 1. The residual cost is object allocation and function-call overhead from N `queueItem`/`queueWaitItem` calls, which is secondary.

**Do not implement until PERF-001 is shipped and the repack time is measured.** If repack is already fast enough after PERF-001, this ticket should be closed without action.

## Proposed solution (if PERF-001 is not sufficient)

Restructure into two phases that avoid the PERF-001 "no reads inside batch" constraint entirely:

**Phase 1 — Read-only validation pass** (before any mutation):
- Walk through extracted items using `getStateAtTurn` snapshots to find valid start turns
- Compute gap sizes and synthesise the auto-wait entries in memory
- Build the final `pendingQueue` array (items + auto-waits) with correct `id`, `turnsRemaining`, `isAutoWait`, `minStartTurn` fields
- Preserve original `id` per item (`preserveId`) — critical for `CommandHistory` seq-id → entryId mappings

**Phase 2 — Single write**:
- One `mutateAtTurn` that sets `pendingQueue` directly
- One `tryActivateNext` call after

```ts
repackQueue(turn, laneId): boolean {
  // Phase 1: read-only — all getStateAtTurn calls happen here
  const newQueue = buildRepackedQueue(turn, laneId, extractedItems, this.timeline);

  // Phase 2: single write — no reads permitted here
  this.timeline.mutateAtTurn(turn, (s) => {
    s.lanes[laneId].pendingQueue = newQueue;
  });
  this.tryActivateNext(turn, laneId);
  return true;
}
```

## Known limitations

- Phase 1 validates items against pre-mutation snapshots. It doesn't account for how resources change because of earlier items in the same repack (this is the same limitation as today — the batch model cannot see intra-batch resource effects).
- `cursorTurn` advancement logic is load-bearing for item sequencing and auto-wait placement. The in-memory Phase 1 implementation must replicate it exactly.

## Acceptance criteria

- [ ] PERF-001 has been shipped and repack time measured — this ticket is only opened if repack is still >200ms
- [ ] Queue ordering, auto-wait insertion, and `id` preservation are identical to current behavior (snapshot comparison on known queue)
- [ ] Single-item queue: Phase 2 single-write + `tryActivateNext` produces identical state to current path
- [ ] Items with `minStartTurn` constraints are preserved in Phase 1
- [ ] `CommandHistory` cancel/reorder operations work correctly after a repack (IDs survive)
- [ ] All existing tests pass
