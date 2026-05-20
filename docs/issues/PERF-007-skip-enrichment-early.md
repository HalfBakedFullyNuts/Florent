# PERF-007: Stable reference returns from enrichment pipelines

**Priority**: Low  
**Complexity**: S–M  
**Estimated impact**: Minor standalone; meaningful if paired with selector memoization  
**Files**: `src/app/page.tsx`

## Problem

`enrichEntriesWithDelay` and `enrichEntriesWithValidation` always return a new array (via `.map()`), even when no entries were actually changed. This means downstream `useMemo` hooks that depend on enriched lane entries see a new reference on every call, invalidating their cache and causing unnecessary re-renders — even when the underlying data is identical.

**Secondary issue**: both functions are defined as `useCallback` hooks inside `page.tsx`, making them untestable as unit functions.

## Proposed solution

### 1. Return original reference when nothing changes

For `enrichEntriesWithDelay`:
```ts
const enrichEntriesWithDelay = useCallback(
  (entries: LaneEntry[]): LaneEntry[] => {
    if (!controller) return entries;
    if (!entries.some(e => e.resourceDelayed)) return entries; // stable ref fast path
    return entries.map((entry, i) => {
      // ...existing logic
    });
  },
  [controller],
);
```

For `enrichEntriesWithValidation`:
```ts
const enrichEntriesWithValidation = useCallback(
  (entries: LaneEntry[]): LaneEntry[] => {
    if (queueValidation.size === 0) return entries; // stable ref fast path
    return entries.map((entry) => {
      // ...existing logic
    });
  },
  [queueValidation],
);
```

**Contract**: Callers of these functions must treat the returned array as read-only. No sorting, splicing, or mutation of the returned array. The current callers (`enrichedLanes` useMemo) only spread and assign — this is safe, but must be documented.

### 2. Extract to pure functions for testability

Extract both callbacks to pure functions in `src/lib/game/selectors.ts` (or a new `src/lib/game/enrichment.ts`):

```ts
export function enrichWithDelay(entries: LaneEntry[], controller: GameController): LaneEntry[] { ... }
export function enrichWithValidation(entries: LaneEntry[], validation: Map<string, ValidationResult>): LaneEntry[] { ... }
```

Then wrap them in `useCallback` in page.tsx. This allows direct unit testing in Vitest without mounting the component.

### 3. Upstream note (out of scope for this ticket)

The full reference-stability benefit is limited by `getLaneView` / `getAdjustedLaneView` producing new entry objects on every call regardless of whether the underlying state changed. Properly memoizing the selector output would make this optimization significantly more effective — but that is a larger refactor tracked separately.

## Acceptance criteria

- [ ] `enrichEntriesWithDelay` returns the same array reference (via `Object.is`) when no entries have `resourceDelayed === true`
- [ ] `enrichEntriesWithValidation` returns the same array reference when `queueValidation.size === 0`
- [ ] Both pure functions extracted and unit-tested in Vitest (not just integration-tested through the component)
- [ ] Tests cover: all-non-delayed, some-delayed, all-delayed, empty array, and the validation-empty/non-empty transitions
- [ ] Callers in `enrichedLanes` useMemo documented as read-only consumers
- [ ] All existing tests pass
