# UI Bug Fixes and Improvements

This document tracks critical bugs and improvements discovered during UI testing of the item grid interface and queue system.

## State Architecture Prerequisites

### BUG-0: Define Queue State Management Architecture

**Priority**: Critical (Prerequisite for BUG-6)
**Effort**: 2 hours
**Status**: Open

#### Problem Statement
The current queue system architecture is undefined, blocking proper implementation of multiple item queueing (BUG-6). Need explicit state management patterns and command/query separation.

#### Technical Specification
**Files**:
- `src/lib/sim/engine/types.ts` - Update LaneState interface
- `src/lib/game/commands.ts` - Implement command pattern

**Architecture Design**:
```typescript
// Command Pattern for Queue Operations
interface QueueCommand {
  execute(): void;
  canExecute(): boolean;
  undo(): void;
}

class QueueItemCommand implements QueueCommand {
  constructor(
    private controller: GameController,
    private itemId: string,
    private quantity: number
  ) {}

  canExecute(): boolean {
    return this.controller.canQueueItem(this.itemId, this.quantity).allowed;
  }

  execute(): void {
    this.controller.queueItem(this.itemId, this.quantity);
  }

  undo(): void {
    this.controller.cancelLastQueuedItem(this.itemId);
  }
}

// Update LaneState to support multiple pending items
export interface LaneState {
  pendingQueue: WorkItem[]; // Array for multiple items
  active: WorkItem | null;
  maxQueueDepth: number; // Default: 10
}
```

#### Acceptance Criteria
- [ ] Command pattern implemented for queue operations
- [ ] LaneState supports multiple pending items
- [ ] Queue depth limit enforced (max 10 items)
- [ ] Undo operation available for last queued item
- [ ] State mutations isolated in command execution
- [ ] Unit tests cover command execution/undo/validation

#### Testing Requirements
```typescript
describe('QueueCommand', () => {
  it('should validate before execution', () => {
    const command = new QueueItemCommand(controller, 'metal_mine', 1);
    expect(command.canExecute()).toBe(true);
  });

  it('should support undo operations', () => {
    const command = new QueueItemCommand(controller, 'metal_mine', 1);
    command.execute();
    expect(controller.getQueueLength('building')).toBe(1);
    command.undo();
    expect(controller.getQueueLength('building')).toBe(0);
  });
});
```

---

## BUG-1: Resource Cost Colors Not Applied in Item Grid

**Priority**: Medium
**Effort**: 1 hour
**Status**: Open

### Problem Statement
The item grid displays cost summaries (e.g., "M:500 Mi:200") but uses default muted text color instead of color-coding resources according to their type (Metal=pink, Mineral=blue, Food=green, Energy=yellow). This makes it harder to quickly parse resource requirements.

### Technical Specification
**File**: `src/components/LaneBoard/ItemGrid.tsx`

**Changes Required**:
1. Update `formatCost()` function to return structured data instead of plain string
2. Render each resource with appropriate color class
3. Apply color mapping:
   - Metal → `text-pink-500`
   - Mineral → `text-blue-400`
   - Food → `text-green-400`
   - Energy → `text-yellow-400`

**Implementation**:
```typescript
const formatCost = (item: any) => {
  if (!item.costsPerUnit) return [];
  return Object.entries(item.costsPerUnit)
    .filter(([_, amount]) => (amount as number) > 0)
    .map(([resource, amount]) => ({
      resource,
      amount: amount as number,
      color: getResourceColor(resource),
    }));
};

const getResourceColor = (resource: string) => {
  switch (resource) {
    case 'metal': return 'text-pink-500';
    case 'mineral': return 'text-blue-400';
    case 'food': return 'text-green-400';
    case 'energy': return 'text-yellow-400';
    default: return 'text-pink-nebula-muted';
  }
};
```

**Rendering**:
```tsx
<div className="flex items-center gap-2 mt-1 text-xs">
  <span>⏱️ {item.durationTurns}T</span>
  {formatCost(item).map(({ resource, amount, color }) => (
    <span key={resource} className={color}>
      {resource.charAt(0).toUpperCase()}:{amount}
    </span>
  ))}
</div>
```

### Acceptance Criteria
- [ ] Metal costs displayed in pink (text-pink-500)
- [ ] Mineral costs displayed in blue (text-blue-400)
- [ ] Food costs displayed in green (text-green-400)
- [ ] Energy costs displayed in yellow (text-yellow-400)
- [ ] Colors consistent with PlanetDashboard resource display
- [ ] Desktop and mobile layouts both show colored costs

### Testing Requirements
```typescript
describe('ItemGrid Resource Colors', () => {
  it('should apply correct color classes to resource costs', () => {
    const item = { costsPerUnit: { metal: 100, mineral: 50 } };
    const costs = formatCost(item);
    expect(costs[0].color).toBe('text-pink-500');
    expect(costs[1].color).toBe('text-blue-400');
  });

  it('should handle missing resource gracefully', () => {
    const item = { costsPerUnit: { unknown: 100 } };
    const costs = formatCost(item);
    expect(costs[0].color).toBe('text-pink-nebula-muted');
  });
});
```

---

## BUG-2: Column Width Too Wide in Item Grid

**Priority**: Medium
**Effort**: 0.5 hours
**Status**: Open

### Problem Statement
The 3-column grid in the item selection section uses equal-width columns that are too wide, creating excessive whitespace and making the interface feel sparse. Narrower columns would create a more compact, efficient layout.

### Technical Specification
**File**: `src/components/LaneBoard/ItemGrid.tsx`

**Changes Required**:
1. Reduce max-width of each column from unconstrained to ~280px
2. Center the grid within available space
3. Maintain responsive behavior on smaller screens

**Implementation**:
```tsx
{/* Desktop: 3-Column Grid */}
<div className="hidden lg:grid lg:grid-cols-3 gap-4 max-w-[900px] mx-auto">
  {['building', 'ship', 'colonist'].map((laneId) => {
    // ... existing code
    return (
      <div
        key={laneId}
        className={`bg-pink-nebula-panel rounded-lg border-2 ${config.color} p-4 max-w-[280px]`}
      >
        {/* ... existing content */}
      </div>
    );
  })}
</div>
```

### Acceptance Criteria
- [ ] Each column max-width: 280px
- [ ] Grid container max-width: 900px (3 × 280 + 2 × gap)
- [ ] Grid centered horizontally with `mx-auto`
- [ ] No layout shift on tablet/mobile accordion view
- [ ] Visual balance maintained with narrower columns

---

