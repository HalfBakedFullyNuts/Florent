# Queue System and Food Economy Tickets

This document tracks critical bugs discovered during queue removal and population upkeep testing.

---

## Queue Removal & Timeline Management

### TICKET-1: Implement Fixed 200-Turn Timeline with CSV Debugging

**Priority**: Critical
**Effort**: 2 hours (simplified from 3 hours)
**Status**: Open
**Architecture Change**: Fixed timeline length instead of dynamic
**Related Files**:
- `src/app/page.tsx` (handleCancelItem)
- `src/lib/game/commands.ts` (cancelEntryByIdSmart)
- `src/lib/game/state.ts` (Timeline)
- `src/lib/game/debug.ts` (NEW - CSV logging)

#### Dependencies

**Core Systems**:
- Timeline management (state.ts)
- Queue validation system (validation.ts)
- Smart cancellation logic (commands.ts::cancelEntryByIdSmart)
- Turn simulation (turn.ts::runTurn, simulate)

**Files Affected**:
- `src/app/page.tsx`: handleCancelItem function (lines 223-291)
- `src/lib/game/commands.ts`: cancelEntryByIdSmart, cancelEntryById (lines 224-294)
- `src/lib/game/state.ts`: Timeline class, recomputeFromTurn, mutateAtTurn (lines 110-158)
- `src/lib/game/validation.ts`: validateAllQueueItems, validateQueueEntry (all)
- `src/lib/sim/engine/turn.ts`: runTurn, simulate (all)

**Interaction Points**:
- Timeline.mutateAtTurn() → triggers recomputeFromTurn() → truncates states array
- Timeline.simulateTurns() → extends timeline forward after truncation
- validateAllQueueItems() → called after mutation to detect invalid entries

#### Architectural Decision: Fixed 200-Turn Timeline

**Paradigm Shift**: Instead of dynamically extending the timeline based on queue length, always maintain exactly 200 pre-computed turns. The turn slider becomes a pure view selector into this fixed dataset.

**Benefits**:
- Eliminates all timeline length edge cases
- viewTurn is always valid (∈ [1, 200])
- Massive code simplification
- Consistent UX (slider range never changes)
- Predictable performance (always 200 turns to compute)

**Trade-offs**:
- Every mutation recomputes all 200 turns (~200ms latency)
- Memory usage: 200 × PlanetState (~1MB total, negligible)
- Some wasted computation for empty turns (mitigated by stable state detection)

#### Problem Statement (Simplified)

When removing items from the queue:
1. Need to recompute all 200 turns efficiently
2. Need to maintain viewTurn position (no jumping)
3. Need to debug complex state issues when they occur
4. Need to validate remaining queue items after removal

#### CSV Debugging System

**Purpose**: Track all state changes for debugging and replication of issues

**CSV Structure** (3 separate files for different concerns):

1. **queue_operations.csv** - Track all queue mutations
```csv
timestamp,session_id,operation,turn,lane,item_id,item_name,quantity,success,error
2025-01-15T10:23:45.123Z,abc123,queue,1,building,metal_mine_001,Metal Mine,1,true,
2025-01-15T10:23:47.456Z,abc123,cancel,5,building,metal_mine_001,Metal Mine,1,true,
2025-01-15T10:23:48.789Z,abc123,cancel,5,building,farm_002,Farm,1,false,NOT_FOUND
```

2. **planet_states.csv** - Snapshot key state at each turn
```csv
timestamp,session_id,turn,metal,mineral,food,energy,workers,soldiers,scientists,growth_rate,building_queue,ship_queue,colonist_queue
2025-01-15T10:23:45.123Z,abc123,1,30000,20000,1000,0,20000,0,0,200,"metal_mine_001:4","",""
2025-01-15T10:23:45.124Z,abc123,2,30000,20000,1000,0,20200,0,0,202,"metal_mine_001:3","",""
```

3. **timeline_events.csv** - Track timeline recomputation events
```csv
timestamp,session_id,event,trigger,turns_computed,duration_ms,turns_with_activity,stable_from_turn
2025-01-15T10:23:45.123Z,abc123,recompute_all,queue_item,200,187,10,11
2025-01-15T10:23:47.456Z,abc123,recompute_all,cancel_item,200,195,8,9
```

**Searchability Features**:
- session_id: Group all operations from one play session
- timestamp: Exact ordering and performance analysis
- turn: Find all state at specific turn
- item_id: Track lifecycle of specific queue items
- CSV format: Can be analyzed with Excel, pandas, or grep

#### Known Issues (Simplified with Fixed Timeline)

⚠️ **ISSUE: Race Condition During 200-Turn Recompute**
**Issue**: During the ~200ms recompute, rapid clicks could trigger multiple recomputes
**Impact**: Wasted computation, potential state inconsistency

