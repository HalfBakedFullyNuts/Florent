# Queue Timeline Implementation Summary

**Date**: 2025-10-26
**Status**: Completed
**Related ADRs**: See ARCHITECTURAL_DECISIONS.md entries for 2025-10-26

## Overview

Implemented comprehensive queue timeline features including completion history tracking, continuous timeline display, same-turn building effects, and auto-advance to last building completion.

## Key Features Implemented

### 1. Completion History for Visual Persistence

**Problem**: Completed items disappeared from queues, making it difficult to track construction progress.

**Solution**: Added `completionHistory` array to `LaneState` to persist completed items.

**Files Modified**:
- `src/lib/sim/engine/types.ts` - Added `completionHistory: WorkItem[]` to LaneState (line 85)
- `src/lib/sim/defs/seed.ts` - Initialize empty history arrays (lines 133, 139, 145)
- `src/lib/sim/engine/lanes.ts` - Push completed items to history (line 119)
- `src/lib/game/selectors.ts` - Include history in getLaneView (lines 143-157)
- `src/components/QueueDisplay/CompactLaneEntry.tsx` - Muted styling for completed items (line 62)

**Visual Behavior**:
- Completed items remain visible with 60% opacity
- Muted border color (`border-pink-nebula-muted`)
- Checkmark icon (✓) instead of timer
- No cancel button for completed items

### 2. Turn Tracking Throughout WorkItem Lifecycle

**Problem**: Could not display accurate timelines for when items were queued, activated, and completed.

**Solution**: Added three timestamp fields to WorkItem lifecycle tracking.

**Files Modified**:
- `src/lib/sim/engine/types.ts` - Added `queuedTurn`, `startTurn`, `completionTurn` (lines 76-78)
- `src/lib/game/commands.ts` - Set `queuedTurn` when creating WorkItem (line 75)
- `src/lib/sim/engine/lanes.ts` - Set `startTurn` on activation (line 69), `completionTurn` on completion (line 118)
- `src/lib/game/selectors.ts` - Pass timing fields to UI (lines 154-156, 171-173, 189-191)

**Turn Lifecycle**:
```
queuedTurn:      When item is added to pending queue
startTurn:       When item activates from pending to active
completionTurn:  When item finishes (turnsRemaining reaches 0)
```

### 3. Same-Turn Building Completion

**Problem**: Building effects were applied the turn after completion, not on the completion turn itself.

**Solution**: Modified turn runner to apply building effects immediately when they complete.

**Files Modified**:
- `src/lib/sim/engine/turn.ts` - Separate same-turn vs next-turn completions (lines 34-57)

**Turn Sequence Change**:
```
BEFORE:
T5: Farm completes (turnsRemaining: 1→0)
T6: Effects applied (production increase visible)

AFTER:
T5: Farm completes (turnsRemaining: 1→0)
T5: Effects applied immediately (same turn)
T5: Resource output calculated with new building
```

**Implementation Details**:
- Buildings: Apply effects immediately (same turn)
- Ships: Enqueue for next-turn completion (existing behavior)
- Colonists: Apply conversions immediately (existing behavior)

### 4. Continuous Timeline Display

**Problem**: Pending items showed dynamic turn ranges that changed as you navigated turns, making it confusing to understand the build schedule.

**Solution**: Calculate projected continuous timeline for all pending items.

**Files Modified**:
- `src/lib/game/selectors.ts` - Calculate sequential time slots (lines 160-195)

**Timeline Calculation**:
```typescript
// Start from latest completion
let scheduleStart = 1; // Default T1

// If there are completed items, continue from last
if (lane.completionHistory.length > 0) {
  const lastCompleted = lane.completionHistory[lane.completionHistory.length - 1];
  scheduleStart = lastCompleted.completionTurn + 1;
}

// If there's an active item, start after it completes
if (lane.active && lane.active.completionTurn) {
  scheduleStart = lane.active.completionTurn + 1;
}

// Allocate continuous slots for pending items
for (pending item) {
  displayStart = scheduleStart;
  displayEnd = scheduleStart + duration - 1;
  scheduleStart = displayEnd + 1; // Next item starts immediately after
}
```

**Example Display** (4 farms queued at T1):
```
Farm 1: T1-T4   (4 turns)
Farm 2: T5-T8   (4 turns)
Farm 3: T9-T12  (4 turns)
Farm 4: T13-T16 (4 turns)
```

**Files Modified**:
- `src/components/QueueDisplay/CompactLaneEntry.tsx` - Use projected turns for display (lines 32-33)

### 5. Auto-Advance to Last Building Completion

**Problem**: Only the first building queued would advance the timeline. Subsequent buildings didn't update the view.

**Solution**: Calculate total duration of all buildings in queue and jump to when the last one completes.

**Files Modified**:
- `src/app/page.tsx` - Calculate last completion turn (lines 146-182)

**Algorithm**:
```typescript
// Calculate total duration
let totalDuration = 0;

// Add remaining time for active building
if (buildingLane.active) {
  totalDuration += buildingLane.active.turnsRemaining;
}

// Add duration for all pending buildings
for (const pending of buildingLane.pendingQueue) {
  totalDuration += pendingDef.durationTurns;
}

// Jump to when last building completes
const lastCompletionTurn = currentTurn + totalDuration;
setViewTurn(lastCompletionTurn);
```