## BUG-3: Workers and Outpost Visible in Item Grid

**Priority**: High
**Effort**: 1 hour
**Status**: Open

### Problem Statement
The item grid displays "Worker" and "Outpost" items which cannot actually be queued through the UI (workers are produced automatically by growth, outposts are starter structures). These should be filtered out to avoid user confusion.

### Technical Specification
**File**: `src/components/LaneBoard/ItemGrid.tsx`

**Changes Required**:
1. Filter out non-queueable items before grouping by lane
2. Add exclusion list for automatic/starter items
3. Ensure filter applies to both desktop grid and mobile accordion

**Implementation**:
```typescript
// Exclusion list for items that cannot be queued
const EXCLUDED_ITEMS = ['worker', 'outpost'];

// Group items by lane, excluding non-queueable items
const itemsByLane = Object.values(availableItems).reduce(
  (acc: Record<string, any[]>, item: any) => {
    // Skip excluded items
    if (EXCLUDED_ITEMS.includes(item.id)) {
      return acc;
    }

    if (!acc[item.lane]) {
      acc[item.lane] = [];
    }
    acc[item.lane].push(item);
    return acc;
  },
  {}
);
```

### Acceptance Criteria
- [ ] "Worker" item not visible in colonist column
- [ ] "Outpost" item not visible in structures column
- [ ] Item count labels reflect filtered totals
- [ ] No errors when attempting to queue excluded items
- [ ] Filter applies to both desktop and mobile views

---

## BUG-4: Prerequisites Not Checked for Item Visibility

**Priority**: Critical
**Effort**: 2 hours
**Status**: Open

### Problem Statement
All items are currently displayed in the item grid regardless of whether their prerequisites have been met. Players should only see items they can actually build based on completed structures. This creates confusion and violates game design principles.

**User Story**: As a player, I want to see only buildable items so that I'm not confused by unavailable options.

### Technical Specification
**Files**:
- `src/components/LaneBoard/ItemGrid.tsx`
- `src/app/page.tsx` (may need to pass completed structures data)
- `src/lib/game/prerequisites.ts` (NEW - extract prerequisite logic)

**Changes Required**:
1. Create separate prerequisite checker interface
2. Filter items based on prerequisites before grouping by lane
3. Check both structure requirements and any other prerequisite flags
4. Update item count to reflect available items only
5. Add performance optimization for large item sets

**Improved Architecture**:
```typescript
// Prerequisites checker with single responsibility
interface PrerequisiteChecker {
  hasPrerequisites(itemId: string): boolean;
  getMissingPrerequisites(itemId: string): string[];
}

// Decoupled ItemGrid interface
export interface ItemGridProps {
  availableItems: Record<string, any>;
  prerequisiteChecker: PrerequisiteChecker; // Focused interface
  onQueueItem: (itemId: string, quantity: number) => void;
  canQueueItem: (itemId: string, quantity: number) => {
    allowed: boolean;
    reason?: string;
  };
}
```

**Implementation**:
```typescript
// Optimized prerequisite checking with caching
class CachedPrerequisiteChecker implements PrerequisiteChecker {
  private cache = new Map<string, boolean>();

  constructor(
    private state: PlanetState,
    private defs: Record<string, ItemDefinition>
  ) {}

  hasPrerequisites(itemId: string): boolean {
    // Check cache first (O(1) lookup)
    if (this.cache.has(itemId)) {
      return this.cache.get(itemId)!;
    }

    const item = this.defs[itemId];
    if (!item?.requires || item.requires.length === 0) {
      this.cache.set(itemId, true);
      return true;
    }

    // Check each required structure
    for (const reqId of item.requires) {
      const reqDef = this.defs[reqId];
      if (!reqDef) continue;

      if (reqDef.type === 'structure') {
        const count = this.state.structures[reqId] || 0;
        if (count === 0) {
          this.cache.set(itemId, false);
          return false;
        }
      }
    }

    this.cache.set(itemId, true);
    return true;
  }

  getMissingPrerequisites(itemId: string): string[] {
    const missing: string[] = [];
    const item = this.defs[itemId];

    if (item?.requires) {
      for (const reqId of item.requires) {
        if (this.state.structures[reqId] === 0) {
          missing.push(this.defs[reqId]?.name || reqId);
        }
      }
    }

    return missing;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Filter items by lane AND prerequisites
const itemsByLane = Object.values(availableItems).reduce(
  (acc: Record<string, any[]>, item: any) => {
    // Skip excluded items
    if (EXCLUDED_ITEMS.includes(item.id)) {
      return acc;
    }

    // Skip items without prerequisites met
    if (!hasPrerequisites(item, currentState)) {
      return acc;
    }

    if (!acc[item.lane]) {
      acc[item.lane] = [];
    }
    acc[item.lane].push(item);
    return acc;
  },
  {}
);
```

**page.tsx Update**:
```tsx
<ItemGrid
  availableItems={availableItems}
  currentState={currentState} // NEW: Pass state for prerequisite checks
  onQueueItem={handleQueueItem}
  canQueueItem={canQueueItem}
/>
```

### Acceptance Criteria
- [ ] Only items with met prerequisites are visible
- [ ] Tier 1 structures always visible (no prerequisites)
- [ ] Tier 2+ structures visible only after tier 1 requirements met
- [ ] Ships visible only after required facilities built
- [ ] Colonists visible only after required training facilities built
- [ ] Item counts update correctly as prerequisites are met
- [ ] No errors when filtering based on missing prerequisite data
- [ ] **NEW:** Prerequisite checking completes in <50ms for 100 items
- [ ] **NEW:** Failed prerequisite shows tooltip with requirements on hover
- [ ] **NEW:** Performance degrades gracefully with 1000+ items
- [ ] **NEW:** Cache invalidates when structures are built/destroyed

### Testing Requirements
```gherkin
# BDD Test Scenarios
Feature: Prerequisite Visibility
  Scenario: Player has completed Metal Mine
    Given Player has completed "Metal Mine"
    And "Advanced Factory" requires "Metal Mine"
    When Player opens item grid
    Then "Advanced Factory" should be visible
    And "Orbital Station" should be hidden

  Scenario: Prerequisites with multiple requirements
    Given Player has completed "Metal Mine" and "Research Lab"
    And "Tech Center" requires both "Metal Mine" and "Research Lab"
    When Player opens item grid
    Then "Tech Center" should be visible
```

