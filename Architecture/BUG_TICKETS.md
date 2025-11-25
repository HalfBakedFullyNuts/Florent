# Bug Tickets

This document tracks bugs discovered in the turn-based simulator after the fixed 200-turn timeline refactoring.

---

## BUG-1: Turn Slider Allows Invalid Turn 0

**Priority**: High
**Effort**: 30 minutes
**Status**: ✅ FIXED
**Component**: TurnSlider
**Related Files**:
- `src/components/TurnSlider.tsx`

### Problem Statement

The turn slider and input field allow users to navigate to turn 0, which causes an "Invalid turn 0" error. The game's turn numbering starts from 1, but the UI components incorrectly allow 0 as a valid value.

**Current Behavior**:
- Slider has `min={0}` and `max={totalTurns - 1}` (lines 57-58)
- Input has `min={0}` and `max={totalTurns - 1}` (lines 45-46)
- Validation check allows turn 0: `value >= 0` (line 27)
- Display shows "Turn: 0 / 199" which is confusing

**Expected Behavior**:
- Turns should be 1-indexed (turn 1 through turn 200)
- Slider should have `min={1}` and `max={200}`
- Input should have `min={1}` and `max={200}`
- Display should show "Turn: 1 / 200"

### Root Cause

The TurnSlider component was implemented with 0-based indexing, but the game logic uses 1-based turn numbering throughout the codebase. The Timeline class and all game logic expect turns to start from 1.

### Technical Specification

Update `src/components/TurnSlider.tsx`:

```typescript
// Line 27 - Fix validation
if (!isNaN(value) && value >= 1 && value <= totalTurns) {
  onTurnChange(value);
}

// Lines 45-46 - Fix input bounds
min={1}
max={totalTurns}

// Line 50 - Fix display
<span className="text-pink-nebula-muted">
  / {totalTurns}
</span>

// Lines 57-58 - Fix slider bounds
min={1}
max={totalTurns}
```

### Acceptance Criteria

- [ ] Slider minimum value is 1, not 0
- [ ] Slider maximum value is 200 (totalTurns), not 199
- [ ] Input field accepts values 1-200, rejects 0
- [ ] Turn display shows "Turn: 1 / 200" format
- [ ] No "Invalid turn" errors when using slider
- [ ] Turn navigation works correctly from turn 1 to turn 200

### Testing Requirements

```typescript
describe('TurnSlider', () => {
  it('should not allow turn 0', () => {
    const onTurnChange = jest.fn();
    const { getByRole } = render(
      <TurnSlider currentTurn={1} totalTurns={200} onTurnChange={onTurnChange} />
    );

    const slider = getByRole('slider');
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('200');
  });

  it('should reject invalid turn 0 in input', () => {
    const onTurnChange = jest.fn();
    const { getByRole } = render(
      <TurnSlider currentTurn={1} totalTurns={200} onTurnChange={onTurnChange} />
    );

    const input = getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    expect(onTurnChange).not.toHaveBeenCalled();
  });
});
```

---

## BUG-2: Queue Item Removal Not Working

**Priority**: Critical
**Effort**: 2-3 hours
**Status**: ✅ FIXED
**Component**: Queue Management System
**Related Files**:
- `src/app/page.tsx` (handleCancelItem, TabbedLaneDisplay disabled prop)
- `src/lib/game/commands.ts` (cancelEntryByIdSmart)
- `src/lib/game/state.ts` (Timeline.mutateAtTurn)

### Problem Statement

Users cannot remove items from the planet queue after the fixed 200-turn timeline refactoring. Queue items show an inactive cursor and cannot be clicked.

**Current Behavior**:
- Queue items cannot be clicked (cursor shows as inactive)
- No confirmation mode is triggered
- Items remain in queue permanently

**Expected Behavior**:
- First click shows confirmation mode
- Second click removes item from queue
- Timeline recomputes from the removal point forward
- UI updates to show item removed
- User can continue adding/removing items freely

### Root Cause (Discovered)

The issue was in `src/app/page.tsx` line 394:

```typescript
<TabbedLaneDisplay
  disabled={viewTurn < totalTurns - 1}  // BUG: This disables queue for all turns except 199-200
/>
```

With `viewTurn=1` and `totalTurns=200`, this evaluates to `1 < 199 = true`, disabling all queue interactions.

This logic was incorrect - queue items should be editable from any turn in the fixed 200-turn timeline.

### Fix Applied

Changed `src/app/page.tsx` line 394:

```typescript
// Before (WRONG)
disabled={viewTurn < totalTurns - 1}

// After (CORRECT)
disabled={false}
```

Queue items are now clickable from any turn, allowing users to freely add, remove, and reorder items as intended.

### Investigation Points (Original Debug Plan)

