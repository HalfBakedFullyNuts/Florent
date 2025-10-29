# Implementation Tickets for 4X MMORPG Turn-Based Strategy Simulator

## Current Bug Fixes

## CRITICAL-1) **Auto-Advance Conflict: Scientists Not Queueable After Building Auto-Advance**

**Summary**
After queueing buildings, the UI auto-advances to the completion turn (e.g., T20). However, scientists become un-clickable at this turn even when scientist housing exists (25k capacity displayed), preventing the user from queueing colonists.

**Root Cause**
The validation logic has two conflicting rules:

1. **Auto-advance for buildings** (src/app/page.tsx:146-183)
   - When a building is queued, UI jumps to `lastCompletionTurn` (e.g., T20)
   - This is when the building finishes and the building lane becomes idle

2. **"Viewing past turn" check** (src/app/page.tsx:72-73)
   ```tsx
   if (viewTurn < totalTurns - 1) {
     return { allowed: false, reason: 'Cannot queue while viewing past turn' };
   }
   ```
   - This blocks queueing unless you're at the LATEST simulated turn
   - If buildings complete at T20, but latest turn is T30, you're "viewing past" at T20

3. **"Lane is busy" check** (src/lib/game/selectors.ts:332-333)
   ```tsx
   if (lane.active) {
     return { allowed: false, reason: 'Lane is busy' };
   }
   ```
   - This blocks queueing if the colonist lane has an active item
   - But colonist lane might be busy training a scientist

**The Conflict**
- Building auto-advances to T20 (building lane idle)
- Latest simulated turn is T30
- User is now "viewing past turn" (20 < 30-1)
- Scientists blocked even though housing exists and colonist lane is idle

**Proposed Solution: Per-Lane Validation at ViewTurn**

This solution removes the global "viewing past turn" restriction and allows queueing when the specific lane is idle at the viewed turn.

### Implementation Steps

1. **Modify canQueueItem validation** (src/app/page.tsx:61-79)
```tsx
const canQueueItem = useCallback((itemId: string, quantity: number) => {
  if (!itemId) {
    return { allowed: false, reason: 'No item selected' };
  }

  const def = defs[itemId];
  if (!def) {
    return { allowed: false, reason: 'Unknown item' };
  }

  // REMOVED: Global "viewing past turn" check
  // OLD: if (viewTurn < totalTurns - 1) { return false; }

  // NEW: Get state at the viewed turn, not current turn
  const viewState = controller.getStateAtTurn(viewTurn);
  if (!viewState) {
    return { allowed: false, reason: 'Invalid turn' };
  }

  // Check if THIS SPECIFIC lane is available at viewed turn
  return validateQueueItem(viewState, itemId, quantity);
}, [defs, viewTurn, controller]);
```

2. **Modify handleQueueItem to queue at viewTurn** (src/app/page.tsx:135-192)
```tsx
const handleQueueItem = (itemId: string, quantity: number) => {
  setError(null);
  try {
    // NEW: Queue at viewTurn instead of currentTurn
    const result = controller.queueItem(viewTurn, itemId, quantity);
    if (!result.success) {
      setError(result.reason || 'Cannot queue item');
    } else {
      setStateVersion(prev => prev + 1);

      // Keep existing auto-advance logic for buildings
      const def = defs[itemId];
      if (def && def.lane === 'building') {
        // ... existing auto-advance calculation ...
        setViewTurn(lastCompletionTurn);
      }
      // Ships/colonists stay at current viewTurn
    }
  } catch (e) {
    console.error('Error in handleQueueItem:', e);
    setError((e as Error).message || 'Unknown error');
  }
};
```

3. **Ensure timeline consistency**
- The Timeline class already handles mutations at any turn
- Queueing at past turns is safe as long as the lane is idle

### Benefits
- Users can queue items wherever they're viewing
- Auto-advance for buildings still works
- Scientists become queueable when housing exists
- No complex multi-lane calculations needed

**Current Behavior**
```
T1: Queue Metal Mine (4T duration)
UI auto-advances to T5 (mine completes, building lane idle)
Try to queue Scientist → BLOCKED ("viewing past turn" if latest turn > T6)
```

**Desired Behavior**
```
T1: Queue Metal Mine (4T duration)
UI auto-advances to T5 (mine completes, building lane idle)
Try to queue Scientist → SUCCESS (colonist lane is idle at T5)
```

**Files Affected**
- `src/app/page.tsx` - Auto-advance logic (line 146-183), validation (line 72-73)
- `src/lib/game/selectors.ts` - Lane busy check (line 332-333)
- `src/lib/sim/engine/validation.ts` - Housing validation (line 57-77)

---

## CRITICAL-2) **Invalid Turn Error: Ships Throw "Invalid Turn 87" When Queueing**

**Summary**
When queueing ships (e.g., Outpost Ship) after building auto-advance has occurred, the game throws error "invalid turn 87" even though ships are unlocked and prerequisites are met.

**Root Cause**
Ships don't auto-advance like buildings do. The queueing flow is:

1. **Buildings auto-advance** (src/app/page.tsx:148-183)
   - User queues building at T1
   - UI jumps to T20 (building completes)
   - viewTurn = 20

2. **User queues ship at viewTurn=20**
   - Ship doesn't auto-advance (line 185-186)
   - Ship duration is calculated from T20
   - Ship completion would be T20 + 67T = T87

3. **Turn T87 doesn't exist yet**
   - Latest simulated turn might only be T30
   - Controller tries to access state at T87 → fails
   - Error: "Invalid turn 87"

**The Problem**
Ships/colonists need to be queued at `controller.getCurrentTurn()` (latest turn), not `viewTurn` (where user is viewing). But the queueing code uses `viewTurn`:

```tsx
// src/app/page.tsx:138
const currentTurn = controller.getCurrentTurn();
const result = controller.queueItem(currentTurn, itemId, quantity);
```

Wait, this looks correct! The issue must be elsewhere. Let me investigate further...

Actually, the problem is that ships/colonists DON'T auto-advance (line 185-186), so after queuing:
- viewTurn stays at 20
- But the ship's completion turn is calculated as T87
- When UI tries to display T87, it doesn't exist

**Proposed Solution: Auto-Simulate Required Turns**

This solution ensures that when queueing any item, enough turns are simulated to accommodate its completion.

### Implementation Steps

1. **Modify handleQueueItem to simulate turns for all lanes** (src/app/page.tsx:135-192)
```tsx
const handleQueueItem = (itemId: string, quantity: number) => {
  setError(null);
  try {
    // Queue at viewTurn (from CRITICAL-1 solution)
    const result = controller.queueItem(viewTurn, itemId, quantity);
    if (!result.success) {
      setError(result.reason || 'Cannot queue item');
    } else {
      setStateVersion(prev => prev + 1);

      const def = defs[itemId];
      if (!def) return;

      // Calculate when this item will complete
      const state = controller.getStateAtTurn(viewTurn);
      const lane = state.lanes[def.lane];

      // Calculate total duration in this lane
      let totalDuration = 0;
      if (lane.active) {
        totalDuration += lane.active.turnsRemaining;
      }
      for (const pending of lane.pendingQueue) {
        const pendingDef = defs[pending.itemId];
        if (pendingDef) {
          totalDuration += pendingDef.durationTurns;
        }
      }

      const completionTurn = viewTurn + totalDuration;

      // Ensure we have enough turns simulated
      const totalTurns = controller.getTotalTurns();
      if (completionTurn >= totalTurns) {
        const turnsToSimulate = completionTurn - totalTurns + 1;
        controller.simulateTurns(turnsToSimulate);
        setStateVersion(prev => prev + 1);
      }

      // Auto-advance only for buildings
      if (def.lane === 'building') {
        setViewTurn(completionTurn);
      }
      // Ships/colonists stay at viewTurn (no auto-advance)
    }
  } catch (e) {
    console.error('Error in handleQueueItem:', e);
    setError((e as Error).message || 'Unknown error');
  }
};
```