```typescript
describe('PrerequisiteChecker', () => {
  let checker: CachedPrerequisiteChecker;
  let state: PlanetState;

  beforeEach(() => {
    state = createTestState();
    checker = new CachedPrerequisiteChecker(state, defs);
  });

  it('should handle items without prerequisites', () => {
    expect(checker.hasPrerequisites('metal_mine')).toBe(true);
  });

  it('should check structure prerequisites', () => {
    state.structures['metal_mine'] = 0;
    expect(checker.hasPrerequisites('advanced_factory')).toBe(false);

    state.structures['metal_mine'] = 1;
    checker.clearCache();
    expect(checker.hasPrerequisites('advanced_factory')).toBe(true);
  });

  it('should use cache for repeated checks', () => {
    const spy = jest.spyOn(state.structures, 'metal_mine', 'get');

    checker.hasPrerequisites('advanced_factory');
    checker.hasPrerequisites('advanced_factory');

    expect(spy).toHaveBeenCalledTimes(1); // Second call uses cache
  });

  it('should complete in <50ms for 100 items', () => {
    const items = generateTestItems(100);
    const start = performance.now();

    items.forEach(item => checker.hasPrerequisites(item.id));

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
```

### Risk Mitigation
- **Incomplete prerequisite data**: Add defensive checks for missing `requires` field
- **Performance**: Implemented caching with O(1) lookup after first check
- **UX**: Consider showing locked items with visual indicator in future iteration

---

## FEATURE-5: Add Completed Structures Section

**Priority**: Medium
**Effort**: 3 hours
**Status**: Open

### Problem Statement
There's no visual display of completed structures in the current UI. Players need to see what structures have been built, how many of each type, and their collective outputs/consumption. This information is critical for strategic planning.

### Technical Specification
**New Component**: `src/components/CompletedStructures.tsx`

**Data Requirements**:
```typescript
export interface CompletedStructuresProps {
  structures: Record<string, number>; // structure ID → count
  defs: Record<string, ItemDefinition>; // For looking up structure details
}

interface StructureDisplay {
  id: string;
  name: string;
  count: number;
  outputs: Record<ResourceId, number>; // Total outputs (count × perUnit)
  consumption: Record<ResourceId, number>; // Total consumption
  groundSpace: number; // Total ground space used
  orbitalSpace: number; // Total orbital space used
}
```

**Component Design**:
```tsx
export function CompletedStructures({ structures, defs }: CompletedStructuresProps) {
  // Calculate aggregate data for each structure type
  const structureData: StructureDisplay[] = Object.entries(structures)
    .filter(([id, count]) => count > 0)
    .map(([id, count]) => {
      const def = defs[id];
      // Calculate totals based on count
      // ...
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4">
      <h3 className="text-lg font-bold text-pink-nebula-text mb-4">
        Completed Structures
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-pink-nebula-muted border-b border-pink-nebula-border">
            <th className="text-left py-2">Structure</th>
            <th className="text-center py-2">Count</th>
            <th className="text-right py-2">Outputs</th>
            <th className="text-right py-2">Energy</th>
            <th className="text-right py-2">GS/OS</th>
          </tr>
        </thead>
        <tbody>
          {structureData.map((structure) => (
            <tr key={structure.id} className="border-b border-pink-nebula-border/50 last:border-0">
              <td className="py-2 text-pink-nebula-text font-semibold">
                {structure.name}
              </td>
              <td className="text-center py-2 text-pink-nebula-accent-primary font-mono">
                {structure.count}
              </td>
              <td className="text-right py-2 text-xs">
                {/* Render resource outputs with colors */}
              </td>
              <td className="text-right py-2 text-yellow-400 font-mono">
                {structure.consumption.energy > 0 ? `-${structure.consumption.energy}` : '—'}
              </td>
              <td className="text-right py-2 text-pink-nebula-muted font-mono">
                {structure.groundSpace > 0 && `${structure.groundSpace} GS`}
                {structure.orbitalSpace > 0 && `${structure.orbitalSpace} OS`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {structureData.length === 0 && (
        <div className="text-center text-pink-nebula-muted py-4">
          No structures built yet
        </div>
      )}
    </div>
  );
}
```

**Integration in page.tsx**:
Add to PlanetSummary or as standalone section in main layout.

### Visual Specification
- **Table Layout**: Clean, scannable structure list
- **Color Coding**:
  - Resource outputs use resource colors (pink/blue/green/yellow)
  - Energy consumption in yellow with negative sign
  - Count in accent color for emphasis
- **Space Display**: "GS" for ground space, "OS" for orbital space
- **Empty State**: Message when no structures built

### Acceptance Criteria
- [ ] Displays all structure types with count > 0
- [ ] Shows aggregate outputs (e.g., 3 Metal Mines → +15 metal total)
- [ ] Shows aggregate energy consumption
- [ ] Shows total ground/orbital space used by each structure type
- [ ] Color-coded resource outputs matching game theme
- [ ] Sorted alphabetically by structure name
- [ ] Empty state displayed when no structures built
- [ ] Responsive layout on mobile devices

### Performance Considerations
- Use `useMemo` to cache structure data calculations
- Only recalculate when `structures` or `defs` change

---

## BUG-6: Cannot Queue Multiple Items Consecutively

**Priority**: Critical (Depends on BUG-0)
**Effort**: 2 hours
**Status**: Blocked by BUG-0

### Problem Statement
After queueing one item, the UI prevents queueing additional items. The expected behavior is to allow players to queue multiple items in sequence to plan their build order. This is a critical workflow blocker.

**User Story**: As a player, I want to queue multiple items in advance so that I can plan my build strategy efficiently.

### Investigation Required
Need comprehensive logging to determine root cause:
1. **State issue**: Is lane state not updating correctly after queue?
2. **Validation issue**: Is `canQueueItem` incorrectly blocking subsequent queues?
3. **Lane capacity**: Are lanes limited to one pending item?
4. **UI state**: Is error state persisting incorrectly?
5. **Resource calculation**: Are resources being double-counted?

### Technical Specification
**Files to Investigate**:
- `src/lib/game/commands.ts` - GameController.queueItem implementation
- `src/components/LaneBoard/ItemGrid.tsx` - Error handling and state management
- `src/lib/sim/engine/lanes.ts` - Lane queue logic
- `src/app/page.tsx` - handleQueueItem and canQueueItem implementations

**Expected Behavior**:
1. Player clicks item A → queues successfully
2. Player clicks item B → should queue behind A (or in another lane)
3. Player clicks item C → should queue behind B
4. All three items visible in their respective lane queues

