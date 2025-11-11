# Queue System and Food Economy Tickets

This document tracks critical bugs and features for the turn-based simulator.

---

## Status: All Critical Tickets Completed ✅

### Completed Tickets

#### ✅ TICKET-6: Export Feature Investigation and Fix
**Status**: Completed - FULLY FUNCTIONAL
**Investigation Results**:
- Export logic had two critical issues:
  1. UI rendering: ExportModal conditional rendering was too strict
  2. **CRITICAL**: Export was skipping completed items (defeating the purpose of a build order planner!)

**Root Causes Found**:
- User reported: "when i queue a few buildings it says 'Queue is empty'"
- Buildings WERE being queued successfully
- Export modal wasn't rendering due to conditional check
- **More critically**: Export was skipping completed items, so players couldn't share their full strategy

**Implemented**:
- Fixed modal rendering condition to always render when requested
- Provide default empty lane structures if lanes are undefined
- Fixed extractQueueItems to properly handle active items using eta
- **CRITICAL FIX**: Export now includes completed items (full build order from turn 1)
- Updated tests to validate complete build order export
- Updated documentation to clarify this is a build order planner

**User Impact**:
- Export now shows COMPLETE build order (completed + active + pending items)
- Players can share their full strategy with friends
- Modal always renders when export buttons are clicked
- Both plain text and Discord exports function correctly

#### ✅ TICKET-1: Implement Fixed 200-Turn Timeline with CSV Debugging
**Status**: Completed in commit 2b16cd6
**Implemented**:
- Fixed 200-turn timeline architecture
- Timeline recomputation with stable state optimization
- Queue removal from any turn
- All tests passing (348 passed)

**Not Implemented** (optional):
- CSV debugging system for production debugging (can be added if needed)

---

#### ✅ TICKET-2: Fix Population Food Upkeep to Reduce Production Before Stocks
**Status**: Completed
**Implemented**:
- Food upkeep now reduces production before touching stocks
- No double deduction of upkeep
- Proper stock clamping to 0 minimum
- Growth only happens when food > 0
- All tests passing

---

## Feature Tickets (Not Started)

### TICKET-3: Drag and Drop Queue Reordering
**Priority**: High
**Effort**: 3-4 hours
**Status**: Not Started
**Component**: Queue Management System
**Related Files**:
- `src/components/QueueDisplay/CompactLane.tsx`
- `src/components/QueueDisplay/CompactLaneEntry.tsx`
- `src/app/page.tsx` (handleReorderItem)
- `src/lib/game/commands.ts` (reorderQueueItem)

#### Problem Statement

Queue items cannot be reordered once placed. Players must remove and re-add items to change execution order, which is cumbersome and error-prone.

#### Technical Specification

**Simple and Elegant Solution**:
1. Use HTML5 drag and drop API with React state management
2. Implement at the CompactLane level to handle entire queue reordering
3. Single command pattern for state mutation and timeline recomputation

**Implementation Approach**:

```typescript
// In CompactLane.tsx
const [draggedItem, setDraggedItem] = useState<string | null>(null);
const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

const handleDragStart = (entryId: string) => {
  setDraggedItem(entryId);
};

const handleDragOver = (e: React.DragEvent, index: number) => {
  e.preventDefault();
  setDragOverIndex(index);
};

const handleDrop = (e: React.DragEvent, dropIndex: number) => {
  e.preventDefault();
  if (draggedItem && onReorder) {
    onReorder(laneId, draggedItem, dropIndex);
  }
  setDraggedItem(null);
  setDragOverIndex(null);
};

// In CompactLaneEntry.tsx
<div
  draggable={!disabled && entry.status === 'pending'}
  onDragStart={() => onDragStart(entry.id)}
  className={`${draggedItem === entry.id ? 'opacity-50' : ''}`}
>
```

**Command Pattern**:
```typescript
// In commands.ts
export function reorderQueueItem(
  controller: GameController,
  laneId: string,
  entryId: string,
  newIndex: number
): CommandResult {
  return controller.mutateTimeline((state) => {
    const lane = state.lanes[laneId];
    if (!lane) return;

    // Find item in pending queue
    const oldIndex = lane.pendingQueue.findIndex(e => e.id === entryId);
    if (oldIndex === -1) return;

    // Reorder array
    const item = lane.pendingQueue[oldIndex];
    lane.pendingQueue.splice(oldIndex, 1);
    lane.pendingQueue.splice(newIndex, 0, item);
  });
}
```