**Solution**:
```typescript
const [recomputeInProgress, setRecomputeInProgress] = useState(false);

const handleCancelItem = async (laneId, entry) => {
  if (recomputeInProgress) return; // Block during recompute
  setRecomputeInProgress(true);

  try {
    controller.cancelEntryByIdSmart(viewTurn, laneId, entry.id);
    await controller.recomputeAll(); // Recompute all 200 turns
  } finally {
    setRecomputeInProgress(false);
  }
};
```

---

⚠️ **ISSUE: Performance for Large Queues**
**Issue**: With 200-turn fixed timeline, every mutation takes ~200ms
**Impact**: Slightly noticeable delay on queue operations

**Optimization Strategy**:
```typescript
class Timeline {
  private stableFromTurn: number = -1; // Cache stable state point

  recomputeAll(): void {
    const start = performance.now();

    // Detect if state becomes stable (no more work)
    for (let turn = 1; turn <= 200; turn++) {
      const prevState = this.states[turn - 1];
      this.states[turn] = runTurn(prevState);

      // If no active work and no pending, state is stable
      if (isStableState(this.states[turn]) && this.stableFromTurn === -1) {
        this.stableFromTurn = turn;
        // Copy stable state to remaining turns (fast!)
        for (let i = turn + 1; i <= 200; i++) {
          this.states[i] = cloneState(this.states[turn]);
        }
        break;
      }
    }

    const duration = performance.now() - start;
    this.logTimelineEvent('recompute_all', duration, this.stableFromTurn);
  }
}
```

**Performance Target**: <100ms for typical queues, <200ms worst case

#### Technical Specification

**Phase 1: Implement Fixed 200-Turn Timeline**

Update Timeline class in `src/lib/game/state.ts`:

```typescript
class Timeline {
  private static readonly FIXED_TURNS = 200;
  private states: PlanetState[] = [];
  private sessionId: string = generateSessionId(); // For CSV tracking

  /**
   * Initialize timeline with 200 pre-computed turns
   */
  constructor(initialState: PlanetState) {
    this.states = new Array(Timeline.FIXED_TURNS);
    this.states[0] = cloneState(initialState);
    this.recomputeAll();
  }

  /**
   * Recompute all 200 turns from scratch
   * Optimized with stable state detection
   */
  async recomputeAll(): Promise<void> {
    const start = performance.now();
    let stableFromTurn = -1;

    for (let i = 1; i < Timeline.FIXED_TURNS; i++) {
      this.states[i] = runTurn(this.states[i - 1]);

      // Detect stable state (no active items, no pending queues)
      if (stableFromTurn === -1 && this.isStableState(this.states[i])) {
        stableFromTurn = i;
        // Fast-copy stable state to remaining turns
        const stableState = this.states[i];
        for (let j = i + 1; j < Timeline.FIXED_TURNS; j++) {
          this.states[j] = cloneState(stableState);
        }
        break;
      }
    }

    const duration = performance.now() - start;
    this.logTimelineEvent('recompute_all', duration, stableFromTurn);
  }

  /**
   * Apply mutation and recompute all 200 turns
   */
  async mutateAtTurn(turn: number, mutation: (state: PlanetState) => void): Promise<boolean> {
    if (turn < 0 || turn >= Timeline.FIXED_TURNS) return false;

    // Apply mutation
    mutation(this.states[turn]);

    // Log the mutation
    this.logStateChange(turn, 'mutation');

    // Recompute everything from mutation point forward
    await this.recomputeAll();
    return true;
  }

  private isStableState(state: PlanetState): boolean {
    return Object.values(state.lanes).every(
      lane => !lane.active && lane.pendingQueue.length === 0
    );
  }

  getStateAtTurn(turn: number): PlanetState | null {
    if (turn < 0 || turn >= Timeline.FIXED_TURNS) return null;
    return cloneState(this.states[turn]);
  }

  getTotalTurns(): number {
    return Timeline.FIXED_TURNS; // Always 200
  }
}
```

**Phase 2: Simplify handleCancelItem**

Update `handleCancelItem` in `src/app/page.tsx`:

