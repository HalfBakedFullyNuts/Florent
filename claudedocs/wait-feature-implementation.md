# Wait Item Feature Implementation

## Overview

Implemented a "wait" functionality for all production lanes (Building, Ship, Colonist, Research) that allows users to pause lane activity for a specified number of turns before the next item activates.

## Feature Summary

**Purpose**: Allow strategic planning by intentionally pausing lanes for N turns

**Benefits**:
- Strategic timing control for production queues
- Better resource management
- Coordinated multi-lane operations

## Implementation Details

### 1. Data Model Changes

**WorkItem Type** (`src/lib/sim/engine/types.ts:81-91`):
- Added optional `isWait?: boolean` flag to identify wait items
- Wait items use `itemId: '__wait__'` as a special identifier
- Wait duration is stored in `turnsRemaining` field

### 2. Engine Implementation

**Lane Activation** (`src/lib/sim/engine/lanes.ts:14-118`):
- Wait items activate immediately without resource checks
- No resource deduction for wait items
- No worker/space reservation for wait items

**Lane Progression** (`src/lib/sim/engine/lanes.ts:125-215`):
- Wait items decrement turns like normal items
- No effects applied on completion
- No worker/space release (none were reserved)

**Validation**:
- Wait items bypass all validation checks
- Can be queued even with zero resources
- No prerequisites required

### 3. Commands API

**GameController.queueWaitItem()** (`src/lib/game/commands.ts:114-174`):
```typescript
queueWaitItem(turn: number, laneId: LaneId, waitTurns: number): QueueResult
```

**Parameters**:
- `turn`: Turn to queue the wait item
- `laneId`: Lane to add wait to (building, ship, colonist, research)
- `waitTurns`: Number of turns to wait (must be > 0)

**Returns**: QueueResult with success/failure status

**Cancel Handling** (`src/lib/game/commands.ts:229-233, 322-326`):
- Wait items can be canceled like normal items
- No resource refund (none were taken)
- Special handling to skip refund logic

### 4. UI Components

**WaitButton** (`src/components/ItemSelection/WaitButton.tsx`):
- Collapsible button showing ⏸️ icon
- Input field for specifying wait turns (default: 5)
- Keyboard shortcuts: Enter to queue, Escape to cancel

**ItemSelectionPanel Integration** (`src/components/ItemSelection/ItemSelectionPanel.tsx`):
- Wait button appears at top of each lane tab (except Research)
- Optional `onQueueWait` prop for handling wait queueing
- Positioned above item grid for easy access

**Selectors** (`src/lib/game/selectors.ts:204, 248, 274`):
- Wait items display as "Wait" in queue
- Duration uses turnsRemaining for proper scheduling
- Handled in pending, active, and completed views

### 5. Tests

**Comprehensive Test Coverage** (`src/lib/sim/engine/__tests__/wait.test.ts`):
- ✓ Wait item creation
- ✓ Queue integration
- ✓ Activation without resource deduction
- ✓ Progression and completion
- ✓ Multi-lane independence
- ✓ Queue integration (next item activates after wait)
- ✓ Edge cases (0 turns, very long durations)

**Test Results**: All 15 tests passing

## Usage

### For Users (UI)

1. Navigate to any lane tab (Structures, Ships, Colonists)
2. Click "Add Wait" button at top of items
3. Enter number of turns to wait (1-1000)
4. Click "Queue Wait" to add to queue

### For Developers (API)

```typescript
import { GameController } from '@/lib/game/commands';

const controller = new GameController(initialState);

// Queue a 10-turn wait in building lane
const result = controller.queueWaitItem(
  currentTurn,    // Turn to queue at
  'building',     // Lane ID
  10              // Wait turns
);

if (result.success) {
  console.log('Wait queued successfully:', result.itemId);
}
```

### Integration with Multi-Planet System

Wait items work seamlessly with the multi-planet system:
- Each planet has independent lanes
- Wait items are planet-specific
- No global coordination needed

## Files Modified

1. `src/lib/sim/engine/types.ts` - Added isWait flag to WorkItem
2. `src/lib/sim/engine/lanes.ts` - Handle wait activation and progression
3. `src/lib/game/commands.ts` - Added queueWaitItem method, updated cancel logic
4. `src/lib/game/selectors.ts` - Display wait items correctly
5. `src/components/ItemSelection/WaitButton.tsx` - New UI component
6. `src/components/ItemSelection/ItemSelectionPanel.tsx` - Integrated wait button

## Files Created

1. `src/lib/sim/engine/__tests__/wait.test.ts` - Comprehensive test suite
2. `src/components/ItemSelection/WaitButton.tsx` - Wait button component
3. `claudedocs/wait-feature-implementation.md` - This documentation

## Architecture Decisions

**Why use WorkItem instead of separate wait queue?**
- Maintains unified queue model
- Simpler implementation
- Easier to display in UI
- Follows existing patterns

**Why special-case handling instead of fake definitions?**
- Avoids polluting game_data.json
- Clear separation of concerns
- No confusion with real game items
- Easier to maintain

**Why exclude Research lane from UI?**
- Research works differently (global queue)
- Would need different implementation
- Can be added later if needed

## Future Enhancements

Potential improvements:
1. Research lane wait support (requires global queue handling)
2. Preset wait durations (quick buttons for 5, 10, 25 turns)
3. Visual indicator in queue (different color/icon)
4. Wait templates (save common wait patterns)
5. Multi-lane synchronized waits

## Testing Checklist

- [x] Wait items queue successfully
- [x] Wait items activate without resources
- [x] Wait items progress normally
- [x] Wait items complete correctly
- [x] Next item activates after wait
- [x] Multiple waits work in sequence
- [x] All lanes support wait independently
- [x] Cancel works for wait items
- [x] UI displays wait items correctly
- [x] Build passes without errors