**User Experience**:
- Queue 1st farm at T1 → View jumps to T5 (effects visible)
- Queue 2nd farm → View jumps to T9 (both farms complete)
- Queue 3rd farm → View jumps to T13 (all three complete)
- Queue 4th farm → View jumps to T17 (all four complete)

## Technical Architecture

### Data Flow

```
┌──────────────────┐
│  User Action     │
│  (Queue Item)    │
└────────┬─────────┘
         │
         v
┌──────────────────────────┐
│  GameController          │
│  queueItem()             │
│  - Creates WorkItem      │
│  - Sets queuedTurn       │
│  - Adds to pendingQueue  │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Turn Runner             │
│  - tryActivateNext()     │
│    Sets startTurn        │
│  - progressActive()      │
│    Sets completionTurn   │
│  - Immediate effects     │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Completion History      │
│  - Item added to history │
│  - Remains visible       │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Selector (getLaneView)  │
│  - Calculate projected   │
│    timeline slots        │
│  - Return all entries    │
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  UI Display              │
│  - CompactLaneEntry      │
│  - Shows T{start}-T{end} │
│  - Muted for completed   │
└──────────────────────────┘
```

### State Structure

```typescript
interface LaneState {
  pendingQueue: WorkItem[];      // Items waiting to activate
  active: WorkItem | null;        // Currently building item
  completionHistory: WorkItem[];  // Completed items (visual history)
  maxQueueDepth: number;          // Queue limit (10)
}

interface WorkItem {
  id: string;
  itemId: string;
  status: Status;
  quantity: number;
  turnsRemaining: number;
  queuedTurn?: number;       // When added to queue
  startTurn?: number;        // When activated
  completionTurn?: number;   // When finished
}
```

## Testing Considerations

### Unit Tests Needed

1. **Completion History**
   - Verify items are added to history on completion
   - Verify history persists across turns
   - Verify history ordering (most recent last)

2. **Turn Tracking**
   - Verify queuedTurn set on queue
   - Verify startTurn set on activation
   - Verify completionTurn set on completion

3. **Same-Turn Effects**
   - Verify building effects apply same turn
   - Verify resource outputs updated same turn
   - Verify ships still use next-turn buffer

4. **Timeline Calculation**
   - Verify continuous timeline for multiple items
   - Verify timeline continues from completed items
   - Verify timeline accounts for active items

5. **Auto-Advance**
   - Verify advance to last completion turn
   - Verify simulation of required turns
   - Verify multiple buildings advance correctly

### Integration Tests Needed

1. **Full Lifecycle**
   - Queue multiple items
   - Verify timeline display updates
   - Advance to completion
   - Verify items in history
   - Verify effects applied

2. **Performance**
   - Large queue (10 items)
   - Many completed items in history (50+)
   - Timeline calculation performance

## Known Limitations

1. **History Growth**: Completion history grows unbounded. Consider limiting to last N items or adding clear button.

2. **Memory Usage**: Storing full WorkItem objects in history uses more memory than just counts.

3. **Timeline Projection**: Only works for pending items; cannot project future items not yet queued.

4. **Auto-Advance**: Always jumps to last completion; no option to disable or customize behavior.

## Future Enhancements

1. **History Management**
   - Add "Clear History" button
   - Limit history to last 20 items
   - Group repeated items (e.g., "3x Farm")

2. **Timeline Visualization**
   - Add visual timeline bar showing all items
   - Show current turn marker on timeline
   - Click timeline to jump to turns

3. **Auto-Advance Options**
   - Settings toggle to enable/disable
   - Jump to "next interesting turn" instead of completion
   - Smooth animation when jumping

4. **Performance Optimization**
   - Virtualize long completion histories
   - Lazy load timeline calculations
   - Cache projected timelines

## Migration Notes

### Breaking Changes

- `LaneState` interface changed (added `completionHistory`)
- `WorkItem` interface changed (added turn tracking fields)
- Turn runner behavior changed (building effects timing)

### Backward Compatibility

- Old save states will fail to load (missing `completionHistory`)
- Need migration script or version bump
- Consider adding default values in seed/helpers

### Rollback Plan

1. Revert `turn.ts` changes (revert to next-turn completion)
2. Remove `completionHistory` from types
3. Remove turn tracking fields from WorkItem
4. Restore original selector logic
5. Restore original auto-advance logic

## Performance Impact

### Positive

- Timeline calculation done once in selector (memoized)
- No additional API calls or network requests
- History lookup is O(1) for adding items

### Negative

- Memory growth from unbounded history
- Larger state objects to serialize
- More complex selector logic

### Measurements Needed

- Memory usage with 100 completed items
- Timeline calculation time with 10 pending items
- Render performance with long history lists

## Related Documentation

- **ARCHITECTURAL_DECISIONS.md**: ADRs for 2025-10-26
- **UI_bug_fixes_and_improvements.md**: Original bug tickets (BUG-2, UI-5, etc.)
- **tickets.md**: Implementation tickets reference