**Debugging Steps**:
```typescript
// Add logging to identify issue
const handleItemClick = (itemId: string) => {
  console.log('Queueing item:', itemId);
  const validation = canQueueItem(itemId, 1);
  console.log('Validation result:', validation);

  if (!validation.allowed) {
    console.error('Queue blocked:', validation.reason);
    setError(validation.reason || 'Cannot queue item');
    return;
  }

  onQueueItem(itemId, 1);
  console.log('Item queued successfully');
};
```

### Potential Fixes

**If lane capacity issue**:
```typescript
// In lanes.ts - Allow multiple pending items via queue array
export interface LaneState {
  pending: WorkItem | null; // CHANGE TO: WorkItem[] for queue
  active: WorkItem | null;
}
```

**If validation issue**:
```typescript
// In canQueueItem - Only check resources, not lane state
const canQueueItem = (itemId: string, quantity: number) => {
  const def = defs[itemId];
  const costs = def.costsPerUnit;

  // Check resources only (don't block based on lane occupancy)
  const canAfford =
    currentState.stocks.metal >= costs.metal * quantity &&
    currentState.stocks.mineral >= costs.mineral * quantity &&
    // ... other resource checks

  return { allowed: canAfford, reason: canAfford ? undefined : 'Insufficient resources' };
};
```

### Acceptance Criteria
- [ ] Can queue 3+ items consecutively in same lane
- [ ] Can queue items in different lanes without blocking
- [ ] Queue order preserved (first queued → first in line)
- [ ] Resources deducted at queue time for each item
- [ ] No error messages for valid consecutive queues
- [ ] UI updates immediately after each queue action
- [ ] **NEW:** Queue supports up to 10 items per lane
- [ ] **NEW:** Resource validation accounts for pending queue items
- [ ] **NEW:** Cancel operation refunds resources correctly
- [ ] **NEW:** State updates are atomic and consistent

### Testing Requirements
```typescript
describe('Multiple Item Queueing', () => {
  let controller: GameController;
  let initialResources: ResourceState;

  beforeEach(() => {
    controller = new GameController(createTestState());
    initialResources = { metal: 1000, mineral: 1000, food: 500, energy: 500 };
  });

  it('should queue multiple items in sequence', () => {
    controller.queueItem('metal_mine', 1); // Cost: 400 metal
    controller.queueItem('mineral_extractor', 1); // Cost: 300 mineral

    const queue = controller.getLaneQueue('building');
    expect(queue.length).toBe(2);
    expect(queue[0].itemId).toBe('metal_mine');
    expect(queue[1].itemId).toBe('mineral_extractor');
  });

  it('should deduct resources for each queued item', () => {
    controller.queueItem('metal_mine', 1); // -400 metal
    expect(controller.getResources().metal).toBe(600);

    controller.queueItem('mineral_extractor', 1); // -300 mineral
    expect(controller.getResources().mineral).toBe(700);
  });

  it('should prevent queueing when resources insufficient', () => {
    controller.queueItem('metal_mine', 1); // -400 metal
    controller.queueItem('metal_mine', 1); // -400 metal

    // Third mine would require 400 metal, only 200 remaining
    const result = controller.canQueueItem('metal_mine', 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient metal');
  });

  it('should refund resources when canceling', () => {
    controller.queueItem('metal_mine', 1);
    expect(controller.getResources().metal).toBe(600);

    controller.cancelQueueItem('building', 0);
    expect(controller.getResources().metal).toBe(1000);
  });

  it('should enforce queue depth limit', () => {
    for (let i = 0; i < 10; i++) {
      controller.queueItem('farm', 1); // Cheap item
    }

    const result = controller.canQueueItem('farm', 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Queue full');
  });
});
```

### Debugging Implementation
```typescript
// Enhanced logging for investigation
const handleItemClick = (itemId: string) => {
  console.group(`Queue Item: ${itemId}`);
  console.log('Pre-queue state:', {
    resources: controller.getResources(),
    queueLength: controller.getLaneQueue(getLaneForItem(itemId)).length,
    laneState: controller.getLaneState(getLaneForItem(itemId))
  });

  const validation = canQueueItem(itemId, 1);
  console.log('Validation result:', validation);

  if (!validation.allowed) {
    console.error('Queue blocked:', validation.reason);
    setError(validation.reason || 'Cannot queue item');
    console.groupEnd();
    return;
  }

  try {
    onQueueItem(itemId, 1);
    console.log('Post-queue state:', {
      resources: controller.getResources(),
      queueLength: controller.getLaneQueue(getLaneForItem(itemId)).length
    });
  } catch (error) {
    console.error('Queue failed:', error);
  }
  console.groupEnd();
};
```

### Risk Mitigation
- **Resource depletion**: Implemented resource tracking across queued items
- **Queue overflow**: Enforced max queue depth of 10 items
- **Cancel behavior**: Added transaction rollback for resource refunds
- **State consistency**: Use command pattern for atomic operations (see BUG-0)

---

## BUG-7: No Batching Support for Ships and Colonists

**Priority**: Critical (elevated from High - core gameplay feature)
**Effort**: 2 hours
**Status**: Open

### Problem Statement
Ships and colonists should support batching (queueing multiple units at once), but the ItemGrid interface only queues quantity=1. Players need the ability to specify batch sizes for efficient production planning.

### Use Case
**Title**: Queue Multiple Ships in Batch
**Primary Actor**: Experienced Player
**Goal**: Efficiently queue large fleets without repetitive clicking
**Preconditions**: Ship facility built, sufficient resources

**Main Success Scenario**:
1. Player clicks ship item
2. System displays quantity selector
3. Player enters desired quantity (e.g., 10)
4. System validates resources for full batch
5. System queues ships with quantity marker

**Extensions**:
- 3a. Insufficient resources:
  - System shows maximum possible quantity
  - Player adjusts or cancels

### Technical Specification
**File**: `src/components/LaneBoard/ItemGrid.tsx`

**Changes Required**:
1. Add quantity input field when item clicked (for ships/colonists only)
2. Show modal or inline input for batch size selection
3. Pass selected quantity to `onQueueItem`
4. Maintain one-click default (quantity=1) for structures

