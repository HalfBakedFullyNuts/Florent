# Change Condition Monitoring Analysis

## User's Proposal

Create a helper function to monitor blocking conditions (e.g., "mineral < Y" or "workers < X") and trigger timeline recalculation only when these conditions transition from FALSE to TRUE.

**Goal**: Save processing time by avoiding unnecessary full timeline recalculations.

## Analysis

### Current Optimization State

The timeline system already implements several sophisticated optimizations:

1. **Lazy Computation** (state.ts:42-81)
   - Computes only when turns are requested
   - Initial load is instant (0ms vs 500-1000ms for full precomputation)
   - Computes 50 turns ahead as a buffer

2. **Stable State Detection** (state.ts:205-222)
   - Detects when no more work remains
   - Stops computation early (saves 50-150 turns of work)
   - Future turns cloned from stable state template

3. **Partial Recomputation** (state.ts:178-197)
   - Only recomputes from mutation point forward
   - Preserves all work before mutation
   - Typical mutation recomputes <50 turns

4. **Performance Metrics**
   - Current: 50-200 turns in <100ms (according to logs)
   - Highly efficient for a deterministic simulation

### Issues with Condition Monitoring Approach

#### 1. **Premature Optimization**

```
Profiling First: The actual bottleneck may not be turn simulation
- UI rendering might be more expensive
- State cloning might dominate
- React re-renders might be the real issue
```

**Without profiling data**, adding complexity is risky.

#### 2. **Complexity vs Benefit Trade-off**

**Added Complexity:**
- Track condition state for every potential queue operation
- Maintain watchers across timeline mutations
- Handle condition lifecycle (create, update, delete)
- Synchronize watchers with simulation state
- Debug when conditions trigger unexpectedly

**Estimated Benefit:**
- Current computation: ~100ms for 200 turns
- Potential savings: Maybe 20-50ms in edge cases?
- **Complexity cost > Performance gain**

#### 3. **Cascading Dependencies Problem**

```typescript
// Example: Mineral change affects multiple items
state.stocks.mineral += 100;  // Crosses threshold

// Which items can now be queued?
- Mining Station (needs 50 mineral)
- Refinery (needs 75 mineral)
- Factory (needs 100 mineral)

// Which lanes are affected?
- Building lane
- Ship lane (if ship needs minerals)

// Do we need to check every item definition?
- 15+ units × 35+ structures = 500+ checks?
```

Tracking all these dependencies is complex and error-prone.

#### 4. **Determinism Trade-off**

**Current System (Deterministic):**
- Same inputs → Same outputs
- Easy to debug (replay turns)
- Predictable behavior

**With Condition Watchers (Non-deterministic triggers):**
- Conditions might trigger in unexpected order
- Race conditions between multiple watchers
- Harder to reason about state transitions

#### 5. **Cache Invalidation is Hard**

```
When do we update condition watchers?
- After every stock change? (expensive)
- After every turn? (might miss intra-turn changes)
- On mutation only? (might miss timeline progression)

Classic problem: Cache invalidation is one of the two
hard problems in computer science
```

### Better Alternative Approaches

#### Option A: **Profile First, Optimize Second**

```typescript
// Add performance monitoring
const start = performance.now();
runTurn(state);
const duration = performance.now() - start;

if (duration > 5) {
  console.warn(`Slow turn: ${duration}ms at turn ${turn}`);
}
```

**Benefit**: Know where the actual bottleneck is before optimizing.

#### Option B: **Incremental Validation Cache**

```typescript
// Cache validation results per turn
interface ValidationCache {
  turn: number;
  canQueue: Map<string, boolean>;  // itemId → can queue?
  invalidated: boolean;
}

// Invalidate only when stocks change
function invalidateValidationCache(turn: number) {
  cache[turn].invalidated = true;
}

// Reuse cached results if not invalidated
function canQueueCached(turn: number, itemId: string): boolean {
  if (!cache[turn]?.invalidated) {
    return cache[turn].canQueue.get(itemId) ?? false;
  }
  // Recompute and cache
  const result = canQueue(state, def, qty);
  cache[turn].canQueue.set(itemId, result);
  return result;
}
```

**Benefits:**
- Simpler than condition watchers
- Leverages existing canQueue logic
- Easy to invalidate (just set flag)
- No cascading dependency tracking needed

#### Option C: **Lane-Level Recomputation**

```typescript
// Instead of recomputing entire turn, recompute only affected lane
function recomputeLane(turn: number, laneId: LaneId) {
  const state = timeline.getStateAtTurn(turn);
  const lane = state.lanes[laneId];

  // Recompute only this lane's progression
  runLaneProgression(state, laneId);

  // Recompute from next turn forward
  timeline.recomputeFrom(turn + 1);
}
```

**Benefits:**
- More granular than full turn recomputation
- Targets specific affected systems
- Still deterministic