2. **Alternative: Limit Turn Display**
If simulating many turns is too expensive, clamp the display:
```tsx
// In getLaneView or display components
const safeViewTurn = Math.min(viewTurn, controller.getTotalTurns() - 1);
const state = controller.getStateAtTurn(safeViewTurn);
```

### Benefits
- Ships and colonists can be queued without "invalid turn" errors
- Turns are automatically simulated as needed
- No UI jumping for ships/colonists (they don't auto-advance)
- Performance impact is minimal (only simulate when needed)

**Current Behavior**
```
T1: Queue buildings → UI jumps to T20
T20: Queue Outpost Ship (67T duration)
Ship completion calculated as T87
Error: "Invalid turn 87" (turn doesn't exist)
```

**Desired Behavior**
```
T1: Queue buildings → UI jumps to T20
T20: Queue Outpost Ship (67T duration)
Ship queued successfully at T20
User can advance slider to see ship complete at T87
```

**Files Affected**
- `src/app/page.tsx` - Auto-advance logic (line 184-187), handleQueueItem
- `src/lib/game/commands.ts` - queueItem validation

---

## CRITICAL-3) **Ship/Colonist Removal Error: NOT_FOUND When Removing from Queue**

**Summary**
When removing ships or colonists from the queue, clicking the removal confirmation produces a "NOT_FOUND" error. This bug only affects ships and colonists - buildings can be removed successfully.

**Concrete Example of the Problem**
```
Step 1: Queue Metal Mine at T1 → UI auto-advances to T5 (completion)
Step 2: Queue Shipyard at T5 → UI auto-advances to T25 (completion)
Step 3: Queue Scout Ship at T25
   - Scout has 15 turn duration
   - Scout will complete at T40
   - UI stays at T25 (no auto-advance for ships)
Step 4: Try to remove Scout from queue
   - Click Scout → Shows "Remove Scout?" → Click confirm
   - ERROR: "NOT_FOUND"

Why it fails:
   - Scout was queued at T25 (entry.queuedTurn = 25)
   - Current removal logic tries to cancel at T25
   - But Scout is already "active" building at T25-T39
   - cancelEntryById(T25, 'ship', scout.id) can't find it in pendingQueue
```

**Root Cause: Timeline State Mismatch**

The core issue is that **where an item appears in the UI** doesn't match **where it exists in the game state**:

1. **UI Display Logic** (`getLaneView` in selectors.ts)
   - Shows items in continuous timeline (T1→T4→T8→T12...)
   - Calculates schedule based on lane's completion history
   - Display position is independent of queue turn

2. **Game State Logic** (`Timeline` in state.ts)
   - Items exist at specific turns in specific states
   - `pendingQueue`: Items waiting to start
   - `active`: Currently building item
   - `completionHistory`: Finished items

3. **The Mismatch**
   ```
   UI Shows:          Scout building T25-T39
   Actually At T25:   Scout is active (started building)
   Removal Looks At:  T25 pendingQueue (wrong place!)
   Result:            NOT_FOUND
   ```

4. **Why Buildings Work**
   - Buildings auto-advance UI to completion turn
   - User is viewing the turn where building just completed
   - `queuedTurn` is recent and item likely still cancelable
   - Even if completed, user sees it as completed (correct UX)

**Proposed Solution: Smart Cancellation Method**

Add a method that searches the timeline to find where an item actually exists, rather than assuming it's at queuedTurn.

### ✅ Option 1: Controller Method - Smart Cancellation (RECOMMENDED)

Add a new controller method that encapsulates the search logic:

```tsx
// In src/lib/game/commands.ts
/**
 * Cancel an entry by searching the timeline to find where it actually exists.
 * Handles the mismatch between queuedTurn and actual item location.
 */
cancelEntryByIdSmart(laneId: LaneId, entryId: string, startTurn: number): CancelResult {
  const totalTurns = this.getTotalTurns();

  // Quick check: Try the startTurn first (common case for buildings)
  const startState = this.timeline.getStateAtTurn(startTurn);
  if (startState) {
    const lane = startState.lanes[laneId];
    const inPending = lane.pendingQueue.some(item => item.id === entryId);
    const isActive = lane.active?.id === entryId;

    if (inPending || isActive) {
      return this.cancelEntryById(startTurn, laneId, entryId);
    }
  }

  // Not at startTurn, search forward (ships/colonists case)
  for (let turn = startTurn + 1; turn < totalTurns; turn++) {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) continue;

    const lane = state.lanes[laneId];
    const inPending = lane.pendingQueue.some(item => item.id === entryId);
    const isActive = lane.active?.id === entryId;

    if (inPending || isActive) {
      return this.cancelEntryById(turn, laneId, entryId);
    }

    // Stop searching if item is in completionHistory
    const inHistory = lane.completionHistory.some(item => item.id === entryId);
    if (inHistory) {
      return { success: false, reason: 'NOT_FOUND' }; // Can't cancel completed items
    }
  }

  return { success: false, reason: 'NOT_FOUND' };
}
```

**Usage in page.tsx:**
```tsx
const handleCancelItem = (laneId: 'building' | 'ship' | 'colonist', entry: any) => {
  setError(null);
  try {
    // Use smart cancellation that searches the timeline
    const result = controller.cancelEntryByIdSmart(
      laneId,
      entry.id,
      entry.queuedTurn || viewTurn
    );

    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        setError('Item cannot be canceled (may be completed)');
      } else {
        setError(result.reason || 'Cannot cancel item');
      }
    } else {
      setStateVersion(prev => prev + 1);
      // Stay at current view for better UX
      setViewTurn(viewTurn);
    }
  } catch (e) {
    setError((e as Error).message || 'Unknown error');
  }
};
```

**Why This Is Best:**
- ✅ **Clean separation**: Controller handles complexity, UI stays simple
- ✅ **Works for all lanes**: Buildings, ships, and colonists
- ✅ **No data model changes**: Uses existing WorkItem structure
- ✅ **Performance optimized**: Checks common case first, early exit on completion
- ✅ **Testable**: Can unit test the search logic independently

### ❌ Option 2: Track Activation Turn (Clean but Requires Migration)

Requires adding `activationTurn` to WorkItem type and migrating existing save data.

**Pros:** Direct lookup, no searching
**Cons:** Data migration required, breaks save compatibility

### ❌ Option 3: UI-Based Search (Quick but Messy)

Put the search logic directly in page.tsx handleCancelItem.

**Pros:** No controller changes
**Cons:** Mixes concerns, hard to test, duplicated logic

## Implementation Plan

### Step 1: Add Smart Cancellation Method
```typescript
// src/lib/game/commands.ts - Add after line 221
cancelEntryByIdSmart(laneId: LaneId, entryId: string, startTurn: number): CancelResult {
  // Implementation from Option 1 above
}
```

### Step 2: Update UI Handler
```typescript
// src/app/page.tsx - Replace lines 189-211
const handleCancelItem = (laneId: 'building' | 'ship' | 'colonist', entry: any) => {
  // Implementation from Option 1 usage above
};
```

### Step 3: Add Tests
```typescript
// src/lib/game/__tests__/auto-advance-queue.test.ts - Add new test cases
describe('Smart Cancellation', () => {
  it('should remove ship from queue when queued at different turn', () => {
    // Queue ship at T5
    // Verify ship is pending at T5
    // Cancel ship using smart method
    // Verify removal success
  });

  it('should remove active ship when building has started', () => {
    // Queue ship at T5
    // Advance to T10 (ship now active)
    // Cancel ship using smart method
    // Verify removal success and resource refund
  });

  it('should prevent removal of completed items', () => {
    // Queue ship at T5
    // Advance to T100 (ship completed)
    // Try to cancel ship
    // Verify failure with appropriate message
  });
});
```

## Edge Cases to Test

1. **Ship queued when lane is empty** → Should be in pendingQueue at queuedTurn
2. **Ship queued when lane is busy** → May be in pendingQueue for many turns
3. **Multiple ships queued** → Each has different activation timing
4. **Canceling during activation** → Should refund resources correctly
5. **Canceling after completion** → Should fail gracefully
6. **Turn slider at different positions** → Should work regardless of viewTurn

## Success Criteria

- ✅ Ships can be removed from queue without errors
- ✅ Colonists can be removed from queue without errors
- ✅ Buildings still remove correctly (regression test)
- ✅ Completed items cannot be removed (show appropriate error)
- ✅ Resources are refunded when canceling active items
- ✅ UI updates correctly after removal

**Current Behavior**
```
T1: Queue buildings → UI jumps to T5
T5: Queue Outpost Ship (67T duration)
Ship queued at T5, displayed schedule starts at T51 (if lane was busy)
User clicks remove → tries to cancel at T5
Error: "NOT_FOUND" (ship is active at T51, not in pendingQueue at T5)
```

**Desired Behavior**
```
T1: Queue buildings → UI jumps to T5
T5: Queue Outpost Ship (67T duration)
Ship queued at T5, displayed schedule starts at T51
User clicks remove → searches T5→T51 → finds ship active at T51
Ship successfully canceled, resources refunded, UI updates
```

**Files Affected**
- `src/lib/game/commands.ts` - Add cancelEntryByIdSmart method
- `src/app/page.tsx` - Update handleCancelItem to use smart cancellation
- `src/lib/game/__tests__/auto-advance-queue.test.ts` - Add removal tests

**Status**: ✅ **COMPLETED** - Smart cancellation implemented in commands.ts and page.tsx

---

## FEATURE-1) **Ship and Colonist Batching - Parallel Production System**

**Summary**
Enable parallel production of identical ships and colonists by allowing players to queue multiple units that build simultaneously. Resource costs and worker requirements scale linearly with quantity, but build time remains constant.

**Problem Statement**
Currently, building large fleets or colonist populations requires sequential queueing, creating excessive micromanagement and unrealistic time delays. A player needing 10 fighters must queue them one-by-one, taking 40 turns total, even with massive resource stockpiles.

**Current Behavior**
```
Scenario: Build 5 Freighters (8T duration each, 24k metal, 16k mineral)
T1:  Queue Freighter #1 → Costs 24k/16k, reserves workers
T9:  Complete #1 → Queue Freighter #2 → Costs 24k/16k
T17: Complete #2 → Queue Freighter #3 → Costs 24k/16k
T25: Complete #3 → Queue Freighter #4 → Costs 24k/16k
T33: Complete #4 → Queue Freighter #5 → Costs 24k/16k
T41: Complete #5
Total: 40 turns, 5 separate queue actions, constant micromanagement
```

**Desired Behavior**
```
Scenario: Build 5 Freighters (batched)
T1: Queue 5x Freighter → Costs 120k metal, 80k mineral, reserves 5x workers
T9: Complete all 5 Freighters simultaneously
Total: 8 turns, 1 queue action, strategic resource commitment
```

**Visual Queue Display**
```
Before (Sequential):          After (Batched):
┌─────────────────┐           ┌─────────────────┐
│ Ship Queue      │           │ Ship Queue      │
├─────────────────┤           ├─────────────────┤
│ T1-T8 Freighter │           │ T1-T8 5x Fighter│
│ ⏸ Freighter     │           │ T9-T25 3x Bomber│
│ ⏸ Freighter     │           │ ⏸ 10x Freighter │
│ ⏸ Freighter     │           └─────────────────┘
│ ⏸ Freighter     │
└─────────────────┘
```

**Strategic Implications**
1. **Resource Accumulation Strategy**: Players must save resources for large batches
2. **Worker Management**: Large batches require significant idle worker pools
3. **Risk vs Reward**: Committing to large batches locks resources but saves time
4. **Fleet Composition**: Trade-off between diverse small batches vs homogeneous large batches
5. **Economic Planning**: Batch sizes become a strategic economic decision

**Technical Requirements**
```
Resource Scaling:
- Linear cost multiplication: 5x units = 5x resources
- Resources checked and deducted at queue time
- 100% refund on cancellation (full resource recovery)

Worker Requirements:
- Workers reserved for entire batch during production
- Linear scaling: 5x units = 5x worker reservation
- Workers released only after batch completion
- 100% worker release on cancellation

Batch Size Limits:
- Configurable per item type (game designer decision)
- Default: No artificial limit beyond resource/worker availability
- Implementation supports any limit via configuration
```

**Implementation Architecture**

### Phase 1: Core Engine Support (Priority: HIGH)

**1.1 Validation Layer** (src/lib/sim/engine/validation.ts)
```typescript
export function canQueue(
  state: PlanetState,
  def: ItemDefinition,
  quantity: number
): CanQueueResult {
  // Buildings remain single-unit only
  if (def.lane === 'building' && quantity > 1) {
    return { allowed: false, reason: 'BUILDINGS_NO_BATCH' };
  }

  // Batch validation for ships/colonists
  if (def.lane === 'ship' || def.lane === 'colonist') {
    // Check batch size limits
    const maxBatch = getMaxBatchSize(def.id);
    if (quantity > maxBatch) {
      return { allowed: false, reason: 'BATCH_SIZE_EXCEEDED' };
    }

    // Calculate total resource requirements
    const totalCost = {
      metal: (def.costsPerUnit.metal || 0) * quantity,
      mineral: (def.costsPerUnit.mineral || 0) * quantity,
      food: (def.costsPerUnit.food || 0) * quantity,
      energy: (def.costsPerUnit.energy || 0) * quantity,
    };

    // Validate resource availability
    for (const [resource, cost] of Object.entries(totalCost)) {
      if (state.stocks[resource] < cost) {
        return {
          allowed: false,
          reason: 'INSUFFICIENT_RESOURCES',
          details: `Need ${cost} ${resource}, have ${state.stocks[resource]}`
        };
      }
    }

    // Validate worker availability
    const totalWorkers = (def.costsPerUnit.workers || 0) * quantity;
    if (totalWorkers > 0 && state.population.workersIdle < totalWorkers) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_WORKERS',
        details: `Need ${totalWorkers} workers, have ${state.population.workersIdle} idle`
      };
    }
  }

  return { allowed: true };
}

function getMaxBatchSize(itemId: string): number {
  // TODO: Load from game configuration
  // This should be configurable by game designers
  // For now, return a high default that's effectively unlimited
  const batchLimits = state.config?.batchLimits || {};
  return batchLimits[itemId] || 999;
}
```

**1.2 Activation Logic** (src/lib/sim/engine/lanes.ts)
```typescript
export function tryActivateLane(state: PlanetState, laneId: LaneId): void {
  const lane = state.lanes[laneId];

  // Skip if already active or no pending items
  if (lane.active || lane.pendingQueue.length === 0) return;

  const pending = lane.pendingQueue[0];
  const def = state.defs[pending.itemId];

  // Calculate batch requirements
  const quantity = pending.quantity || 1;
  const totalWorkers = (def.costsPerUnit.workers || 0) * quantity;
  const totalSpace = (def.costsPerUnit.space || 0) * quantity;

  // Check worker availability for batch
  if (totalWorkers > 0 && state.population.workersIdle < totalWorkers) {
    return; // Cannot activate batch - insufficient workers
  }

  // Check space for ships (orbital space)
  if (def.lane === 'ship' && totalSpace > 0) {
    const availableSpace = state.space.orbitalCap - state.space.orbitalUsed;
    if (availableSpace < totalSpace) {
      return; // Cannot activate batch - insufficient orbital space
    }
  }

  // Activate the batch
  lane.active = lane.pendingQueue.shift()!;

  // Reserve resources for batch
  if (totalWorkers > 0) {
    state.population.workersIdle -= totalWorkers;
    state.population.busyByLane[laneId] =
      (state.population.busyByLane[laneId] || 0) + totalWorkers;
  }

  if (totalSpace > 0) {
    state.space.orbitalUsed += totalSpace;
  }
}
```

**1.3 Completion Logic** (src/lib/sim/engine/completions.ts)
```typescript
export function processCompletion(
  state: PlanetState,
  item: WorkItem,
  laneId: LaneId
): void {
  const def = state.defs[item.itemId];
  const quantity = item.quantity || 1;

  // Add all units to completed counts
  state.completedCounts[item.itemId] =
    (state.completedCounts[item.itemId] || 0) + quantity;

  // Release batch workers
  const totalWorkers = (def.costsPerUnit.workers || 0) * quantity;
  if (totalWorkers > 0) {
    state.population.workersIdle += totalWorkers;
    state.population.busyByLane[laneId] =
      Math.max(0, (state.population.busyByLane[laneId] || 0) - totalWorkers);
  }

  // Apply production effects for batch
  if (def.effectsOnComplete) {
    for (const [key, value] of Object.entries(def.effectsOnComplete)) {
      // Scale production by quantity for colonists/ships
      if (def.lane !== 'building') {
        applyEffect(state, key, value * quantity);
      } else {
        applyEffect(state, key, value);
      }
    }
  }

  // Record completion in history
  state.lanes[laneId].completionHistory.push({
    ...item,
    completedAtTurn: state.turn
  });
}
```

### Phase 2: UI/UX Enhancements (Priority: MEDIUM)

**2.1 Queue Display Updates** (src/components/QueueDisplay/CompactLaneEntry.tsx)
```tsx
// Display quantity in queue entries
const displayName = entry.quantity > 1
  ? `${entry.quantity}x ${entry.name}`
  : entry.name;

// Visual indicator for batched items
const batchIcon = entry.quantity > 5 ? '📦' :
                  entry.quantity > 1 ? '🔢' : '';

// Progress bar shows batch progress
const progressLabel = entry.quantity > 1
  ? `${entry.quantity} units - ${turnsRemaining}T remaining`
  : `${turnsRemaining}T remaining`;
```

**2.2 Input Validation UI** (src/components/LaneBoard/ItemGrid.tsx)
```tsx
// Enhanced quantity selector with real-time validation
const [maxAffordable, setMaxAffordable] = useState(1);

useEffect(() => {
  const def = availableItems[batchingItem];
  if (!def) return;

  // Calculate max units player can afford
  const maxByMetal = Math.floor(stocks.metal / (def.costsPerUnit.metal || 1));
  const maxByMineral = Math.floor(stocks.mineral / (def.costsPerUnit.mineral || 1));
  const maxByWorkers = Math.floor(idleWorkers / (def.costsPerUnit.workers || 1));
  const maxByLimit = getMaxBatchSize(def.id);

  setMaxAffordable(Math.min(maxByMetal, maxByMineral, maxByWorkers, maxByLimit));
}, [batchingItem, stocks, idleWorkers]);

// Quick select buttons for common quantities
<div className="flex gap-2">
  <button onClick={() => setBatchQuantity(1)}>1x</button>
  <button onClick={() => setBatchQuantity(5)}>5x</button>
  <button onClick={() => setBatchQuantity(10)}>10x</button>
  <button onClick={() => setBatchQuantity(maxAffordable)}>Max</button>
</div>
```

### Phase 3: Advanced Features (Priority: LOW)

**3.1 Batch Cancellation**
```typescript
// Cancel entire batch with full refund
cancelBatch(itemId: string): CancelResult {
  const active = lane.active;
  if (active && active.id === itemId) {
    const quantity = active.quantity || 1;

    // 100% refund of all resources
    state.stocks.metal += def.costsPerUnit.metal * quantity;
    state.stocks.mineral += def.costsPerUnit.mineral * quantity;
    state.stocks.food += def.costsPerUnit.food * quantity;
    state.stocks.energy += def.costsPerUnit.energy * quantity;

    // Release all reserved workers
    const totalWorkers = def.costsPerUnit.workers * quantity;
    state.population.workersIdle += totalWorkers;
    state.population.busyByLane[laneId] -= totalWorkers;

    // Clear active slot
    lane.active = null;
    return { success: true };
  }
  return { success: false, reason: 'NOT_FOUND' };
}
```

**3.2 Auto-Batch Suggestions**
```typescript
// Suggest batch sizes based on available resources
function suggestBatchSize(def: ItemDefinition, state: PlanetState): number {
  const affordable = calculateMaxAffordable(def, state);
  const maxAllowed = getMaxBatchSize(def.id); // From config

  // Return what player can afford, up to configured max
  return Math.min(affordable, maxAllowed);
}
```

## Comprehensive Test Suite

```typescript
describe('Batching System', () => {
  describe('Validation', () => {
    it('prevents buildings from batching', () => {
      const result = controller.queueItem(turn, 'metal_mine', 3);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('BUILDINGS_NO_BATCH');
    });

    it('enforces configured batch limits', () => {
      // Assuming config sets fighter max to 20 (example)
      const configuredMax = getMaxBatchSize('fighter');
      const result = controller.queueItem(turn, 'fighter', configuredMax + 1);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('BATCH_SIZE_EXCEEDED');
    });

    it('validates total resource cost', () => {
      // Set resources to enough for 3 fighters but try to queue 5
      state.stocks.metal = 4500; // 3 * 1500
      const result = controller.queueItem(turn, 'fighter', 5);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('INSUFFICIENT_RESOURCES');
    });
  });

  describe('Activation', () => {
    it('reserves batch workers on activation', () => {
      controller.queueItem(turn, 'freighter', 3);
      const workersBefore = state.population.workersIdle;
      controller.nextTurn(); // Activate

      const expectedReserved = 3 * FREIGHTER_WORKERS;
      expect(state.population.workersIdle).toBe(workersBefore - expectedReserved);
      expect(state.population.busyByLane.ship).toBe(expectedReserved);
    });

    it('blocks activation if insufficient workers for batch', () => {
      state.population.workersIdle = 100;
      controller.queueItem(turn, 'scientist', 10); // Needs 250 workers
      controller.nextTurn();

      expect(state.lanes.colonist.active).toBeNull();
      expect(state.lanes.colonist.pendingQueue.length).toBe(1);
    });
  });

  describe('Completion', () => {
    it('adds full batch to completed counts', () => {
      controller.queueItem(turn, 'soldier', 20);
      controller.simulateTurns(5); // Duration + 1

      expect(state.completedCounts.soldier).toBe(20);
    });

    it('releases all batch workers on completion', () => {
      controller.queueItem(turn, 'bomber', 5);
      const workersBefore = state.population.workersIdle;

      controller.simulateTurns(1); // Activate
      expect(state.population.workersIdle).toBeLessThan(workersBefore);

      controller.simulateTurns(6); // Complete
      expect(state.population.workersIdle).toBe(workersBefore);
    });
  });

  describe('Display', () => {
    it('shows quantity in queue display', () => {
      controller.queueItem(turn, 'freighter', 8);
      const view = getLaneView(state, 'ship', turn);

      expect(view.entries[0].name).toBe('8x Freighter');
      expect(view.entries[0].quantity).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('handles batch of 1 correctly', () => {
      controller.queueItem(turn, 'cruiser', 1);
      const view = getLaneView(state, 'ship', turn);
      expect(view.entries[0].name).toBe('Cruiser'); // No "1x" prefix
    });

    it('handles cancellation of batched items with full refund', () => {
      const initialMetal = state.stocks.metal;
      controller.queueItem(turn, 'fighter', 10);
      // Resources deducted: 10 * 1500 = 15000 metal

      const result = controller.cancelEntryById(turn, 'ship', entryId);

      expect(result.success).toBe(true);
      // 100% refund - all resources returned
      expect(state.stocks.metal).toBe(initialMetal);
      expect(state.stocks.mineral).toBe(initialMineral);
    });

    it('handles mixed queue with batched and single items', () => {
      controller.queueItem(turn, 'fighter', 5);
      controller.queueItem(turn, 'bomber', 1);
      controller.queueItem(turn, 'frigate', 3);

      const view = getLaneView(state, 'ship', turn);
      expect(view.entries[0].name).toBe('5x Fighter');
      expect(view.entries[1].name).toBe('Bomber');
      expect(view.entries[2].name).toBe('3x Frigate');
    });
  });
});
```

## Migration & Compatibility

**Save Game Compatibility**
- WorkItem already has `quantity` field (defaults to 1)
- Existing saves will load with quantity=1 for all items
- No migration needed - backwards compatible

**Performance Considerations**
- Batch operations reduce state mutations (1 mutation vs N)
- UI updates less frequently (single batch vs multiple items)
- Reduced queue management overhead

**Status**: 📋 **READY FOR IMPLEMENTATION**

**Implementation Priority**:
1. ✅ Phase 1: Core engine support (Required)
2. ⚠️ Phase 2: UI/UX enhancements (Recommended)
3. 💡 Phase 3: Advanced features (Optional)

**Estimated Effort**:
- Phase 1: 4-6 hours
- Phase 2: 2-3 hours
- Phase 3: 2-3 hours
- Testing: 2-3 hours

---

## UI-9) **Queue Display Layout - Spacing and Height**

**Summary**
Improve the queue display lanes by reducing gaps between them and tripling the vertical space to show more queue items at once.

**Problem**
Currently, the queue display lanes have several layout issues:
- Large gaps between the three lanes (gap-4) wastes horizontal space
- Limited vertical height (max-h-[400px]) only shows a few items at a time
- Users need to scroll frequently to see their full queue
- The lanes appear disconnected from each other

**Requirements**

### 1. Tighter Horizontal Spacing
- Reduce gap between lanes from `gap-4` to `gap-2` or `gap-1`
- Keep lanes visually distinct but closer together
- Maintain the 3-column layout on desktop

### 2. Triple Vertical Space
- Increase max height from `max-h-[400px]` to `max-h-[1200px]`
- Allow approximately 3x more items to be visible without scrolling
- Ensure the queue area uses available vertical space effectively

### 3. Responsive Considerations
- Maintain appropriate height on different screen sizes
- Consider using viewport height units for better scaling
- Ensure mobile view still works properly

**Implementation Details**

```tsx
// Current (limited space):
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
  <div className="w-[280px] ... flex flex-col overflow-hidden">
    <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[400px]">

// Fixed (optimized space):
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
  <div className="w-[280px] ... flex flex-col overflow-hidden">
    <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[1200px]">
```

**Visual Comparison**
```
Before:
[Structure] ← gap-4 → [Ships] ← gap-4 → [Colonists]
├─ Item 1             ├─ Item 1        ├─ Item 1
├─ Item 2             ├─ Item 2        ├─ Item 2
├─ Item 3             └─ (scroll...)   └─ (scroll...)
└─ (scroll...)

After:
[Structure][Ships][Colonists] ← tighter gaps
├─ Item 1  ├─ Item 1  ├─ Item 1
├─ Item 2  ├─ Item 2  ├─ Item 2
├─ Item 3  ├─ Item 3  ├─ Item 3
├─ Item 4  ├─ Item 4  ├─ Item 4
├─ Item 5  ├─ Item 5  ├─ Item 5
├─ Item 6  ├─ Item 6  ├─ Item 6
├─ Item 7  ├─ Item 7  ├─ Item 7
├─ Item 8  ├─ Item 8  ├─ Item 8
├─ Item 9  ├─ Item 9  ├─ Item 9
└─ ...     └─ ...     └─ ...
```

**Alternative Implementation (Viewport-based)**
```tsx
// Using viewport height for better scaling
<div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[60vh] lg:max-h-[70vh]">
```

**Files to Modify**
* `src/components/QueueDisplay/CompactLane.tsx` - Update max-height in queue content area
* `src/app/page.tsx` - Update grid gap in lane queue display section

**Acceptance Criteria**
* Lanes are positioned closer together with reduced gaps
* Queue display shows approximately 3x more items without scrolling
* Vertical space usage is optimized for typical screen sizes
* Scrollbar only appears when queue exceeds the expanded height
* Layout remains responsive on different screen sizes
* Visual cohesion between the three lanes is improved

**Benefits**
* See more of the queue at once without scrolling
* Better overview of planned construction
* More efficient use of screen real estate
* Improved visual grouping of related UI elements
* Better user experience for complex build orders

**Status**
⏳ TODO - Ready for implementation

---

## UI-8) **Display Completed Structures List**

**Summary**
Replace the "Ships" section in the dashboard with a proper "Completed Structures" list showing all built structures with their quantities, resource outputs, and space usage.

**Problem**
Currently, there's a section that says "No ships built" which should instead show completed structures. The current display doesn't provide useful information about what structures have been completed and their effects on the economy.

**Requirements**

### Display Format
Each completed structure should be shown as:
```
[Name] x[quantity] +/-[Resource] +/-[Energy] -[Space]
```

Where:
- **Name**: Structure name (e.g., "Metal Mine")
- **x[quantity]**: Number built (e.g., "x3")
- **+/-[Resource]**: Net resource production/consumption per turn
  - Format: "+500M" for metal production, "-200Min" for mineral consumption
  - Show all non-zero resources (Metal, Mineral, Food)
- **+/-[Energy]**: Energy production/consumption
  - Format: "+50E" for production, "-30E" for consumption
- **-[Space]**: Space used
  - Format: "-2GS" for ground space, "-3OS" for orbital space

### Examples
```
Completed Structures:
Metal Mine x3 +600M -30E -3GS
Solar Generator x2 +60E -2GS
Farm x1 +100F -10E -1GS
Launch Site x1 -1OS
```

### Special Cases
- If no structures completed: Show "No structures built"
- Outpost (starting structure) should be included
- Only show non-zero values (don't show "+0M" or "-0E")
- Group identical structures (show quantity rather than listing separately)

**Implementation Details**

```typescript
// Format structure entry
const formatStructureEntry = (structureId: string, count: number, def: ItemDefinition) => {
  const parts = [`${def.name} x${count}`];

  // Add resource outputs
  if (def.outputsPerTurn?.metal) parts.push(`+${def.outputsPerTurn.metal}M`);
  if (def.outputsPerTurn?.mineral) parts.push(`+${def.outputsPerTurn.mineral}Min`);
  if (def.outputsPerTurn?.food) parts.push(`+${def.outputsPerTurn.food}F`);

  // Add resource consumption
  if (def.consumesPerTurn?.metal) parts.push(`-${def.consumesPerTurn.metal}M`);
  if (def.consumesPerTurn?.mineral) parts.push(`-${def.consumesPerTurn.mineral}Min`);
  if (def.consumesPerTurn?.food) parts.push(`-${def.consumesPerTurn.food}F`);

  // Add energy
  if (def.outputsPerTurn?.energy > 0) parts.push(`+${def.outputsPerTurn.energy}E`);
  if (def.consumesPerTurn?.energy > 0) parts.push(`-${def.consumesPerTurn.energy}E`);

  // Add space usage
  if (def.groundSpace) parts.push(`-${def.groundSpace}GS`);
  if (def.orbitalSpace) parts.push(`-${def.orbitalSpace}OS`);

  return parts.join(' ');
};
```

**Files to Modify**
* `src/components/PlanetDashboard.tsx` or relevant dashboard component
* Possibly `src/lib/game/selectors.ts` to add a selector for completed structures

**Acceptance Criteria**
* Section title changes from "Ships" to "Completed Structures"
* All completed structures are listed with correct format
* Quantities are grouped (e.g., "Metal Mine x3" not three separate entries)
* Resource outputs and consumption are correctly displayed
* Energy production/consumption is shown
* Space usage is shown with GS/OS abbreviations
* Empty state shows "No structures built"
* Outpost is included in the list

**Benefits**
* Clear overview of economic infrastructure
* Easy to see resource production at a glance
* Shows space utilization
* Better strategic planning information

**Status**
⏳ TODO - Ready for implementation

---

## UI-7) **Queue Items Grid Layout and Alignment**

**Summary**
Fix the queue items selection grid to be left-aligned with proper padding and ensure items have sufficient width to display all information on a single line.

**Problem**
Currently, the queue items grid has several layout issues:
- Grid is center-aligned with `mx-auto` causing it to float in the middle of the page
- Item containers have `max-w-[280px]` constraint that causes text wrapping
- Item names and resource costs get cut off or wrap to multiple lines
- Inconsistent spacing from the left edge of the page

**Requirements**

### 1. Left Alignment
- Remove `mx-auto` centering from the grid container
- Add consistent left padding (e.g., `pl-6` or `pl-8`)
- Align with other page content for visual consistency

### 2. Item Width
- Remove `max-w-[280px]` constraint on item containers
- Set appropriate minimum width to prevent text wrapping
- Ensure all item information displays on a single line:
  - Item name (e.g., "Strip Mineral Extractor")
  - Duration (e.g., "⏱️ 24T")
  - All resource costs (e.g., "M:360000 M:48000 W:200000 S:6")

### 3. Responsive Behavior
- Maintain 3-column layout on desktop (lg breakpoint)
- Allow columns to have flexible width based on content
- Ensure proper spacing between columns with gap

**Implementation Details**

```tsx
// Current (problematic):
<div className="hidden lg:grid lg:grid-cols-3 gap-4 max-w-[900px] mx-auto">
  <div className="bg-pink-nebula-panel rounded-lg border-2 border-blue-400 p-4 max-w-[280px]">

// Fixed:
<div className="hidden lg:grid lg:grid-cols-3 gap-6 pl-6">
  <div className="bg-pink-nebula-panel rounded-lg border-2 border-blue-400 p-4 min-w-[350px]">
```

**Visual Example**
```
Before (centered, cramped):
         [Structures] [Ships] [Colonists]

After (left-aligned, spacious):
[Structures]              [Ships]                  [Colonists]
Strip Mineral Extractor ⏱️ 24T M:360000 M:48000 W:200000 S:6
```

**Files to Modify**
* `src/components/LaneBoard/ItemGrid.tsx` - Update grid container and column styling

**Acceptance Criteria**
* Queue items grid is left-aligned with consistent padding
* All item information displays on a single line without wrapping
* Item names are fully visible without truncation
* Resource costs are fully visible and properly spaced
* Grid maintains proper responsive behavior on different screen sizes
* Visual alignment matches other page elements

**Benefits**
* Better readability of item information
* More professional and organized appearance
* Easier to scan and compare items
* Consistent page layout and alignment

**Status**
⏳ TODO - Ready for implementation

---

## UI-6) **Sort Queue Items by Duration and Name**

**Summary**
Sort items in the "Queue Items" selection grid by construction duration (ascending) as primary sort, then alphabetically by name as secondary sort.

**Problem**
Currently, items in the queue selection grid appear in an unorganized order, making it difficult for players to quickly find items based on how long they take to build. Players often want to queue quick-building items first or need to find items with specific build times.

**Requirements**

### Sorting Logic
1. **Primary Sort**: Duration in turns (ascending - shortest first)
   - Items that take 4 turns appear before items that take 6 turns
   - Items that take 6 turns appear before items that take 8 turns, etc.

2. **Secondary Sort**: Alphabetical by item name (A-Z)
   - Within items that have the same duration
   - Example: For items that all take 8 turns, sort alphabetically

3. **Apply to All Lanes**:
   - Structures queue items
   - Ships queue items
   - Colonists queue items

**Example Sort Order**
```
Structures (sorted):
- Farm (4T)               <- 4 turns, alphabetically first
- Metal Mine (4T)         <- 4 turns, alphabetically second
- Mineral Extractor (4T)  <- 4 turns, alphabetically third
- Solar Generator (4T)    <- 4 turns, alphabetically fourth
- Habitat (6T)            <- 6 turns, alphabetically first
- Living Quarters (6T)    <- 6 turns, alphabetically second
- Core Metal Mine (8T)    <- 8 turns, alphabetically first
- Launch Site (8T)        <- 8 turns, alphabetically second
... etc
```

**Implementation Details**

```typescript
// In ItemGrid.tsx or where items are prepared for display
const sortedItems = useMemo(() => {
  return Object.values(availableItems)
    .filter(item => item.lane === laneId && !EXCLUDED_ITEMS.includes(item.id))
    .sort((a, b) => {
      // Primary sort: duration (ascending)
      if (a.durationTurns !== b.durationTurns) {
        return a.durationTurns - b.durationTurns;
      }
      // Secondary sort: name (alphabetical)
      return a.name.localeCompare(b.name);
    });
}, [availableItems, laneId]);
```

**Files to Modify**
* `src/components/LaneBoard/ItemGrid.tsx` - Add sorting logic to itemsByLane computation

**Acceptance Criteria**
* Items in each queue (Structures, Ships, Colonists) are sorted by duration first
* Items with same duration are sorted alphabetically by name
* Shortest duration items appear at the top of each list
* Sort order updates correctly if new items become available
* Sort is stable and consistent across re-renders

**Benefits**
* Players can quickly find fast-building items at the top
* Easier to plan build orders based on timing
* More predictable item location in the grid
* Better user experience when selecting items to queue

**Status**
⏳ TODO - Ready for implementation

---

## UI-5) **Auto-Advance to Completion & Queue Timeline Visualization**

**Summary**
Implement auto-advance to building completion and add visual timeline indicators to show current turn position and active items in the queue display.

**Problem**
Currently, when queueing buildings, the player must manually advance turns to see completion. The queue display doesn't clearly show:
- Which turn the player is currently viewing
- Which items are actively being processed at the current turn
- The historical context of the queue timeline

**Requirements**

### 1. Auto-Advance Behavior
- **Buildings Only**: When queueing a structure, automatically advance the view to the turn when it completes
  - Example: Queue Farm at T1 → Auto-advance view to T5 (completion turn + 1)
- **Ships/Colonists**: Do NOT auto-advance for these lanes (maintain current turn)
- **Empty Queue Detection**: The existing `findNextEmptyQueueTurn` logic should be modified to find completion turn instead

### 2. Queue Timeline Visualization
- **Turn Position Indicator**: Add a horizontal pink line across all lane queues showing current view turn
  - Line should be positioned relative to the queue timeline
  - Shows even when queue is empty
  - Styled with pink-nebula accent color
- **Active Item Highlighting**: Items actively processing at the current view turn should be highlighted
  - Different visual treatment from pending/completed items
  - Apply to all lanes (buildings, ships, colonists)

### 3. Historical Queue Preservation
- Queue display should show ALL items (past, present, future) relative to current view turn
- Items before current turn: Show as completed (grayed out or different style)
- Items at current turn: Show as active (highlighted)
- Items after current turn: Show as pending (normal style)

**Implementation Details**

```typescript
// Modified auto-advance logic in handleQueueItem
if (laneId === 'building') {
  // Calculate completion turn
  const completionTurn = currentTurn + def.durationTurns;
  // Advance to turn after completion (when item disappears)
  setViewTurn(completionTurn + 1);
} else {
  // Ships/Colonists: stay at current turn
  setViewTurn(viewTurn);
}
```

```tsx
// Queue Timeline Component additions
<div className="queue-timeline">
  {entries.map((entry) => (
    <QueueEntry
      isActive={entry.startTurn <= viewTurn && entry.endTurn >= viewTurn}
      isPast={entry.endTurn < viewTurn}
      isFuture={entry.startTurn > viewTurn}
    />
  ))}
  <div
    className="current-turn-indicator"
    style={{
      position: 'absolute',
      top: calculatePositionForTurn(viewTurn),
      borderTop: '2px solid var(--pink-nebula-accent-primary)'
    }}
  />
</div>
```

**Files to Modify**
* `src/app/page.tsx` - Modify handleQueueItem to auto-advance for buildings only
* `src/components/QueueDisplay/CompactLane.tsx` - Add timeline visualization
* `src/components/QueueDisplay/CompactLaneEntry.tsx` - Add active/past/future styling
* Possibly new component: `src/components/QueueDisplay/QueueTimeline.tsx`

**Acceptance Criteria**
* Queueing a building auto-advances view to completion turn + 1
* Queueing ships/colonists does NOT change current view turn
* Pink horizontal line shows current turn position across all queues
* Active items at current turn are visually highlighted
* Historical queue items remain visible with different styling
* Timeline visualization works correctly when scrolling through turns
* Empty queues still show the turn position indicator line

**Visual Example**
```
Turn 5 (viewing)
┌─────────────────┐
│ Structures      │
├─────────────────┤
│ T1-T4 Farm ✓    │ <- Completed (grayed)
│ ───────────────│ <- Current turn line (pink)
│ T5-T8 Mine ⏸4  │ <- Future (normal)
└─────────────────┘
```

**Status**
⏳ TODO - Ready for implementation

---

## BUG-2) **Queue Display Turn Range Format**

**Summary**
Fix the queue display text to show correct turn ranges and ensure the game starts at T1 instead of T0.

**Problem**
Currently, the queue display shows incorrect turn information:
- Game starts at T0 instead of T1
- Queue text format shows "Tx-Ty Item Z" where Tx and Ty don't properly represent activation and completion turns
- A Farm queued at T1 should show "T1-T4 Farm ⏸4" but the current format is inconsistent

**Requirements**
1. Game should start at Turn 1 (T1) instead of Turn 0 (T0)
2. Queue display format should be: "T[activation]-T[completion] [ItemName] [icon][remaining]"
   - Tx = Turn when the item becomes active (starts processing)
   - Ty = Turn when the item completes (finishes and applies effects)
   - Icon: ⏸ for pending, ⏳ for active
   - Remaining: Number of turns remaining
3. Item should disappear from queue on turn Ty+1 (after completion)

**Example**
- Start game at T1
- Queue a Farm (4 turn duration)
- Display should show: "T1-T4 Farm ⏸4" (pending, will activate T1, complete T4)
- At T1: "T1-T4 Farm ⏳4" (now active, 4 turns remaining)
- At T2: "T1-T4 Farm ⏳3" (active, 3 turns remaining)
- At T3: "T1-T4 Farm ⏳2" (active, 2 turns remaining)
- At T4: "T1-T4 Farm ⏳1" (active, 1 turn remaining)
- At T5: Item disappears (completed at end of T4)

**Files to Modify**
* `src/lib/sim/defs/seed.ts` - Update initial state to start at turn 1
* `src/components/QueueDisplay/CompactLaneEntry.tsx` - Fix turn range display format
* `src/app/page.tsx` - Initialize viewTurn to 1 instead of 0

**Acceptance Criteria**
* Game starts at T1 when first loaded
* Queue entries show correct "T[activation]-T[completion]" format
* Pending items show ⏸ icon with total duration
* Active items show ⏳ icon with remaining turns
* Items complete and disappear at the correct turn

**Status**
⏳ TODO - Ready for implementation

---

## BUG-1) **ItemGrid Click Handler Fix**

**Summary**
Fix issue where items in queue selection grid cannot be clicked due to incorrectly disabled buttons.

**Problem**
The ItemGrid component disables buttons when items don't meet prerequisites, but the `disabled` attribute prevents the `onClick` handler from firing entirely. This blocks all user interaction including valid error messaging.

**Root Cause**
- `disabled={!queueable}` attribute on button elements prevents click events
- When validation fails for any reason (prerequisites, energy, lane busy), button becomes unclickable
- Users can't receive feedback about why an item can't be queued

**Solution**
Remove the `disabled` attribute from buttons while keeping the visual styling that indicates disabled state. This allows:
- Click events to fire for all items
- Validation to run in `handleItemClick`
- Error messages to display explaining why item can't be queued
- Visual styling (opacity, cursor) to still indicate disabled state

**Files to Modify**
* `src/components/LaneBoard/ItemGrid.tsx` - Remove `disabled` attribute from button elements

**Implementation Details**
```typescript
// Before (broken):
<button
  disabled={!queueable}  // This prevents onClick from firing
  onClick={() => handleItemClick(item.id, laneId)}
  className={...}
>

// After (fixed):
<button
  onClick={() => handleItemClick(item.id, laneId)}  // Always clickable
  className={queueable ? 'normal-styles' : 'disabled-styles'}  // Visual only
>
```

**Acceptance Criteria**
* All items in grid are clickable regardless of validation state
* Clicking invalid items shows appropriate error message
* Visual styling still indicates which items are disabled
* Error messages explain specific reason (REQ_MISSING, Lane is busy, etc.)

**Status**
✅ COMPLETED - Fixed by removing `disabled` attribute while keeping visual styling

---

### Ticket 22: Fix inline quantity selection in "Add to Queue" section
**Priority**: High
**Status**: Not Started
**Phase**: UI Enhancement
**Estimated Effort**: 2-3 hours

**Problem**:
The quantity selector for ships and colonists in the "Add to Queue" section (TabbedItemGrid) appears below the item grid instead of inline when clicking an item. This creates a disconnected user experience compared to the inline remove button in Planet Queue.

**Current Behavior**:
- User clicks on a ship/colonist in "Add to Queue"
- Quantity selector appears below the grid (disconnected from the item)
- User must look away from the item to adjust quantity

**Expected Behavior**:
- User clicks on a ship/colonist in "Add to Queue"
- Quantity selector appears inline with the item (similar to how the quantity input works in Planet Queue from Ticket 21)
- User can adjust quantity immediately without losing visual context
- Structures continue to queue with quantity=1 (no inline selector for structures)

**Critical Requirements to Preserve Existing Functionality**:
1. **DO NOT break structure queueing** - Structures must continue to work with single quantity
2. **DO NOT affect Planet Queue inline editing** - The quantity editing in Planet Queue (Ticket 21) must continue working
3. **DO NOT change validation logic** - Use existing `canQueueItem` and `getMaxQuantity` from page.tsx
4. **DO NOT affect auto-advance** - Buildings must still auto-advance, ships/colonists must not

**Acceptance Criteria**:
1. When clicking a ship or colonist button in TabbedItemGrid:
   - An inline quantity input appears within the button (like Planet Queue)
   - Input has same styling as Planet Queue inputs (w-14, text-xs, pink-nebula theme)
   - Default value is 1
2. When clicking a structure button:
   - NO inline input appears (structures remain single-quantity)
   - Item queues immediately with quantity=1
3. Quantity validation:
   - Uses existing `getMaxQuantity` logic from page.tsx
   - Binary search to find maximum affordable quantity
   - Clamps to [1, maxQuantity] range
4. User interactions:
   - Enter key: Queue item with entered quantity
   - Escape key: Cancel without queueing, hide input
   - Click outside: Queue with current quantity value
   - Tab key: Move focus appropriately
5. State management:
   - Only one item can be in "edit mode" at a time
   - Clicking another item cancels the previous edit
   - Visual feedback shows which item is being configured

**Implementation Strategy**:
```typescript
// In TabbedItemGrid.tsx
const [editingItem, setEditingItem] = useState<string | null>(null);
const [quantityValue, setQuantityValue] = useState('1');

const handleItemClick = (itemId: string, laneId: string) => {
  if (laneId === 'building') {
    // Structures: queue immediately with quantity=1
    onQueueItem(itemId, 1);
  } else {
    // Ships/Colonists: show inline quantity input
    if (editingItem === itemId) {
      // If clicking same item, queue with current quantity
      const qty = parseInt(quantityValue) || 1;
      onQueueItem(itemId, qty);
      setEditingItem(null);
    } else {
      // Show quantity input for this item
      setEditingItem(itemId);
      setQuantityValue('1');
    }
  }
};
```

**Files to Modify**:
- `src/components/LaneBoard/TabbedItemGrid.tsx` - Add inline quantity selection
- NO changes to `src/app/page.tsx` - Reuse existing validation logic
- NO changes to `src/components/QueueDisplay/QueueLaneEntry.tsx` - Keep Planet Queue working

**Regression Test Checklist**:
- [ ] Structures queue with quantity=1 (no input shown)
- [ ] Ships show inline quantity input
- [ ] Colonists show inline quantity input
- [ ] Planet Queue quantity editing still works (from Ticket 21)
- [ ] Structure removal still works
- [ ] Ship/colonist removal still works (with smart cancellation)
- [ ] Auto-advance works for structures only
- [ ] Validation prevents over-queueing based on resources/workers
- [ ] Worker growth still respects housing cap (from Ticket 20)

---

### Ticket 23: Fix structure removal "Invalid turn" error and re-calculation
**Priority**: Critical
**Status**: Not Started
**Phase**: Bug Fix (Regression)
**Estimated Effort**: 2-4 hours

**Problem**:
Removing structures from the middle of the queue in Planet Queue's Structures lane shows "Invalid turn" error. This is a regression from recent changes (likely related to ship/colonist cancellation logic or view turn handling). The cancellation logic must properly handle timeline re-calculation when items are removed from the middle of the queue.

**Current Behavior**:
- User clicks to remove a structure from the Structures lane in Planet Queue
- Error message appears: "Invalid turn"
- Item is not removed
- Queue is not recalculated

**Expected Behavior**:
- User clicks to remove a structure from any position in the queue
- Item is immediately removed
- Queue completion times are recalculated for all subsequent items
- View turn adjusts if necessary (if viewing a turn affected by the removal)
- No error message appears

**Root Cause Analysis Required**:
1. Check if `handleCancelItem` in `page.tsx:189-213` is correctly handling structures lane
2. Verify `controller.cancelEntryByIdSmart()` works for all lane types
3. Ensure `viewTurn` is valid when calling cancellation
4. Check if recent changes to cancellation logic for ships/colonists broke structures

**Acceptance Criteria**:
1. User can remove any structure from any position in the Structures queue without errors
2. Removing an item from the middle triggers proper recalculation:
   - Subsequent items' completion times adjust correctly
   - Turn timeline remains consistent
   - No orphaned queue entries
3. Removing the active (first) item works correctly
4. Removing the last item in queue works correctly
5. UI updates immediately to reflect the removal
6. No "Invalid turn" or other error messages appear
7. View turn remains valid after removal (adjusts if necessary)

**Technical Investigation Steps**:
1. Review `handleCancelItem` in `src/app/page.tsx:189-213`
2. Check `cancelEntryByIdSmart` implementation in `GameController`
3. Verify `entry.queuedTurn` is correctly set for structures
4. Test with structures at different positions: first, middle, last
5. Add logging to identify where "Invalid turn" error originates
6. Check if `viewTurn` validation is too strict

**Files to Investigate**:
- `src/app/page.tsx` (handleCancelItem function)
- `src/lib/game/commands.ts` (cancelEntryByIdSmart method)
- `src/components/QueueDisplay/TabbedLaneDisplay.tsx` (cancel callback)
- `src/components/QueueDisplay/QueueLaneEntry.tsx` (cancel trigger)

**Special Considerations**:
- Must maintain timeline integrity when removing items
- Queue recalculation should be efficient (no full resimulation if possible)
- Edge case: Removing an item that was queued at a turn before the current view turn
- Edge case: Removing the only active item in a lane
- Regression test: Ensure ships and colonists removal still works after fix

**Test Plan**:
1. Add 3 structures to queue (e.g., Farm, Metal Mine, Solar Generator)
2. Remove the middle structure (Metal Mine) → should succeed
3. Verify remaining structures show correct completion times
4. Add another structure → completion time should be correct
5. Remove the first (active) structure → should succeed
6. Remove the last structure → should succeed
7. Test at different view turns (past, present)
8. Verify ships and colonists removal still works (regression check)

**Debug Logging to Add**:
```typescript
console.log('Cancel attempt:', { laneId, entryId: entry.id, queuedTurn: entry.queuedTurn, viewTurn });
console.log('Cancel result:', result);
```

---

## Completed Tickets Archive

The following tickets have been completed and moved to archive:

- Phase 0-2: Core engine implementation (Tickets 0-12) ✅
- Phase 3: UI Migration (Tickets 13-19) ✅
- Phase 4: Testing & Performance (Tickets 20-22) ✅
- UI Improvements: 8 tickets for better UX ✅
- Bug fixes: Idle lane warnings removal, prerequisite filtering ✅

All core functionality is now implemented with 296/297 tests passing.