**State Recalculation**:
- Timeline automatically recomputes from mutation point forward
- Same behavior as add/remove operations
- Preserves all game state consistency

#### Acceptance Criteria

- [ ] Queue items show drag cursor on hover
- [ ] Items can be dragged and dropped within the same lane
- [ ] Visual feedback during drag (opacity change, drop zone indicator)
- [ ] Timeline recomputes after each reorder
- [ ] Cannot drag active or completed items
- [ ] Cannot drag between different lanes
- [ ] Mobile touch support (optional enhancement)
- [ ] Undo/redo support through existing timeline system

#### Testing Requirements

```typescript
describe('Queue Reordering', () => {
  it('should reorder pending items in queue', () => {
    // Queue 3 items
    controller.queueItem(1, 'farm', 1);
    controller.queueItem(1, 'metal_mine', 1);
    controller.queueItem(1, 'habitat', 1);

    // Reorder metal_mine to first position
    controller.reorderQueueItem('building', 'metal_mine_id', 0);

    // Verify new order
    const state = controller.getStateAtTurn(1);
    expect(state.lanes.building.pendingQueue[0].itemId).toBe('metal_mine');
    expect(state.lanes.building.pendingQueue[1].itemId).toBe('farm');
    expect(state.lanes.building.pendingQueue[2].itemId).toBe('habitat');
  });
});
```

---

### TICKET-4: Housing Cap Warning Improvement
**Priority**: Medium
**Effort**: 2 hours
**Status**: Not Started
**Component**: Population Display
**Related Files**:
- `src/components/PlanetDashboard.tsx`
- `src/lib/game/selectors.ts`

#### Problem Statement

Current housing cap warning uses a progress bar and doesn't accurately predict when workers will reach the housing cap based on current growth rate and queued buildings.

#### Technical Specification

**Requirements**:
1. Calculate turns until housing cap is reached AFTER last queued item completes
2. Show warning when ≤6 turns remain
3. Display as text in Population section, not as a progress bar
4. Consider actual growth rate from buildings at the completion turn

**Implementation Approach**:

```typescript
// In selectors.ts - Add new selector
export function getTurnsUntilHousingCap(
  state: GameState,
  lastItemCompletionTurn: number
): number | null {
  // Get state at completion turn
  const futureState = timeline.getStateAtTurn(lastItemCompletionTurn);

  // Calculate growth rate from buildings
  const farms = futureState.structures.filter(s => s.id === 'farm').length;
  const habitats = futureState.structures.filter(s => s.id === 'habitat').length;
  const growthPerTurn = calculateGrowthRate(farms, habitats);

  // Calculate turns to cap
  const currentWorkers = futureState.population.workers;
  const workerCap = futureState.housing.workerCap;
  const workersNeeded = workerCap - currentWorkers;

  if (growthPerTurn <= 0) return null;
  return Math.ceil(workersNeeded / growthPerTurn);
}

// In PlanetDashboard.tsx - Population section
const lastItemTurn = getLastQueuedItemCompletionTurn(laneViews);
const turnsToHousingCap = getTurnsUntilHousingCap(summary, lastItemTurn);

// In the Population card JSX
{turnsToHousingCap !== null && turnsToHousingCap <= 6 && (
  <div className="text-xs text-yellow-500 mt-2 pt-2 border-t border-pink-nebula-border/50">
    Workers will reach housing cap in {turnsToHousingCap} turns
  </div>
)}
```

**Remove Current Progress Bar**:
- Delete the "Growth Countdown" progress bar section (lines 294-318 in PlanetDashboard.tsx)
- Replace with conditional warning text

#### Acceptance Criteria

- [ ] Warning appears when housing cap will be reached in ≤6 turns after queue completion
- [ ] Text reads "Workers will reach housing cap in X turns"
- [ ] Displayed as text at bottom of Population section
- [ ] No progress bar shown
- [ ] Calculation uses growth rate from buildings at completion turn
- [ ] Warning updates as queue changes
- [ ] No warning if growth rate is 0 or negative

#### Testing Requirements