```typescript
const [recomputeInProgress, setRecomputeInProgress] = useState(false);

const handleCancelItem = async (laneId: LaneId, entry: LaneEntry) => {
  if (recomputeInProgress) return; // Prevent rapid clicks
  setError(null);
  setRecomputeInProgress(true);

  try {
    // Log the operation attempt
    CSVLogger.logQueueOperation('cancel', viewTurn, laneId, entry);

    // Cancel the item
    const result = controller.cancelEntryByIdSmart(viewTurn, laneId, entry.id);

    if (!result.success) {
      CSVLogger.logQueueOperation('cancel_failed', viewTurn, laneId, entry, result.reason);
      setError(result.reason || 'Cannot cancel item');
      return;
    }

    // Recompute all 200 turns (simplified!)
    await controller.recomputeAll();

    // viewTurn is guaranteed valid (always 1-200), no adjustment needed

    // Validate remaining queue items
    const updatedState = controller.getStateAtTurn(viewTurn);
    if (updatedState) {
      const validationResults = validateAllQueueItems(updatedState, getLaneEntries);
      setQueueValidation(new Map(validationResults.map(r => [r.entryId, r])));
    }

    // Trigger re-render
    setStateVersion(prev => prev + 1);

  } finally {
    setRecomputeInProgress(false);
  }
};
```

**Phase 3: Implement CSV Debugging System**

Create new file `src/lib/game/debug.ts`:

```typescript
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

class CSVLogger {
  private static sessionId = this.generateSessionId();
  private static logDir = join(process.cwd(), 'game_logs');
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    mkdirSync(this.logDir, { recursive: true });

    // Create CSV headers
    this.writeCSV('queue_operations.csv',
      'timestamp,session_id,operation,turn,lane,item_id,item_name,quantity,success,error\n');

    this.writeCSV('planet_states.csv',
      'timestamp,session_id,turn,metal,mineral,food,energy,workers,soldiers,scientists,growth_rate,building_queue,ship_queue,colonist_queue\n');

    this.writeCSV('timeline_events.csv',
      'timestamp,session_id,event,trigger,turns_computed,duration_ms,turns_with_activity,stable_from_turn\n');

    this.initialized = true;
  }

  static logQueueOperation(
    operation: string,
    turn: number,
    lane: string,
    item: any,
    error?: string
  ) {
    this.init();
    const row = [
      new Date().toISOString(),
      this.sessionId,
      operation,
      turn,
      lane,
      item.id,
      item.itemName || item.name,
      item.quantity || 1,
      !error,
      error || ''
    ].join(',');

    this.writeCSV('queue_operations.csv', row + '\n');
  }

  static logPlanetState(turn: number, state: PlanetState) {
    this.init();
    const row = [
      new Date().toISOString(),
      this.sessionId,
      turn,
      state.stocks.metal,
      state.stocks.mineral,
      state.stocks.food,
      state.stocks.energy,
      state.population.workersTotal,
      state.population.soldiers,
      state.population.scientists,
      state.population.workersTotal * 0.01, // growth rate
      this.serializeQueue(state.lanes.building),
      this.serializeQueue(state.lanes.ship),
      this.serializeQueue(state.lanes.colonist)
    ].join(',');

    this.writeCSV('planet_states.csv', row + '\n');
  }

  static logTimelineEvent(
    event: string,
    trigger: string,
    turnsComputed: number,
    duration: number,
    stableFromTurn: number
  ) {
    this.init();
    const row = [
      new Date().toISOString(),
      this.sessionId,
      event,
      trigger,
      turnsComputed,
      duration.toFixed(2),
      stableFromTurn === -1 ? turnsComputed : stableFromTurn,
      stableFromTurn
    ].join(',');

    this.writeCSV('timeline_events.csv', row + '\n');
  }

  private static serializeQueue(lane: LaneState): string {
    const items = [];
    if (lane.active) {
      items.push(`${lane.active.itemId}:${lane.active.turnsRemaining}`);
    }
    lane.pendingQueue.forEach(item => {
      items.push(`${item.itemId}:pending`);
    });
    return `"${items.join('|')}"`;
  }

  private static writeCSV(filename: string, data: string) {
    const filepath = join(this.logDir, filename);
    appendFileSync(filepath, data, 'utf8');
  }

  private static generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export { CSVLogger };
```

#### Migration Strategy

**Breaking Changes**: None - this is a bug fix that improves existing behavior

**Backwards Compatibility**: Full compatibility maintained
- No API changes to Timeline or GameController
- UI behavior improves but no breaking changes
- Existing tests continue to work

**Rollout Plan**:
1. Implement Phase 1 (handleCancelItem fix) - can deploy independently
2. Implement Phase 2 (Timeline helper) - optional optimization
3. Add comprehensive tests for edge cases
4. Deploy to production with monitoring for state corruption

**Validation**: Check for:
- No "Invalid turn" errors in console after removal
- Timeline always extends far enough (no truncated queues)
- ViewTurn stays stable unless truly invalid
- Queue validation runs successfully after every removal

#### Acceptance Criteria