#### Option D: **Memoization with Smart Invalidation**

```typescript
// Memoize expensive calculations
const memoizedNetOutputs = new Map<string, NetOutputs>();

function getNetOutputsMemoized(state: PlanetState): NetOutputs {
  const key = `${state.currentTurn}-${state.completedCounts}`;

  if (memoizedNetOutputs.has(key)) {
    return memoizedNetOutputs.get(key)!;
  }

  const outputs = computeNetOutputsPerTurn(state);
  memoizedNetOutputs.set(key, outputs);
  return outputs;
}
```

**Benefits:**
- Leverages existing computation logic
- Simple invalidation key (turn + completed items)
- No architectural changes needed

### Recommendation

**DO NOT implement condition monitoring** for these reasons:

1. **Insufficient Evidence**: No profiling data shows turn simulation is the bottleneck
2. **High Complexity**: Tracking conditions + dependencies + invalidation is complex
3. **Low ROI**: Current system is already fast (<100ms for 200 turns)
4. **Better Alternatives Exist**: Validation caching or lane-level recomputation are simpler

**Instead, follow this approach:**

#### Phase 1: **Measure** (Week 1)
```typescript
// Add performance tracking to identify bottlenecks
// Instrument: turn simulation, UI render, state updates
// Collect data: Which operations take >50ms?
```

#### Phase 2: **Analyze** (Week 1)
```
Review metrics:
- Is turn simulation the bottleneck? (<10% of cases based on logs)
- Is UI rendering the issue? (likely culprit for perceived slowness)
- Is state cloning expensive? (deep clones can be slow)
```

#### Phase 3: **Optimize Wisely** (Week 2+)
```
Based on findings:
- If turn simulation: Try validation caching (Option B)
- If UI rendering: Optimize React re-renders, add memo()
- If state cloning: Use structural sharing or immutable.js
```

## Conclusion

The condition monitoring idea **shows good systems thinking** about avoiding unnecessary work. However, in this case:

- **The current optimizations are already excellent**
- **The proposed solution adds more complexity than it saves**
- **We lack profiling data to justify the optimization**

**Recommendation**: Stick with the current architecture and profile first. If turn simulation becomes a proven bottleneck (>100ms consistently), then consider simpler alternatives like validation caching or lane-level recomputation before adding condition watchers.

---

## If You Still Want to Implement Condition Monitoring

If after profiling you determine this is worthwhile, here's a simpler variant:

```typescript
/**
 * Simple condition monitor for queue enablement
 * Tracks when resources cross thresholds to enable previously-blocked items
 */
interface QueueCondition {
  itemId: string;
  laneId: LaneId;
  requiredResources: Partial<StockState>;
  wasBlocked: boolean;
}

class QueueConditionMonitor {
  private conditions: QueueCondition[] = [];

  /**
   * Register a condition to watch
   */
  watch(itemId: string, laneId: LaneId, required: Partial<StockState>) {
    this.conditions.push({
      itemId,
      laneId,
      requiredResources: required,
      wasBlocked: true,
    });
  }

  /**
   * Check if any conditions transitioned from blocked to unblocked
   * Returns list of items that can now be queued
   */
  checkConditions(state: PlanetState): string[] {
    const nowUnblocked: string[] = [];

    for (const condition of this.conditions) {
      const isBlocked = !this.hasResources(state.stocks, condition.requiredResources);

      // Transition: was blocked, now unblocked
      if (condition.wasBlocked && !isBlocked) {
        nowUnblocked.push(condition.itemId);
      }

      condition.wasBlocked = isBlocked;
    }

    return nowUnblocked;
  }

  private hasResources(stocks: StockState, required: Partial<StockState>): boolean {
    return Object.entries(required).every(
      ([resource, amount]) => stocks[resource as keyof StockState] >= amount
    );
  }

  /**
   * Clear all conditions (call when timeline recomputes)
   */
  clear() {
    this.conditions = [];
  }
}
```

**Usage:**
```typescript
const monitor = new QueueConditionMonitor();

// User tries to queue but blocked
if (!canQueue(state, def, qty)) {
  // Register condition to watch
  monitor.watch(itemId, laneId, {
    metal: def.costsPerUnit.metal,
    mineral: def.costsPerUnit.mineral,
  });
}

// After each turn
const unblocked = monitor.checkConditions(state);
if (unblocked.length > 0) {
  // Trigger UI update or notification
  console.log(`Items now available: ${unblocked.join(', ')}`);
}
```

**Benefits of this simpler variant:**
- No automatic recalculation triggering (manual control)
- Simple resource threshold checking
- Easy to understand and debug
- Opt-in behavior (only watch what you need)

**Still has issues:**
- Manual registration required
- Doesn't handle complex dependencies
- Needs clearing on timeline mutations
- Limited value given current performance

**Final verdict**: Even this simpler version adds complexity for minimal gain given the current system's performance.