```typescript
describe('Housing Cap Warning', () => {
  it('should show warning when cap will be reached in ≤6 turns', () => {
    // Setup: Queue buildings that complete at turn 10
    // At turn 10: 95% housing capacity, growth rate = 100/turn
    // Housing cap in 5 turns

    render(<PlanetDashboard summary={mockSummary} />);

    expect(screen.getByText('Workers will reach housing cap in 5 turns'))
      .toBeInTheDocument();
  });

  it('should not show warning when >6 turns remain', () => {
    // Setup: Low population, high cap
    // Housing cap in 20 turns

    render(<PlanetDashboard summary={mockSummary} />);

    expect(screen.queryByText(/housing cap/))
      .not.toBeInTheDocument();
  });
});
```

---

### TICKET-5: Queue Export Functionality
**Priority**: Medium
**Effort**: 4-5 hours
**Status**: Not Started
**Component**: Export System
**Related Files**:
- `src/app/page.tsx` (Export button)
- `src/components/ExportModal.tsx` (New file)
- `src/lib/export/queueExporter.ts` (New file)
- `src/lib/export/formatters.ts` (New file)

#### Problem Statement

Players cannot share or save their build queues. This makes it difficult to collaborate, plan strategies, or save successful build orders for future games.

#### Technical Specification

**Export Button**:
```typescript
// In page.tsx - Add at bottom of page
<button
  onClick={() => setShowExportModal(true)}
  className="fixed bottom-4 right-4 px-6 py-3 bg-pink-nebula-accent-primary text-pink-nebula-text rounded-lg hover:bg-pink-nebula-accent-secondary transition-colors"
>
  Export
</button>
```

**Modal Component**:
```typescript
// src/components/ExportModal.tsx
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  laneViews: LaneView[];
  currentTurn: number;
}

export function ExportModal({ isOpen, onClose, laneViews, currentTurn }: ExportModalProps) {
  const handleExport = async (format: 'image' | 'text' | 'discord') => {
    switch (format) {
      case 'image':
        await exportAsImage(laneViews, currentTurn);
        break;
      case 'text':
        await exportAsText(laneViews, currentTurn);
        break;
      case 'discord':
        await exportAsDiscord(laneViews, currentTurn);
        break;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-pink-nebula-panel border-2 border-pink-nebula-border rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-pink-nebula-text mb-4">Export Build Queue</h2>

        <div className="space-y-3">
          <button
            onClick={() => handleExport('image')}
            className="w-full p-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded text-left"
          >
            <div className="font-semibold text-pink-nebula-text">Export as Image</div>
            <div className="text-xs text-pink-nebula-muted">PNG file (download or clipboard)</div>
          </button>

          <button
            onClick={() => handleExport('text')}
            className="w-full p-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded text-left"
          >
            <div className="font-semibold text-pink-nebula-text">Export as Plain Text</div>
            <div className="text-xs text-pink-nebula-muted">Simple list format</div>
          </button>

          <button
            onClick={() => handleExport('discord')}
            className="w-full p-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded text-left"
          >
            <div className="font-semibold text-pink-nebula-text">Export for Discord</div>
            <div className="text-xs text-pink-nebula-muted">Formatted table (8,192 char limit)</div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-pink-nebula-muted hover:text-pink-nebula-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

**Export Formatters**:
```typescript
// src/lib/export/formatters.ts

interface QueueItem {
  turn: number;
  lane: 'building' | 'ship' | 'colonist';
  name: string;
  quantity: number;
}

// Convert lane views to flat list of items with completion turns
function extractQueueItems(laneViews: LaneView[]): QueueItem[] {
  const items: QueueItem[] = [];

  laneViews.forEach(laneView => {
    laneView.entries.forEach(entry => {
      if (entry.status !== 'completed') {
        items.push({
          turn: entry.completionTurn || entry.eta || 0,
          lane: laneView.laneId,
          name: entry.itemName,
          quantity: entry.quantity
        });
      }
    });
  });

  return items.sort((a, b) => a.turn - b.turn);
}

// Plain text format: "[Turn Number] - [Building]/[Ships]/[Colonists]"
export function formatAsText(laneViews: LaneView[]): string {
  const items = extractQueueItems(laneViews);

  return items.map(item => {
    const type = item.lane === 'building' ? item.name :
                 item.lane === 'ship' ? `${item.quantity}x ${item.name}` :
                 `${item.quantity}x ${item.name}`;
    return `[${item.turn}] - ${type}`;
  }).join('\n');
}