- [ ] Can remove any queue item from any viewed turn (not just latest turn)
- [ ] Turn slider stays at the same turn after removal (no jumping)
- [ ] Planet summary reflects correct state at viewed turn after removal
- [ ] All buttons remain clickable after removal (no greying out)
- [ ] Timeline extends far enough to complete all remaining queue items
- [ ] Subsequent turns recalculate correctly based on modified queue
- [ ] Can immediately queue new items after removal
- [ ] Batch removals work correctly (remove entire batch as atomic operation)
- [ ] Multiple rapid removals don't cause state corruption

#### Testing Requirements

```typescript
describe('Queue Removal from Any Turn', () => {
  it('should allow removal from non-latest turn', () => {
    // Setup: Queue 3 items, view turn 5 (middle of queue)
    controller.queueItem(1, 'metal_mine', 1); // T1-T4
    controller.queueItem(1, 'farm', 1);       // T5-T8
    controller.queueItem(1, 'solar_gen', 1);  // T9-T12
    controller.simulateTurns(15);

    // Remove middle item while viewing T5
    const result = controller.cancelEntryByIdSmart(5, 'building', 'farm_id');
    expect(result.success).toBe(true);

    // Timeline should still have at least T12 (completion of last item)
    expect(controller.getTotalTurns()).toBeGreaterThanOrEqual(12);

    // State at T5 should reflect removal
    const stateT5 = controller.getStateAtTurn(5);
    expect(stateT5.lanes.building.pendingQueue).toHaveLength(1); // Only solar_gen remains
  });

  it('should keep user at same viewed turn after removal', () => {
    // Setup: Queue items and view T7
    controller.queueItem(1, 'metal_mine', 1);
    controller.simulateTurns(10);
    const originalViewTurn = 7;

    // Remove item
    controller.cancelEntryByIdSmart(1, 'building', 'metal_mine_id');

    // viewTurn should remain 7 (or closest valid turn)
    const finalTotalTurns = controller.getTotalTurns();
    if (originalViewTurn < finalTotalTurns) {
      expect(viewTurn).toBe(originalViewTurn);
    }
  });

  it('should allow queueing immediately after removal', () => {
    // Setup and remove
    controller.queueItem(1, 'metal_mine', 1);
    controller.cancelEntryByIdSmart(1, 'building', 'metal_mine_id');

    // Should be able to queue new item
    const canQueue = controller.canQueueItem('farm', 1);
    expect(canQueue.allowed).toBe(true);
  });

  it('should handle removal when timeline is insufficient', () => {
    // Setup: Queue multiple items but only simulate to T10
    controller.queueItem(1, 'metal_mine', 1); // T1-T4
    controller.queueItem(1, 'farm', 1);       // T5-T8
    controller.queueItem(1, 'solar_gen', 1);  // T9-T12
    controller.simulateTurns(9); // Only to T10 (incomplete)

    // Remove first item
    const result = controller.cancelEntryByIdSmart(1, 'building', 'metal_mine_id');
    expect(result.success).toBe(true);

    // Timeline should auto-extend to cover remaining items (farm T1-T4, solar T5-T8)
    expect(controller.getTotalTurns()).toBeGreaterThanOrEqual(9);

    // Should be able to view final state
    const finalState = controller.getStateAtTurn(controller.getTotalTurns() - 1);
    expect(finalState).toBeDefined();
  });

  it('should handle rapid successive removals without corruption', () => {
    // Setup: Queue 5 items
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const result = controller.queueItem(1, 'metal_mine', 1);
      ids.push(result.itemId);
    }
    controller.simulateTurns(30);

    // Remove all items rapidly
    for (const id of ids) {
      const result = controller.cancelEntryByIdSmart(1, 'building', id);
      expect(result.success).toBe(true);
    }

    // State should be consistent (all items removed)
    const state = controller.getStateAtTurn(1);
    expect(state.lanes.building.pendingQueue).toHaveLength(0);
    expect(state.lanes.building.active).toBeNull();
  });
});
```

#### Enhanced Test Requirements

**Edge Cases to Cover**:
1. ✅ Remove from non-latest turn (already covered)
2. ✅ Remove when timeline is shorter than remaining work
3. ✅ Remove first item in queue
4. ✅ Remove last item in queue
5. ✅ Remove only item in queue
6. ✅ Remove active item vs pending item
7. ⚠️ **NEW**: Remove when viewTurn === totalTurns - 1 (boundary)
8. ⚠️ **NEW**: Remove when only 1 turn exists
9. ⚠️ **NEW**: Remove batch items (quantity > 1)
10. ⚠️ **NEW**: Remove item that other items depend on (prerequisite)

**Performance Tests**:
- Removal should complete in <100ms for typical queues (10 items across 3 lanes)
- Timeline extension should not cause exponential growth (limit to 1000 turns max)
- Queue validation should complete in <50ms after removal