**Implementation Option A: Inline Quantity Selector**
```tsx
const [batchingItem, setBatchingItem] = useState<string | null>(null);
const [batchQuantity, setBatchQuantity] = useState<number>(1);

const handleItemClick = (itemId: string, laneId: string) => {
  const supportsBatching = laneId === 'ship' || laneId === 'colonist';

  if (supportsBatching) {
    // Show quantity input
    setBatchingItem(itemId);
    setBatchQuantity(1);
  } else {
    // Queue immediately with quantity=1
    queueItemWithValidation(itemId, 1);
  }
};

const queueItemWithValidation = (itemId: string, quantity: number) => {
  const validation = canQueueItem(itemId, quantity);
  if (!validation.allowed) {
    setError(validation.reason || 'Cannot queue item');
    return;
  }
  onQueueItem(itemId, quantity);
  setBatchingItem(null);
  setError(null);
};

// Render quantity selector when batchingItem is set
{batchingItem && (
  <div className="mt-4 p-4 bg-pink-nebula-bg rounded border border-pink-nebula-border">
    <div className="flex items-center gap-3">
      <label className="text-sm font-semibold text-pink-nebula-text">
        Quantity:
      </label>
      <input
        type="number"
        value={batchQuantity}
        onChange={(e) => setBatchQuantity(parseInt(e.target.value) || 1)}
        min={1}
        className="w-24 px-3 py-2 bg-pink-nebula-panel border border-pink-nebula-border rounded text-pink-nebula-text text-center"
      />
      <button
        onClick={() => queueItemWithValidation(batchingItem, batchQuantity)}
        className="px-4 py-2 bg-pink-nebula-accent-primary text-pink-nebula-text rounded hover:bg-pink-nebula-accent-secondary"
      >
        Queue
      </button>
      <button
        onClick={() => setBatchingItem(null)}
        className="px-4 py-2 bg-pink-nebula-bg text-pink-nebula-muted rounded hover:bg-pink-nebula-panel"
      >
        Cancel
      </button>
    </div>
    <div className="text-xs text-pink-nebula-muted mt-2">
      Final quantity determined at activation based on available resources
    </div>
  </div>
)}
```

**Implementation Option B: Modal Dialog**
Create separate modal component for batch selection (cleaner but more code).

### Visual Specification
- **Trigger**: Clicking ship/colonist item opens quantity selector
- **Input**: Number input with increment/decrement buttons
- **Actions**: "Queue" button (primary), "Cancel" button (secondary)
- **Hint**: Display batching caveat ("Final quantity determined at activation")
- **Validation**: Show error if quantity exceeds resource availability

### Acceptance Criteria
- [ ] Clicking ship item opens batch quantity selector
- [ ] Clicking colonist item opens batch quantity selector
- [ ] Clicking structure item queues immediately (no batching)
- [ ] Quantity input accepts values ≥1
- [ ] "Queue" button calls onQueueItem with selected quantity
- [ ] "Cancel" button closes selector without queueing
- [ ] Validation runs with selected quantity before queueing
- [ ] Mobile layout handles quantity selector appropriately
- [ ] **NEW:** Maximum batch size enforced (100 units)
- [ ] **NEW:** System shows max affordable quantity hint
- [ ] **NEW:** Keyboard shortcuts: Enter to confirm, Escape to cancel
- [ ] **NEW:** Input validates numeric values only

### Testing Requirements
```typescript
describe('Batch Queueing for Ships/Colonists', () => {
  it('should show quantity selector for ships', () => {
    const { getByTestId } = render(<ItemGrid {...props} />);
    fireEvent.click(getByTestId('item-scout_ship'));

    expect(getByTestId('batch-quantity-input')).toBeInTheDocument();
    expect(getByTestId('batch-queue-button')).toBeInTheDocument();
  });

  it('should not show quantity selector for structures', () => {
    const { queryByTestId } = render(<ItemGrid {...props} />);
    fireEvent.click(getByTestId('item-metal_mine'));

    expect(queryByTestId('batch-quantity-input')).not.toBeInTheDocument();
    expect(props.onQueueItem).toHaveBeenCalledWith('metal_mine', 1);
  });

  it('should calculate maximum affordable quantity', () => {
    // Scout ship costs 100 metal, player has 550 metal
    const { getByTestId } = render(<ItemGrid {...props} />);
    fireEvent.click(getByTestId('item-scout_ship'));

    const hint = getByTestId('max-quantity-hint');
    expect(hint.textContent).toContain('Max affordable: 5');
  });

  it('should validate batch size limits', () => {
    const { getByTestId } = render(<ItemGrid {...props} />);
    fireEvent.click(getByTestId('item-scout_ship'));

    const input = getByTestId('batch-quantity-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '150' } });

    expect(input.value).toBe('100'); // Clamped to max
  });

  it('should handle keyboard shortcuts', () => {
    const { getByTestId } = render(<ItemGrid {...props} />);
    fireEvent.click(getByTestId('item-scout_ship'));

    const input = getByTestId('batch-quantity-input');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onQueueItem).toHaveBeenCalledWith('scout_ship', 5);
  });
});
```

### Performance Considerations
- Batch validation should complete in <10ms
- Maximum batch size prevents UI freezing
- Resource calculation cached during quantity changes

---

## FEATURE-8: Relocate Ships Display to Queue Component

**Priority**: Medium
**Effort**: 2 hours
**Status**: Open

### Problem Statement
The "Ships" section currently appears in PlanetDashboard as a separate card. For better UX, it should be integrated into the ship queue display component (CompactLane for ships), creating a unified view of queued + completed ships.

### Technical Specification
**Files**:
- `src/components/QueueDisplay/CompactLane.tsx` - Extend to show built ships
- `src/components/PlanetDashboard.tsx` - Remove Ships section
- `src/app/page.tsx` - Pass ships data to ship CompactLane

**Changes Required**:

**1. Update CompactLane Interface**:
```typescript
export interface CompactLaneProps {
  laneId: LaneId;
  laneView: LaneView;
  currentTurn: number;
  onCancel: (index: number) => void;
  disabled?: boolean;
  completedUnits?: Record<string, number>; // NEW: For ships display
}
```

**2. Add Built Ships Section to Ship Lane**:
```tsx
export function CompactLane({
  laneId,
  laneView,
  currentTurn,
  onCancel,
  disabled,
  completedUnits
}: CompactLaneProps) {
  // ... existing queue display code

  return (
    <div className={`bg-pink-nebula-panel rounded-lg border-2 ${getLaneColor()} p-4`}>
      {/* Existing queue header and entries */}

      {/* NEW: Built Ships Section (only for ship lane) */}
      {laneId === 'ship' && completedUnits && Object.keys(completedUnits).length > 0 && (
        <div className="mt-4 pt-4 border-t border-pink-nebula-border">
          <h4 className="text-sm font-semibold text-pink-nebula-muted mb-2">
            Fleet
          </h4>
          <div className="space-y-1">
            {Object.entries(completedUnits).map(([shipId, count]) => (
              <div key={shipId} className="flex items-center justify-between text-xs">
                <span className="text-pink-nebula-text">
                  {formatShipName(shipId)}
                </span>
                <span className="text-pink-nebula-accent-secondary font-mono font-bold">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**3. Update page.tsx to pass ships data**:
```tsx
<CompactLane
  laneId="ship"
  laneView={shipLane}
  currentTurn={viewTurn}
  onCancel={(index) => handleCancelItem('ship')}
  disabled={viewTurn < totalTurns - 1}
  completedUnits={summary.ships} // NEW: Pass ships data