// Discord table format with character limit check
export function formatAsDiscord(laneViews: LaneView[]): string {
  const items = extractQueueItems(laneViews);

  // Group items by turn
  const turnGroups = new Map<number, QueueItem[]>();
  items.forEach(item => {
    if (!turnGroups.has(item.turn)) {
      turnGroups.set(item.turn, []);
    }
    turnGroups.get(item.turn)!.push(item);
  });

  // Build table
  let table = '```\n';
  table += '| Turn | Structure       | Ship            | Colonist        |\n';
  table += '|------|-----------------|-----------------|-----------------|';

  const WARNING = 'Buildlist exceeds character limit on Discord\n\n';
  const DISCORD_LIMIT = 8192;
  let exceedsLimit = false;

  Array.from(turnGroups.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([turn, items]) => {
      const structure = items.find(i => i.lane === 'building');
      const ship = items.find(i => i.lane === 'ship');
      const colonist = items.find(i => i.lane === 'colonist');

      const row = `\n| ${String(turn).padEnd(4)} | ${
        structure ? structure.name.padEnd(15) : ' '.repeat(15)
      } | ${
        ship ? `${ship.quantity}x ${ship.name}`.padEnd(15) : ' '.repeat(15)
      } | ${
        colonist ? `${colonist.quantity}x ${colonist.name}`.padEnd(15) : ' '.repeat(15)
      } |`;

      if (table.length + row.length + 3 > DISCORD_LIMIT) { // +3 for closing ```
        exceedsLimit = true;
      }
      table += row;
    });

  table += '\n```';

  return exceedsLimit ? WARNING + table : table;
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
```

**Image Export**:
```typescript
// src/lib/export/queueExporter.ts
import html2canvas from 'html2canvas';

export async function exportAsImage(laneViews: LaneView[], currentTurn: number) {
  // Create temporary DOM element with queue visualization
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.backgroundColor = '#1a1a2e';
  container.style.color = '#ffffff';
  container.style.padding = '20px';
  container.style.fontFamily = 'monospace';
  container.style.width = '800px';

  // Build visual representation
  const items = extractQueueItems(laneViews);
  const content = `
    <h2 style="margin-bottom: 20px;">Build Queue - Turn ${currentTurn}</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #444;">
          <th style="text-align: left; padding: 8px;">Turn</th>
          <th style="text-align: left; padding: 8px;">Structure</th>
          <th style="text-align: left; padding: 8px;">Ship</th>
          <th style="text-align: left; padding: 8px;">Colonist</th>
        </tr>
      </thead>
      <tbody>
        ${generateTableRows(items)}
      </tbody>
    </table>
  `;

  container.innerHTML = content;
  document.body.appendChild(container);

  try {
    // Generate canvas
    const canvas = await html2canvas(container, {
      backgroundColor: '#1a1a2e',
      scale: 2 // Higher quality
    });

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    // Option 1: Copy to clipboard if supported
    if ('ClipboardItem' in window && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    } else {
      // Option 2: Download as file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `build-queue-turn-${currentTurn}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportAsText(laneViews: LaneView[], currentTurn: number) {
  const text = formatAsText(laneViews);
  await copyToClipboard(text);
}

export async function exportAsDiscord(laneViews: LaneView[], currentTurn: number) {
  const text = formatAsDiscord(laneViews);
  await copyToClipboard(text);
}
```

#### Dependencies

```json
// Add to package.json
"dependencies": {
  "html2canvas": "^1.4.1"
}
```

#### Acceptance Criteria

- [ ] Export button appears at bottom of page
- [ ] Clicking button opens modal with three export options
- [ ] **Image Export**:
  - [ ] Generates PNG with queue visualization
  - [ ] Copies to clipboard if supported
  - [ ] Falls back to download if clipboard not available
- [ ] **Plain Text Export**:
  - [ ] Format: "[Turn Number] - [Building]/[Ships]/[Colonists]"
  - [ ] Copies to clipboard
- [ ] **Discord Export**:
  - [ ] Markdown table format with exact column widths
  - [ ] Checks 8,192 character limit
  - [ ] Shows warning if exceeded: "Buildlist exceeds character limit on Discord"
  - [ ] Copies formatted table to clipboard
- [ ] Modal closes after successful export
- [ ] Visual feedback for successful clipboard copy

#### Testing Requirements

```typescript
describe('Queue Export', () => {
  it('should format as plain text correctly', () => {
    const mockLanes = [
      { laneId: 'building', entries: [
        { itemName: 'Habitat', completionTurn: 55, status: 'pending', quantity: 1 }
      ]},
      { laneId: 'ship', entries: [
        { itemName: 'Outpost Ship', completionTurn: 55, status: 'pending', quantity: 1 }
      ]}
    ];

    const text = formatAsText(mockLanes);
    expect(text).toContain('[55] - Habitat');
    expect(text).toContain('[55] - 1x Outpost Ship');
  });

  it('should format Discord table within character limit', () => {
    const mockLanes = generateMockLanes(50); // 50 items
    const discord = formatAsDiscord(mockLanes);

    expect(discord.length).toBeLessThan(8192);
    expect(discord).toContain('| Turn | Structure');
  });

  it('should warn when Discord format exceeds limit', () => {
    const mockLanes = generateMockLanes(500); // Many items
    const discord = formatAsDiscord(mockLanes);

    expect(discord).toStartWith('Buildlist exceeds character limit on Discord');
  });
});
```

---

### TICKET-6: Fix Export Feature Empty Output Bug
**Priority**: HIGH - Critical Bug
**Effort**: 1-2 hours
**Status**: Not Started
**Component**: Export System
**Related Files**:
- `src/lib/export/formatters.ts` (extractQueueItems function)
- `src/lib/game/selectors.ts` (getLaneView function)
- `src/components/ExportModal.tsx` (export handlers)

#### Problem Statement

The export feature is showing empty outputs for both plain text and Discord formats. The Discord output shows only the table headers with no data rows, and the plain text export says "Queue is empty - nothing to export" even when there are items in the queue.

**Example Discord Output**:
```
| Turn | Structure       | Ship            | Colonist        |
|------|-----------------|-----------------|-----------------|
```

#### Root Cause Analysis

After investigating the code flow:

1. **Data Flow**: `getLaneView()` → `ExportModal` → `extractQueueItems()` → formatters
2. **Issue Location**: The `extractQueueItems()` function in `formatters.ts` is filtering out all items
3. **Specific Problems**:
   - The function skips items where `entry.status === 'completed'` (correct behavior)
   - For remaining items, it uses `entry.completionTurn ?? entry.eta ?? 0`
   - For active items, `completionTurn` might be undefined (not completed yet)
   - The fallback to 0 causes issues with the maxTurn filtering logic

4. **Active Item Issue**: In `getLaneView()`, active items set `completionTurn: lane.active.completionTurn` which is likely undefined for items that haven't completed yet

#### Technical Solution

**Fix the extractQueueItems function to properly handle active and pending items**:

```typescript
// src/lib/export/formatters.ts - Update extractQueueItems
export function extractQueueItems(laneViews: LaneView[], maxTurn?: number): QueueItem[] {
  const items: QueueItem[] = [];

  laneViews.forEach(laneView => {
    laneView.entries.forEach(entry => {
      // Skip only completed items
      if (entry.status === 'completed') {
        return;
      }

      // Use the appropriate turn value based on status
      let turn: number;
      if (entry.status === 'active') {
        // Active items: use eta (calculated completion time)
        turn = entry.eta || 0;
      } else if (entry.status === 'pending') {
        // Pending items: prefer completionTurn, fall back to eta
        turn = entry.completionTurn ?? entry.eta ?? 0;
      } else {
        // Fallback for any other status
        turn = entry.completionTurn ?? entry.eta ?? 0;
      }

      // Skip items with turn 0 (invalid data)
      if (turn === 0) {
        console.warn(`Queue item ${entry.itemName} has no valid completion turn`);
        return;
      }

      // Skip items beyond maxTurn if specified (for "current view" export)
      if (maxTurn !== undefined && turn > maxTurn) {
        return;
      }

      items.push({
        turn,
        lane: laneView.laneId,
        name: entry.itemName,
        quantity: entry.quantity,
      });
    });
  });

  // Sort by turn
  return items.sort((a, b) => a.turn - b.turn);
}
```

**Alternative Solution - Fix at the source in getLaneView**:

```typescript
// src/lib/game/selectors.ts - Fix active item entry creation
// Line 263-279, ensure completionTurn is properly set
if (lane.active) {
  const def = state.defs[lane.active.itemId];
  const eta = state.currentTurn + lane.active.turnsRemaining;
  entries.push({
    id: lane.active.id,
    itemId: lane.active.itemId,
    itemName: def?.name || 'Unknown',
    status: 'active',
    quantity: lane.active.quantity,
    turnsRemaining: lane.active.turnsRemaining,
    eta,
    queuedTurn: lane.active.queuedTurn,
    startTurn: lane.active.startTurn,
    // Use eta for completionTurn if not yet completed
    completionTurn: lane.active.completionTurn || eta,
  });
}
```

#### Acceptance Criteria

- [ ] Plain text export shows all active and pending queue items
- [ ] Discord export shows all active and pending queue items in table format
- [ ] "Export Current View" correctly filters items up to current turn
- [ ] "Export Full List" shows all non-completed items
- [ ] No console warnings for valid queue items
- [ ] Completed items are correctly excluded from export
- [ ] Items show correct completion turns in export

#### Testing Requirements

```typescript
describe('Export Bug Fix', () => {
  it('should export active items correctly', () => {
    const mockLanes = [{
      laneId: 'building',
      entries: [{
        id: '1',
        itemId: 'farm',
        itemName: 'Farm',
        status: 'active',
        quantity: 1,
        turnsRemaining: 3,
        eta: 4, // Current turn 1 + 3 remaining
        completionTurn: undefined, // Not completed yet
        queuedTurn: 1
      }]
    }];

    const items = extractQueueItems(mockLanes);
    expect(items).toHaveLength(1);
    expect(items[0].turn).toBe(4);
    expect(items[0].name).toBe('Farm');
  });

  it('should export pending items correctly', () => {
    const mockLanes = [{
      laneId: 'ship',
      entries: [{
        id: '2',
        itemId: 'fighter',
        itemName: 'Fighter',
        status: 'pending',
        quantity: 5,
        turnsRemaining: 8,
        eta: 12,
        completionTurn: 12,
        queuedTurn: 1
      }]
    }];

    const items = extractQueueItems(mockLanes);
    expect(items).toHaveLength(1);
    expect(items[0].turn).toBe(12);
    expect(items[0].quantity).toBe(5);
  });

  it('should handle missing turn data gracefully', () => {
    const mockLanes = [{
      laneId: 'building',
      entries: [{
        id: '3',
        itemId: 'unknown',
        itemName: 'Unknown Building',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 0,
        eta: null,
        completionTurn: undefined,
        queuedTurn: 1
      }]
    }];

    const items = extractQueueItems(mockLanes);
    expect(items).toHaveLength(0); // Should skip invalid items
  });

  it('should produce non-empty Discord output when queue has items', () => {
    const mockLanes = [{
      laneId: 'building',
      entries: [{
        itemName: 'Farm',
        status: 'active',
        eta: 5,
        quantity: 1
      }]
    }];

    const discord = formatAsDiscord(mockLanes);
    expect(discord).toContain('| 5    | Farm');
    expect(discord).not.toBe('```\n| Turn | Structure       | Ship            | Colonist        |\n|------|-----------------|-----------------|-----------------|```');
  });
});
```

#### Implementation Steps

1. **Identify the issue**: Check if `completionTurn` is being set properly for active items
2. **Fix extractQueueItems**: Update the function to handle different statuses appropriately
3. **Add console warnings**: Log when items have invalid turn data
4. **Test thoroughly**: Verify exports work for all queue states
5. **Consider edge cases**: Empty queues, single items, mixed lanes

#### Notes

This is a critical bug that breaks the entire export feature. The fix should be prioritized as users cannot currently share their build orders, which is a key feature for strategy collaboration.

## Future Enhancements (Optional)

If debugging issues arise in production, consider implementing:

### CSV Debug Logging System
**Purpose**: Track all state changes for debugging and issue replication
**Priority**: Low (only needed for production debugging)
**Effort**: 2-3 hours

**Files to Create**:
- `src/lib/game/debug.ts` - CSV logging utilities

**CSV Files**:
1. `queue_operations.csv` - Track queue mutations
2. `planet_states.csv` - Snapshot state at each turn
3. `timeline_events.csv` - Track timeline recomputation events

**Implementation Approach**:
- Add optional logging flag to Timeline and GameController
- Log operations only when debugging flag is enabled
- Store CSVs in `game_logs/` directory
- Include session_id for grouping related operations

---

## Notes

All critical functionality for the turn-based simulator is now working:
- Fixed 200-turn timeline provides stable foundation
- Food economy accurately reflects production/consumption
- Queue operations work correctly from any turn
- All 348 tests passing with 0 failures

The codebase is ready for feature development or gameplay enhancements.