**Stress Tests**:
- Remove 20 items rapidly (test race condition mitigation)
- Remove items from queue with 100+ pending items
- Remove items when timeline has 500+ computed states

#### Implementation Steps

1. **Calculate Required Timeline Extension** (1 hour)
   - Analyze all remaining queue items in all lanes
   - Calculate maximum completion turn needed
   - Ensure timeline extends to cover all completions

2. **Fix viewTurn Stability** (30 minutes)
   - Keep user at original viewed turn if still valid
   - Only adjust viewTurn if it becomes invalid (>= totalTurns)
   - Use `Math.max(1, ...)` to prevent turn 0

3. **Add Timeline Extension Helper** (1 hour)
   - Implement `extendToCompleteAllQueues()` in Timeline class
   - Call after all queue mutations
   - Add safety limits to prevent infinite loops

4. **Add Comprehensive Tests** (30 minutes)
   - Test removal from different turn positions
   - Test rapid successive removals
   - Test batch removals
   - Test edge cases (removing last item, removing first item)

---

## Food Economy & Population Upkeep

### TICKET-2: Fix Population Food Upkeep to Reduce Production Before Stocks

**Priority**: Critical
**Effort**: 2 hours
**Status**: Open
**Related Files**:
- `src/lib/sim/engine/outputs.ts` (computeNetOutputsPerTurn)
- `src/lib/sim/engine/turn.ts` (advanceTurn)
- `src/lib/sim/rules/constants.ts` (FOOD_PER_WORKER)

#### Dependencies

**Core Systems**:
- Resource production calculation (outputs.ts)
- Turn advancement logic (turn.ts)
- Growth calculation (growth_food.ts)
- Constants (FOOD_PER_WORKER = 0.002)

**Files Affected**:
- `src/lib/sim/engine/outputs.ts`: computeNetOutputsPerTurn (lines 12-55)
- `src/lib/sim/engine/turn.ts`: runTurn (lines 26-74)
- `src/lib/sim/engine/growth_food.ts`: computeFoodUpkeep, applyFoodUpkeep (lines 57-75)
- `src/lib/game/selectors.ts`: getPlanetSummary (lines 98, 134)

**Interaction Points**:
- computeNetOutputsPerTurn() returns NetOutputs with food production
- runTurn() calls computeNetOutputsPerTurn() → addOutputsToStocks() → applyWorkerGrowth() → applyFoodUpkeep()
- applyFoodUpkeep() currently deducts from stocks AFTER production was added
- Need to move upkeep calculation INTO computeNetOutputsPerTurn()

**Data Flow Analysis**:
```
Current (WRONG):
1. computeNetOutputsPerTurn() → {food: +200} (ignores upkeep)
2. addOutputsToStocks() → stocks.food += 200
3. applyFoodUpkeep() → stocks.food -= 100
Result: Upkeep invisible in production, taken from stocks

Correct (TICKET-2):
1. computeNetOutputsPerTurn() → {food: +200 - 100 = +100} (includes upkeep)
2. addOutputsToStocks() → stocks.food += 100
3. applyFoodUpkeep() → REMOVED (upkeep already applied in step 1)
Result: Upkeep visible in net production, correct economic model
```

#### Problem Statement

Population food upkeep is currently deducted directly from food stocks, rather than reducing food production first. This violates the game's economic model where:

1. **Food Production** should be reduced by population upkeep FIRST
2. **Only when production reaches 0** should upkeep consume from stocks
3. **Only when stocks reach 0** should population growth stop

**Expected Behavior**:
```
Food Production: +200
Population Upkeep: -100
Net Production: +100 (added to stocks)
Stocks: 1000 → 1100

If upkeep exceeds production:
Food Production: +50
Population Upkeep: -100
Net Production: -50 (taken from stocks)
Stocks: 1000 → 950

If upkeep exceeds production AND stocks run out:
Food Production: +50
Population Upkeep: -100
Net Production: -50
Stocks: 30 → 0 (clamped, growth stops)
```

**Current Behavior**:
```
// Upkeep taken directly from stocks
stocks.food -= populationUpkeep;
production.food remains unchanged
```

#### Root Cause Analysis

The `computeNetOutputsPerTurn` function calculates food production but doesn't account for population upkeep as a reduction to production. Instead, upkeep is deducted later in `advanceTurn`, bypassing the production/consumption balance.

**Current Flow**:
1. `computeNetOutputsPerTurn()` → Returns food production (e.g., +200)
2. `advanceTurn()` → Adds production to stocks → Deducts upkeep from stocks
3. Result: Upkeep is invisible in production calculations