/>
```

**4. Remove Ships section from PlanetDashboard**:
```tsx
// DELETE this entire section from PlanetDashboard.tsx (lines ~209-240)
{/* Ships Section - Table Layout */}
```

**5. Widen ship lane if needed**:
```tsx
// In page.tsx, adjust grid if ship column needs more space
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_320px_280px] gap-4 mb-6">
  {/* Structures: 280px */}
  {/* Ships: 320px (wider for fleet display) */}
  {/* Colonists: 280px */}
</div>
```

### Visual Specification
- **Layout**: Built ships appear below queue in same card
- **Divider**: Border-top separator between queue and fleet
- **Title**: "Fleet" label for built ships section
- **Ship Display**: Name on left, count on right (monospace font)
- **Color**: Ship counts use accent-secondary color
- **Conditional**: Only show fleet section if ships exist

### Acceptance Criteria
- [ ] Built ships displayed in ship CompactLane component
- [ ] Ships section removed from PlanetDashboard
- [ ] Clear visual separation between queue and fleet
- [ ] Ship names formatted consistently (e.g., "Scout Ship" not "scout_ship")
- [ ] Ship counts use monospace font and accent color
- [ ] Component width increased to accommodate fleet display
- [ ] Empty fleet doesn't show fleet section
- [ ] Mobile layout handles wider ship column gracefully

---

## FEATURE-9: Reorganize Layout - Queues + Space Remaining Row

**Priority**: Medium
**Effort**: 2 hours
**Status**: Open

### Problem Statement
The three queue lanes are currently in their own row, while "Space Remaining" is in PlanetDashboard. For better spatial efficiency and logical grouping, the queues and space remaining should share the same horizontal row.

### Technical Specification
**Files**:
- `src/app/page.tsx` - Update main layout grid
- `src/components/PlanetDashboard.tsx` - Extract "Space Remaining" section

**Proposed Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Header (Turn Controls, Warnings, Planet Dashboard Summary) │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┬─────────────────────┐   │
│ │Structures│  Ships   │Colonists │   Space Remaining   │   │
│ │  Queue   │  Queue + │  Queue   │   - Ground: [====  ]│   │
│ │          │  Fleet   │          │   - Orbital: [===  ]│   │
│ │          │          │          │   - Population Bars │   │
│ └──────────┴──────────┴──────────┴─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Item Grid (3 columns)                     │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:

**1. Create SpaceRemaining Component** (extract from PlanetDashboard):
```tsx
// src/components/SpaceRemaining.tsx
"use client";

import React from 'react';
import type { PlanetSummary } from '../lib/game/selectors';

export interface SpaceRemainingProps {
  summary: PlanetSummary;
}

export function SpaceRemaining({ summary }: SpaceRemainingProps) {
  // ... extract space section code from PlanetDashboard (lines 162-270)
  // Include: Ground bar, Orbital bar, Population bars
}
```

**2. Update page.tsx Layout**:
```tsx
{/* Main Content - Queues Row + Space */}
<main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-6">
  {/* Queues + Space Remaining Row */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_320px_280px_1fr] gap-4 mb-6">
    {/* Lane 1: Structures */}
    <CompactLane ... />

    {/* Lane 2: Ships + Fleet */}
    <CompactLane ... completedUnits={summary.ships} />

    {/* Lane 3: Colonists */}
    <CompactLane ... />

    {/* Column 4: Space Remaining */}
    <SpaceRemaining summary={summary} />
  </div>

  {/* Item Selection Grid */}
  <div className="bg-pink-nebula-panel ...">
    <ItemGrid ... />
  </div>
</main>
```

**3. Remove Space from PlanetDashboard**:
```tsx
// In PlanetDashboard.tsx, update grid to 3 columns instead of 4
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ...">
  {/* Resources - 2 columns */}
  {/* Population - 1 column */}
  {/* Ships REMOVED (moved to CompactLane) */}
  {/* Space REMOVED (moved to SpaceRemaining component) */}
</div>
```

### Visual Specification
- **Grid**: 4-column layout on desktop (3 queues + space)
- **Queue Columns**: 280px, 320px, 280px (ship lane wider)
- **Space Column**: 1fr (flexible, fills remaining space)
- **Mobile**: Stack vertically (queues first, then space)
- **Spacing**: Consistent gap-4 between all columns

### Acceptance Criteria
- [ ] Three queue lanes in first three columns
- [ ] Space Remaining in fourth column (same row)
- [ ] Ship lane includes built fleet display
- [ ] Space Remaining shows ground/orbital bars + population bars
- [ ] Layout responsive on tablet (2 columns)
- [ ] Layout responsive on mobile (1 column stack)
- [ ] All sections maintain proper spacing and borders
- [ ] No visual regressions in PlanetDashboard (now 3 columns)

---

## FEATURE-10: Add Completed Structures to Planet Summary

**Priority**: Medium
**Effort**: 3 hours
**Status**: Open

### Problem Statement
PlanetSummary component should include a comprehensive overview of completed structures showing build counts, aggregate outputs, energy consumption, and space usage. This provides strategic visibility into the planet's production infrastructure.

### Technical Specification
**File**: `src/components/PlanetSummary.tsx`

**Changes Required**:
1. Add new "Completed Structures" section after existing sections
2. Create table displaying structure name, count, outputs, energy, and space
3. Calculate aggregate values (count × perUnit outputs)
4. Color-code resource outputs consistently

**Data Access**:
```typescript
// PlanetSummary already receives summary prop which includes:
// - summary.structures (if added to selector)
// Need to extend PlanetSummary type to include structure details