1. **Controller Method**: Check if `cancelEntryByIdSmart` is finding and removing the item correctly
2. **Timeline Mutation**: Verify `Timeline.mutateAtTurn` properly applies the removal mutation
3. **Recomputation**: Ensure timeline recomputes all 200 turns after removal
4. **State Propagation**: Confirm the updated state reaches the UI components
5. **Entry ID Matching**: Verify the entry.id passed to cancel matches what's in the queue

### Potential Root Causes

1. **ID Mismatch**: Entry IDs might be regenerated during timeline recomputation, causing lookup failures
2. **Mutation Not Applied**: The mutation might not be persisting in the timeline states array
3. **Recomputation Issue**: Fixed 200-turn recomputation might be reverting the removal
4. **State Reference**: UI might be holding stale state reference after removal

### Debug Strategy

Add logging to trace the removal flow:

```typescript
// In handleCancelItem
console.log('Attempting to cancel:', { laneId, entryId: entry.id, turn: cancelTurn });

// In cancelEntryByIdSmart
console.log('Found entry to cancel:', foundEntry);
console.log('Mutation applied, lane after:', state.lanes[laneId]);

// In Timeline.mutateAtTurn
console.log('Before mutation:', this.states[index].lanes[laneId]);
mutation(this.states[index]);
console.log('After mutation:', this.states[index].lanes[laneId]);

// After recomputation
console.log('After recompute, turn state:', this.states[index].lanes[laneId]);
```

### Technical Specification

**Phase 1: Diagnose the Issue**

1. Add comprehensive logging throughout the cancellation flow
2. Test with a simple case: Queue one item, try to remove it
3. Identify exactly where the removal fails

**Phase 2: Fix Based on Diagnosis**

Potential fixes depending on root cause:

**If ID mismatch**:
```typescript
// Use stable IDs that survive recomputation
const stableId = `${itemId}_${queuedTurn}_${Date.now()}`;
```

**If mutation not persisting**:
```typescript
// Ensure deep clone before mutation
const mutableState = cloneState(this.states[index]);
mutation(mutableState);
this.states[index] = mutableState;
```

**If recomputation reverting**:
```typescript
// Save removal info before recompute
const removedItems = new Set<string>();
// Apply removals after each turn computation
```

### Acceptance Criteria

- [ ] Can remove any queued item with two-click confirmation
- [ ] Removed items disappear from UI immediately
- [ ] Timeline correctly recomputes without removed items
- [ ] Can remove items at any viewed turn
- [ ] Can remove active items (currently building)
- [ ] Can remove pending items (queued but not started)
- [ ] Multiple removals work without issues
- [ ] Can queue new items after removal

### Testing Requirements

```typescript
describe('Queue Removal After Fixed Timeline', () => {
  it('should remove items from queue', () => {
    const controller = new GameController();

    // Queue items
    controller.queueItem(1, 'metal_mine', 1);
    controller.queueItem(1, 'farm', 1);

    // Get initial queue state
    const beforeState = controller.getStateAtTurn(1);
    expect(beforeState.lanes.building.pendingQueue).toHaveLength(2);

    // Remove first item
    const result = controller.cancelEntryByIdSmart(1, 'building', 'metal_mine_id');
    expect(result.success).toBe(true);

    // Verify removal
    const afterState = controller.getStateAtTurn(1);
    expect(afterState.lanes.building.pendingQueue).toHaveLength(1);
    expect(afterState.lanes.building.pendingQueue[0].itemId).toBe('farm');
  });

  it('should handle removal with fixed 200-turn timeline', () => {
    const controller = new GameController();

    // Queue item that completes at turn 10
    controller.queueItem(1, 'metal_mine', 1);

    // Verify timeline has 200 turns
    expect(controller.getTotalTurns()).toBe(200);

    // Remove item
    const result = controller.cancelEntryByIdSmart(1, 'building', 'metal_mine_id');
    expect(result.success).toBe(true);

    // Timeline should still have 200 turns
    expect(controller.getTotalTurns()).toBe(200);

    // Item should not appear in any turn
    for (let turn = 1; turn <= 200; turn++) {
      const state = controller.getStateAtTurn(turn);
      expect(state.lanes.building.active?.itemId).not.toBe('metal_mine');
      expect(state.lanes.building.pendingQueue.find(e => e.itemId === 'metal_mine')).toBeUndefined();
    }
  });
});
```

### Implementation Priority

This is a **CRITICAL** bug as it breaks core queue management functionality. Users cannot correct mistakes or change their build order, which severely impacts gameplay.

**Recommended approach**:
1. Add debug logging first (30 min)
2. Identify root cause through testing (1 hour)
3. Implement targeted fix (1 hour)
4. Add comprehensive tests (30 min)

---

## Implementation Order

1. **BUG-1** (Turn Slider): Quick fix, low risk, improves UX immediately
2. **BUG-2** (Queue Removal): Critical functionality, requires careful debugging

Both bugs should be fixed before any new features are added, as they affect core gameplay mechanics.