**Correct Flow**:
1. `computeNetOutputsPerTurn()` → Calculate gross production (e.g., +200)
2. `computeNetOutputsPerTurn()` → Subtract upkeep (-100) → Net production (+100)
3. `advanceTurn()` → Add net production to stocks (may be negative)
4. `advanceTurn()` → Clamp stocks to 0 minimum
5. Growth calculation → Only happens if stocks.food > 0

#### Known Issues

⚠️ **CRITICAL: Double Deduction Risk**
**Issue**: If applyFoodUpkeep() is not removed, upkeep will be deducted TWICE
**Root Cause**: Both computeNetOutputsPerTurn() and applyFoodUpkeep() would deduct upkeep
**Impact**: Population starves at 2x rate, game becomes unplayable

**Draft Solution**: MUST remove applyFoodUpkeep() call from turn.ts when implementing

**Verification**:
```typescript
// After fix, verify:
const upkeepInProduction = outputs.food; // Should include upkeep reduction
const upkeepInGrowth = applyFoodUpkeep(); // Should be REMOVED or NO-OP
// Total upkeep applied = upkeepInProduction (once, not twice)
```

---

⚠️ **ISSUE: Abundance Multiplier May Affect Upkeep**
**Issue**: Unclear if population upkeep should scale with food abundance
**Root Cause**: farms scale production with abundance (0.5x - 2.0x), but upkeep is constant
**Impact**: On low-abundance planets, upkeep can exceed production even with many farms

**Current Design Decision**: Upkeep is NOT scaled by abundance
- Rationale: Population eats fixed amount regardless of planet's fertility
- Farms produce more/less based on soil quality (abundance)
- This creates strategic choice: low abundance = need more farms per worker

**Draft Solution**: Keep upkeep unscaled, document this design decision

**Alternative**: Scale upkeep with abundance (easier to balance, less strategic depth)

---

⚠️ **ISSUE: Selector Calculates Upkeep Separately**
**Issue**: selectors.ts:98 calculates foodUpkeep for display, but doesn't match engine
**Root Cause**: Selector uses `workersTotal * FOOD_PER_WORKER` independently
**Impact**: UI may show different upkeep than engine applies (desync)

**Draft Solution**: Update selector to use computeFoodUpkeep() from growth_food.ts
```typescript
// selectors.ts
import { computeFoodUpkeep } from '../sim/engine/growth_food';

// In getPlanetSummary:
const foodUpkeep = computeFoodUpkeep(state); // Use engine function
```

**Verification**: UI foodUpkeep must match engine's calculated upkeep exactly

---

⚠️ **ISSUE: Growth Calculation Depends on Stock Check**
**Issue**: applyWorkerGrowth() checks `stocks.food <= 0` to halt growth
**Root Cause**: Growth gate is AFTER production and upkeep, not before
**Impact**: If production is negative but stocks > 0, growth still occurs (correct!)

**Current Behavior** (CORRECT):
```
T1: stocks=100, production=-50 → stocks=50, growth happens
T2: stocks=50, production=-50 → stocks=0, growth happens
T3: stocks=0, production=-50 → stocks=0, NO growth
```

**This is the intended behavior**: Growth stops when stocks hit 0, not when production goes negative.

**Verification**: No change needed, existing logic is correct

#### Technical Specification

**Phase 1: Move Upkeep Calculation to Production**

Update `computeNetOutputsPerTurn` in `src/lib/sim/engine/outputs.ts`:

```typescript
export function computeNetOutputsPerTurn(state: PlanetState): NetOutputs {
  const outputs: NetOutputs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
  };

  // Calculate gross production from structures
  for (const [itemId, count] of Object.entries(state.completedCounts)) {
    const def = state.defs[itemId];
    if (!def || def.type !== 'structure') continue;

    const production = def.productionPerTurn;
    const upkeep = def.upkeepPerUnit;

    // Apply abundance scaling if applicable
    const productionMultiplier = def.isAbundanceScaled
      ? getAbundanceMultiplier(state.abundance, def.productionPerTurn)
      : 1.0;

    // Add production (scaled)
    outputs.metal += production.metal * count * productionMultiplier;
    outputs.mineral += production.mineral * count * productionMultiplier;
    outputs.food += production.food * count * productionMultiplier;
    outputs.energy += production.energy * count * productionMultiplier;

    // Subtract upkeep (NOT scaled)
    outputs.metal -= upkeep.metal * count;
    outputs.mineral -= upkeep.mineral * count;
    outputs.food -= upkeep.food * count;
    outputs.energy -= upkeep.energy * count;
  }

  // CRITICAL: Subtract population food upkeep from PRODUCTION, not stocks
  const foodUpkeep = calculatePopulationFoodUpkeep(state);
  outputs.food -= foodUpkeep;

  return outputs;
}

/**
 * Calculate total food upkeep for all population types
 */
function calculatePopulationFoodUpkeep(state: PlanetState): number {
  const { workersTotal, soldiers, scientists } = state.population;

  // Workers: 1 food per 100 population
  const workerUpkeep = Math.ceil(workersTotal * FOOD_PER_WORKER);

  // Soldiers: 1 food per 100 population
  const soldierUpkeep = Math.ceil(soldiers * FOOD_PER_WORKER);

  // Scientists: 1 food per 100 population
  const scientistUpkeep = Math.ceil(scientists * FOOD_PER_WORKER);

  return workerUpkeep + soldierUpkeep + scientistUpkeep;
}
```

