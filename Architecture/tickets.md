# Implementation Tickets for 4X MMORPG Turn-Based Strategy Simulator

## Current Bug Fixes

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

## Completed Tickets Archive

The following tickets have been completed and moved to archive:

- Phase 0-2: Core engine implementation (Tickets 0-12) ✅
- Phase 3: UI Migration (Tickets 13-19) ✅
- Phase 4: Testing & Performance (Tickets 20-22) ✅
- UI Improvements: 8 tickets for better UX ✅
- Bug fixes: Idle lane warnings removal, prerequisite filtering ✅

All core functionality is now implemented with 296/297 tests passing.