// In selectors.ts, extend getPlanetSummary to include structure data
export interface PlanetSummary {
  // ... existing fields
  completedStructures: Array<{
    id: string;
    name: string;
    count: number;
    totalOutputs: Record<ResourceId, number>;
    totalConsumption: Record<ResourceId, number>;
    totalGroundSpace: number;
    totalOrbitalSpace: number;
  }>;
}
```

**Implementation in PlanetSummary.tsx**:
```tsx
{/* Completed Structures Section */}
<div>
  <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">
    Completed Structures
  </h3>
  <table className="w-full text-sm">
    <thead>
      <tr className="text-pink-nebula-muted border-b border-pink-nebula-border">
        <th className="text-left py-2">Structure</th>
        <th className="text-center py-2">Count</th>
        <th className="text-right py-2">Outputs</th>
        <th className="text-right py-2">Energy</th>
        <th className="text-right py-2">Space</th>
      </tr>
    </thead>
    <tbody>
      {summary.completedStructures.map((structure) => (
        <tr key={structure.id} className="border-b border-pink-nebula-border last:border-0">
          <td className="py-2 text-pink-nebula-text font-semibold">
            {structure.name}
          </td>
          <td className="text-center py-2 text-pink-nebula-accent-primary font-mono">
            {structure.count}
          </td>
          <td className="text-right py-2 text-xs space-x-2">
            {Object.entries(structure.totalOutputs)
              .filter(([_, amount]) => amount > 0)
              .map(([resource, amount]) => (
                <span key={resource} className={getResourceColor(resource)}>
                  {resource.charAt(0).toUpperCase()}:{formatNumber(amount)}
                </span>
              ))}
          </td>
          <td className="text-right py-2 text-yellow-400 font-mono">
            {structure.totalConsumption.energy > 0
              ? `-${formatNumber(structure.totalConsumption.energy)}`
              : '—'}
          </td>
          <td className="text-right py-2 text-pink-nebula-muted font-mono text-xs">
            {structure.totalGroundSpace > 0 && `${structure.totalGroundSpace} GS`}
            {structure.totalOrbitalSpace > 0 && `${structure.totalOrbitalSpace} OS`}
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {summary.completedStructures.length === 0 && (
    <div className="text-center text-pink-nebula-muted py-4 text-sm">
      No structures completed yet
    </div>
  )}
</div>
```

**Update selectors.ts**:
```typescript
export function getPlanetSummary(state: PlanetState): PlanetSummary {
  // ... existing code

  // Calculate completed structures summary
  const completedStructures = Object.entries(state.structures)
    .filter(([id, count]) => count > 0)
    .map(([id, count]) => {
      const def = state.defs[id];

      // Calculate aggregate outputs
      const totalOutputs: Record<ResourceId, number> = {
        metal: (def.outputsPerTurn?.metal || 0) * count,
        mineral: (def.outputsPerTurn?.mineral || 0) * count,
        food: (def.outputsPerTurn?.food || 0) * count,
        energy: (def.outputsPerTurn?.energy || 0) * count,
      };

      // Calculate aggregate consumption
      const totalConsumption: Record<ResourceId, number> = {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: (def.consumesPerTurn?.energy || 0) * count,
      };

      // Calculate space usage
      const spacePerUnit = def.costsPerUnit?.space || 0;
      const isOrbital = def.type === 'structure' && def.spaceType === 'orbital';

      return {
        id,
        name: def.name,
        count,
        totalOutputs,
        totalConsumption,
        totalGroundSpace: isOrbital ? 0 : spacePerUnit * count,
        totalOrbitalSpace: isOrbital ? spacePerUnit * count : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    // ... existing fields
    completedStructures,
  };
}
```

### Visual Specification
- **Table Layout**: 5 columns (Structure, Count, Outputs, Energy, Space)
- **Structure Name**: Left-aligned, semibold
- **Count**: Center-aligned, accent color, monospace
- **Outputs**: Right-aligned, color-coded per resource, compact format
- **Energy**: Right-aligned, yellow, shows negative with minus sign
- **Space**: Right-aligned, muted, shows "GS" or "OS" suffix
- **Empty State**: Centered message when no structures

### Acceptance Criteria
- [ ] Section appears in PlanetSummary after other sections
- [ ] Displays all structure types with count > 0
- [ ] Shows aggregate outputs (e.g., 3 Metal Mines = +15 metal)
- [ ] Shows aggregate energy consumption per structure type
- [ ] Shows total GS/OS used by each structure type
- [ ] Resource outputs color-coded (metal=pink, mineral=blue, food=green, energy=yellow)
- [ ] Structures sorted alphabetically
- [ ] Empty state when no structures built
- [ ] Responsive layout on mobile

### Performance Considerations
- Structure summary calculated in selector (memoized by React)
- Use `useMemo` if additional client-side calculations needed

---

## FEATURE-11: Auto-Advance Turn When Queue Empty

**Priority**: High
**Effort**: 1.5 hours
**Status**: Open

### Problem Statement
Currently, players must manually click "Advance" to see future turns. When a player queues an item, the view should automatically jump to the first future turn where all building queues are empty, allowing them to immediately queue the next item. This streamlines the planning workflow.

**User Story**: As a player, I want the UI to automatically advance to the next available turn so that I can quickly plan my build order without manual navigation.

### Technical Specification
**File**: `src/app/page.tsx`

**Changes Required**:
1. After successful `handleQueueItem`, calculate next empty turn
2. Update `viewTurn` to that turn automatically
3. Ensure logic handles edge cases (queue never empties, already at empty turn)

**Implementation with Failure Protection**:
```typescript
// Helper function with circuit breaker and performance optimization
const findNextEmptyQueueTurn = (startTurn: number): number => {
  const maxTurn = controller.getTotalTurns() - 1;
  const MAX_ITERATIONS = 1000; // Circuit breaker
  const startTime = performance.now();
  const TIMEOUT_MS = 100; // Performance budget

  let iterations = 0;
  for (let turn = startTurn; turn <= maxTurn && iterations < MAX_ITERATIONS; turn++) {
    iterations++;

    // Check timeout
    if (performance.now() - startTime > TIMEOUT_MS) {
      console.warn(`Turn calculation timeout after ${iterations} iterations`);
      return startTurn; // Graceful degradation
    }

    const state = controller.getStateAtTurn(turn);
    if (!state) continue;

    // Check if all lanes are empty (no pending, no active)
    const allLanesEmpty = Object.values(state.lanes).every(
      (lane) => !lane.pending && !lane.active
    );

    if (allLanesEmpty) {
      console.log(`Found empty turn ${turn} after ${iterations} checks`);
      return turn;
    }
  }

  // If no empty turn found or hit iteration limit
  console.warn(`No empty turn found after ${iterations} iterations`);
  return Math.min(startTurn + 10, maxTurn); // Jump ahead 10 turns max
};

// Update handleQueueItem
const handleQueueItem = (itemId: string, quantity: number) => {
  try {
    controller.queueItem(itemId, quantity);
    setError(null);

    // AUTO-ADVANCE: Jump to next turn where queues are empty
    const nextEmptyTurn = findNextEmptyQueueTurn(viewTurn + 1);
    setViewTurn(nextEmptyTurn);

  } catch (err: any) {
    setError(err.message || 'Failed to queue item');
  }
};
```

**Alternative Implementation** (if "empty queue" is too strict):
```typescript
// Find next turn where item would complete (queue processing complete)
const findNextQueueCompletionTurn = (startTurn: number): number => {
  // Look for turn where most recently queued item would finish
  // This allows continuous queueing without waiting for complete emptiness
};
```

### User Experience Flow
**Before**:
1. Player queues Metal Mine (3 turns)
2. Player manually advances turn slider to turn 3
3. Player queues next item
4. Repeat

**After**:
1. Player queues Metal Mine (3 turns)
2. View automatically jumps to turn 3 (when queue empty)
3. Player immediately queues next item
4. View jumps to next empty turn
5. Streamlined planning

### Edge Cases
- **Queue never empties**: Jump to final turn
- **Already at empty turn**: Stay at current turn
- **Multiple items queued**: Jump to turn when last item completes
- **User manually changes turn**: Don't auto-advance (respect user navigation)

### Acceptance Criteria
- [ ] Queueing item auto-advances view to next empty queue turn
- [ ] Works for all three lanes (structures, ships, colonists)
- [ ] Handles case where queues never empty (jumps to final turn)
- [ ] Handles case where already at empty turn (no jump)
- [ ] Manual turn slider usage doesn't trigger auto-advance
- [ ] Auto-advance feels smooth (not jarring)
- [ ] Players can still manually navigate turns if needed
- [ ] **NEW:** Calculation completes in <100ms
- [ ] **NEW:** Maximum 1000 turns checked before timeout
- [ ] **NEW:** Visual indicator shows turn jump (fade animation)
- [ ] **NEW:** Settings option to disable auto-advance
- [ ] **NEW:** Telemetry tracks auto-advance performance

### Testing Requirements
```typescript
describe('Auto-Advance Turn Feature', () => {
  it('should advance to next empty queue turn after queueing', () => {
    const controller = new GameController(createTestState());
    const component = render(<Home />);

    // Queue item that completes on turn 3
    fireEvent.click(component.getByTestId('item-metal_mine'));

    // Should auto-advance to turn 3
    expect(component.getByTestId('current-turn').textContent).toBe('3');
  });

  it('should handle timeout gracefully', () => {
    // Mock slow state calculation
    jest.spyOn(controller, 'getStateAtTurn').mockImplementation(() => {
      // Simulate slow operation
      const start = Date.now();
      while (Date.now() - start < 10) {} // 10ms delay per turn
      return mockState;
    });

    const startTurn = 0;
    const result = findNextEmptyQueueTurn(startTurn);

    // Should timeout and return startTurn
    expect(result).toBe(startTurn);
  });

  it('should respect iteration limit', () => {
    // Create state with never-empty queues
    const busyState = createBusyState();

    const result = findNextEmptyQueueTurn(0);

    // Should stop after MAX_ITERATIONS and jump ahead
    expect(result).toBeLessThanOrEqual(10); // Max 10 turn jump
  });

  it('should not auto-advance on manual turn change', () => {
    const component = render(<Home />);

    // Manually change turn
    fireEvent.change(component.getByTestId('turn-slider'), {
      target: { value: '5' }
    });

    // Queue item
    fireEvent.click(component.getByTestId('item-metal_mine'));

    // Should NOT auto-advance (respects manual navigation)
    expect(component.getByTestId('current-turn').textContent).toBe('5');
  });

  it('should complete within performance budget', () => {
    const states = generateLargeTurnHistory(2000);
    const start = performance.now();

    findNextEmptyQueueTurn(0);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // Must complete within 100ms
  });
});
```

### Risk Mitigation
- **User disorientation**: Added fade animation for visual continuity
- **Performance**: Implemented 100ms timeout and 1000 iteration circuit breaker
- **User control**: Added settings flag to disable auto-advance
- **Monitoring**: Added telemetry for performance tracking

---

## Summary

**Total Tickets**: 12 (7 bugs, 5 features)

**Priority Breakdown**:
- Critical: 4 (BUG-0, BUG-4, BUG-6, BUG-7)
- High: 2 (BUG-3, FEATURE-11)
- Medium: 6 (BUG-1, BUG-2, FEATURE-5, FEATURE-8, FEATURE-9, FEATURE-10)

**Effort Estimate**: ~22 hours total (increased from 20 due to testing requirements)

**Recommended Implementation Order**:
1. **BUG-0**: Define queue state architecture (prerequisite for BUG-6)
2. **BUG-6**: Cannot queue multiple items (critical workflow blocker)
3. **BUG-4**: Prerequisites not checked (critical game logic)
4. **BUG-7**: Batching support (elevated to critical - core gameplay)
5. **BUG-3**: Hide workers/outpost (high priority, quick fix)
6. **FEATURE-11**: Auto-advance turn (high value for UX)
7. **BUG-1**: Resource cost colors (medium priority polish)
8. **BUG-2**: Column width (medium priority polish)
9. **FEATURE-9**: Layout reorganization (medium, foundation for others)
10. **FEATURE-8**: Ships in queue component (medium, depends on FEATURE-9)
11. **FEATURE-5**: Completed structures component (medium)
12. **FEATURE-10**: Structures in planet summary (medium)

## Quality Requirements

### Testing Coverage
- **Unit Tests**: ≥80% coverage for all bug fixes
- **Integration Tests**: Required for BUG-4, BUG-6, FEATURE-11
- **Performance Tests**: Required for BUG-4 (<50ms), FEATURE-11 (<100ms)
- **BDD Scenarios**: Required for critical bugs

### Performance Benchmarks
- **BUG-4**: Prerequisite checking <50ms for 100 items
- **BUG-7**: Batch validation <10ms
- **FEATURE-11**: Turn calculation <100ms with 1000 iteration limit

### Architecture Standards
- **State Management**: Command pattern for queue operations
- **Interface Design**: Single responsibility principle for all components
- **Failure Handling**: Circuit breakers for all computation-heavy features
- **Caching Strategy**: O(1) lookups for repeated operations