**Phase 2: Update Turn Advancement to Use Net Production**

Update `advanceTurn` in `src/lib/sim/engine/turn.ts`:

```typescript
export function advanceTurn(state: PlanetState): void {
  // ... existing lane processing ...

  // Apply net production/consumption (already accounts for upkeep)
  const netOutputs = computeNetOutputsPerTurn(state);

  // Add/subtract from stocks (can go negative, then clamped)
  state.stocks.metal += netOutputs.metal;
  state.stocks.mineral += netOutputs.mineral;
  state.stocks.food += netOutputs.food;
  state.stocks.energy += netOutputs.energy;

  // Clamp stocks to 0 minimum (cannot go negative)
  state.stocks.metal = Math.max(0, state.stocks.metal);
  state.stocks.mineral = Math.max(0, state.stocks.mineral);
  state.stocks.food = Math.max(0, state.stocks.food);
  state.stocks.energy = Math.max(0, state.stocks.energy);

  // Population growth ONLY happens if food stocks > 0
  if (state.stocks.food > 0) {
    applyPopulationGrowth(state);
  }
  // else: growth halted (no food in stocks)

  // ... rest of turn advancement ...
}
```

**Phase 3: Remove Duplicate Upkeep Deductions**

Search for any direct upkeep deductions in `advanceTurn` and remove them:

```typescript
// REMOVE THIS (if it exists):
// state.stocks.food -= calculatePopulationFoodUpkeep(state);
```

**Phase 4: Update Selector to Use Engine Function**

Update `src/lib/game/selectors.ts`:

```typescript
import { computeFoodUpkeep } from '../sim/engine/growth_food';

export function getPlanetSummary(state: PlanetState): PlanetSummary {
  // ... existing code ...

  // Use engine's upkeep calculation for consistency
  const foodUpkeep = computeFoodUpkeep(state);

  return {
    // ... existing fields ...
    foodUpkeep,
    growthHint: state.stocks.food > 0
      ? `+${projectedGrowth} workers at end of turn`
      : 'No growth (need food > 0)',
  };
}
```

#### Migration Strategy

**Breaking Changes**: Yes - food economy behaves differently

**Impact Assessment**:
- All existing game states will see different food production/consumption rates
- Tests that hardcode food values will need updates
- Players will notice food production appears lower (upkeep now visible)

**Backwards Compatibility**: None - this is a fundamental behavior change

**Rollout Plan**:
1. Update production calculation (outputs.ts)
2. Remove duplicate upkeep deduction (turn.ts)
3. Update selector for UI consistency (selectors.ts)
4. Update all tests to reflect new behavior
5. Add prominent UI indicator showing "Net Food" vs "Gross Food"

**Player Communication**:
```
PATCH NOTES:
Food economy has been fixed to show accurate production:
- Food upkeep is now subtracted from production before stocks
- Net food production may appear lower (it was always like this, just hidden)
- Population growth still works the same (stops at 0 stocks)
```

#### Acceptance Criteria

- [ ] Food upkeep appears in net food production calculation
- [ ] Negative food production correctly reduces stocks
- [ ] Population growth stops when stocks reach 0 (not when production is negative)
- [ ] Food upkeep is NOT deducted twice (once from production, once from stocks)
- [ ] UI shows correct net food output (production - upkeep)
- [ ] Warnings show when food production is negative
- [ ] Growth hint correctly shows "No growth (need food > 0)" when stocks are 0

#### Testing Requirements

