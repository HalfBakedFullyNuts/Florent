# PERF-005: Reduce unnecessary re-renders during drag-over

**Priority**: Medium  
**Complexity**: S  
**Estimated impact**: Smoother drag UX; eliminates redundant setState calls at 60+ Hz  
**Files**: `src/components/QueueDisplay/TabbedLaneDisplay.tsx`

## Problem

The `onDragOver` handler in `TabbedLaneDisplay` fires 60+ times per second during a drag. Each event calls `setDragOverIndex`, triggering a React state update and full component re-render — even when the drag hasn't moved across an item boundary and the computed index hasn't changed.

## Solution: skip-unchanged guard first, rAF only if needed

**Step 1 (do this first):** Add an index-unchanged guard. This is a one-line change and covers 90% of the benefit:

```tsx
const onDragOver = useCallback((e: React.DragEvent, displayIndex: number) => {
  e.preventDefault();
  if (displayIndex === dragOverIndex) return; // skip redundant setState
  setDragOverIndex(displayIndex);
  // edge scroll logic unchanged
}, [dragOverIndex]);
```

**Step 2 (only if profiling shows the handler itself is still expensive):** Add a `requestAnimationFrame` throttle. Use a **separate ref** from the existing edge-scroll `rafRef` to avoid cross-contamination:

```tsx
const dragRafRef = useRef<number>(0);

const onDragOver = useCallback((e: React.DragEvent, displayIndex: number) => {
  e.preventDefault();
  // Edge scroll is NOT throttled — keep it responsive
  handleEdgeScroll(e);

  if (dragRafRef.current) return; // already scheduled
  dragRafRef.current = requestAnimationFrame(() => {
    dragRafRef.current = 0;
    setDragOverIndex((prev) => (prev === displayIndex ? prev : displayIndex));
  });
}, []);
```

**rAF cleanup on drag end/leave**: Cancel the pending rAF when `onDragLeave` or `onDrop` fires to prevent the callback executing after the drag ends and briefly setting a stale `dragOverIndex`:

```tsx
const onDragEnd = useCallback(() => {
  if (dragRafRef.current) {
    cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = 0;
  }
  setDragOverIndex(null);
  setDraggedItem(null);
}, []);
```

**Coordinate space**: The skip-unchanged comparison uses `displayIndex` (position in the rendered list), which is consistent with how `dragOverIndex` is consumed. Do not mix `displayIndex` and `actualIndex` in this comparison.

## Acceptance criteria

- [ ] `setDragOverIndex` is not called when the pointer hasn't crossed an entry boundary
- [ ] Drop accuracy is unaffected — items land in the correct queue position
- [ ] Edge scroll still activates promptly near container edges (not throttled)
- [ ] If rAF is added: `dragRafRef` is separate from the existing edge-scroll `rafRef`
- [ ] If rAF is added: the pending rAF is cancelled on `onDrop` and `onDragLeave`
- [ ] No visible flicker or incorrect drop-target highlight during drag
