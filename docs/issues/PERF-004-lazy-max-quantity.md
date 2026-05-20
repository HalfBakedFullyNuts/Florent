# PERF-004: Compute maxQuantity lazily via memoization, not per render

**Priority**: High  
**Complexity**: S  
**Estimated impact**: Eliminates ~56 validation calls per render for non-interactive entries  
**Files**: `src/app/page.tsx`, `src/components/QueueDisplay/TabbedLaneDisplay.tsx`

## Problem

`getMaxQuantity` (page.tsx ~line 2094) runs a binary search over [1, 10000] calling `canQueueItem` ~14 times per entry (ceil(log2(10000))). Each `canQueueItem` call validates prerequisites, resources, housing, and energy against the game state.

The binary search is called for every visible ship/colonist entry on every render — including renders triggered by unrelated state changes like `viewTurn` moving. With 4 entries visible at once, that's ~56 `canQueueItem` calls on every render cycle.

## Proposed solution

**Do not use `useEffect`** — this causes a one-frame flash where `+` is briefly enabled for entries already at their max, and a fast click before the effect runs bypasses the cap silently.

Instead, memoize in `TabbedLaneDisplay`, keyed by entry identity and relevant state:

```tsx
// In TabbedLaneDisplay, replace the per-render getMaxQuantity call:
const maxQuantities = useMemo(() => {
  if (!getMaxQuantity) return {};
  const result: Record<string, number> = {};
  for (const entry of nonCompletedEntries) {
    if (entry.isWait || entry.status === 'completed') continue;
    result[entry.id] = getMaxQuantity(activeTab, entry);
  }
  return result;
}, [nonCompletedEntries, getMaxQuantity, activeTab]);

// Then pass maxQuantities[entry.id] to each QueueLaneEntry
```

This means `getMaxQuantity` only re-runs when `nonCompletedEntries` or the callback itself changes — not on every unrelated state update.

**Cap at 1,000**: Reduce the binary search ceiling from 10,000 to 1,000 (~10 iterations instead of ~14). Before shipping, confirm against game data that no ship or colonist batch legitimately requires >1,000 units. If any does, raise the cap accordingly.

**Callback stability**: Ensure `getMaxQuantity` in page.tsx is wrapped in `useCallback` with correct dependencies so its reference is stable between renders. An unstable callback reference invalidates the `TabbedLaneDisplay` memo on every parent render, negating the benefit.

**`QueueLaneEntry` memo comparator**: The custom comparator already compares `maxQuantity` by value (not reference). No change needed there — the value passed in is now stable.

## Acceptance criteria

- [ ] `canQueueItem` is not called during renders where `nonCompletedEntries` has not changed
- [ ] `maxQuantity` cap confirmed against game data — document the confirmed safe cap value
- [ ] Stepper `+` button correctly disabled at cap synchronously on first render (no one-frame flash)
- [ ] `getMaxQuantity` in page.tsx has a stable `useCallback` reference — verify with React DevTools profiler that `TabbedLaneDisplay` does not re-render when only `viewTurn` changes
- [ ] Rapid stepper clicks still produce correct quantity values
- [ ] All existing tests pass