```typescript
describe('Population Food Upkeep', () => {
  it('should reduce production by upkeep before touching stocks', () => {
    // Setup: 1 farm (+100 food), 20,000 workers (-200 upkeep)
    const state = createTestState();
    state.completedCounts.farm = 1; // +100 food production
    state.population.workersTotal = 20000; // -200 food upkeep
    state.stocks.food = 1000;

    const netOutputs = computeNetOutputsPerTurn(state);

    // Net production should be: +100 (farm) - 200 (upkeep) = -100
    expect(netOutputs.food).toBe(-100);

    // After turn, stocks should decrease by 100
    advanceTurn(state);
    expect(state.stocks.food).toBe(900); // 1000 - 100 = 900
  });

  it('should stop growth when stocks reach 0', () => {
    const state = createTestState();
    state.completedCounts.farm = 0; // 0 food production
    state.population.workersTotal = 20000; // -200 upkeep
    state.stocks.food = 50; // Not enough to survive upkeep

    advanceTurn(state);

    // Stocks should clamp to 0
    expect(state.stocks.food).toBe(0);

    // Population should not grow
    const initialPop = state.population.workersTotal;
    advanceTurn(state);
    expect(state.population.workersTotal).toBe(initialPop); // No growth
  });

  it('should allow growth when production meets upkeep', () => {
    const state = createTestState();
    state.completedCounts.farm = 2; // +200 food production
    state.population.workersTotal = 20000; // -200 upkeep
    state.stocks.food = 1000;

    const netOutputs = computeNetOutputsPerTurn(state);
    expect(netOutputs.food).toBe(0); // Break-even

    advanceTurn(state);

    // Stocks stay same
    expect(state.stocks.food).toBe(1000);

    // Growth should still happen (stocks > 0)
    advanceTurn(state);
    expect(state.population.workersTotal).toBeGreaterThan(20000);
  });

  it('should not deduct upkeep twice', () => {
    const state = createTestState();
    state.completedCounts.farm = 1; // +100 food
    state.population.workersTotal = 10000; // -100 upkeep
    state.stocks.food = 1000;

    // Calculate net outputs (should include upkeep)
    const netOutputs = computeNetOutputsPerTurn(state);
    expect(netOutputs.food).toBe(0); // +100 - 100 = 0

    // Advance turn and check stocks
    advanceTurn(state);

    // Stocks should be unchanged (net production was 0)
    // NOT 900 (which would indicate double deduction)
    expect(state.stocks.food).toBe(1000);
  });

  it('should show upkeep in UI correctly', () => {
    const state = createTestState();
    state.population.workersTotal = 10000; // -100 upkeep

    // Selector should show upkeep
    const summary = getPlanetSummary(state);
    expect(summary.foodUpkeep).toBe(100);

    // Net production should reflect upkeep
    expect(summary.outputsPerTurn.food).toBeLessThan(100); // Upkeep subtracted
  });
});
```

#### Enhanced Test Requirements

**Edge Cases to Cover**:
1. ✅ Production > upkeep (stocks increase)
2. ✅ Production = upkeep (stocks unchanged, growth continues)
3. ✅ Production < upkeep (stocks decrease)
4. ✅ Stocks reach 0 (growth stops)
5. ⚠️ **NEW**: Abundance scaling doesn't affect upkeep
6. ⚠️ **NEW**: Multiple population types (workers + soldiers + scientists)
7. ⚠️ **NEW**: Very large populations (100M workers = 1M upkeep)
8. ⚠️ **NEW**: Floating point precision (0.002 * 12345 workers)

**Integration Tests**:
- Multi-turn simulation with declining food
- Growth acceleration followed by starvation
- Economic recovery (building farms after starvation)

**UI Validation**:
- PlanetDashboard shows correct net food
- Warnings appear when food production is negative
- Growth hint updates correctly based on stocks

#### Implementation Steps

1. **Update computeNetOutputsPerTurn** (1 hour)
   - Add `calculatePopulationFoodUpkeep` helper
   - Subtract upkeep from food output
   - Update tests to verify net output calculation

2. **Update advanceTurn** (30 minutes)
   - Use net outputs directly (no separate upkeep deduction)
   - Add stock clamping to 0 minimum
   - Gate growth on `stocks.food > 0`

3. **Update UI to Show Net Production** (30 minutes)
   - Ensure PlanetDashboard shows net food output (already does via `computeNetOutputsPerTurn`)
   - Add warning when net food production is negative
   - Update growth hint to reflect stock-based growth condition

#### Implementation Order

**Dependencies**: TICKET-2 should be implemented BEFORE TICKET-1

**Rationale**:
- TICKET-2 is isolated to engine layer (no UI interaction complexity)
- TICKET-1 involves Timeline mutations which may trigger food calculations
- Easier to test food economy in isolation before adding queue removal complexity

**Recommended Sequence**:
1. Implement TICKET-2 (2 hours)
2. Verify all food economy tests pass
3. Deploy TICKET-2 to staging for validation
4. Then implement TICKET-1 (3 hours)
5. Verify queue removal works with new food economy
6. Deploy both to production

