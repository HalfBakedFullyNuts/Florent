# UI Redesign Tickets - Phase 5

## Ticket 20: Fix Resource Display Precision Bug
**Priority**: Critical (Production Bug)
**Estimated Effort**: 30 minutes
**Files**: `src/components/PlanetSummary.tsx`, `src/app/page.tsx`

### Problem
Food and energy stockpiles display with decimal places (e.g., "1.635,96"), while metal/mineral display correctly as integers. This is inconsistent and confusing for users.

### Root Cause
Food/energy are calculated with fractional values from production but should be displayed as integers like other resources.

### Acceptance Criteria
- [ ] All 4 resources (metal, mineral, food, energy) display as integers only
- [ ] Use `Math.floor()` for display (keep fractional values internally for calculations)
- [ ] European formatting maintained: "1.635" not "1,635"
- [ ] Fix applies to all locations:
  - Header resource display (if kept)
  - PlanetSummary resource table
  - Any tooltips or info panels
- [ ] Verify production values still show decimals where appropriate (e.g., "+12.5/turn")

### Implementation
```typescript
// PlanetSummary.tsx:30-32
const formatNumber = (num: number) => {
  return Math.floor(num).toLocaleString('de-DE');
};

// For production outputs (can show decimals):
const formatOutput = (output: number) => {
  const rounded = Math.round(output * 10) / 10; // One decimal place
  return output >= 0 ? `+${rounded.toLocaleString('de-DE')}` : rounded.toLocaleString('de-DE');
};
```

### Testing
- [ ] Queue structures that produce fractional resources
- [ ] Verify display shows integers but calculations use precise values
- [ ] Check all UI locations for consistency

---

## Ticket 21: Streamline Header to Essential Controls
**Priority**: Medium (UX Improvement)
**Estimated Effort**: 20 minutes
**Files**: `src/app/page.tsx`

### Problem
Header contains redundant resource display that will be shown in the redesigned planet summary. This creates visual clutter and information duplication.

### Current State
```tsx
<header>
  <h1>Title</h1>
  <div>Metal: 30.000 | Mineral: 20.000 | Food: 1.635 | Energy: 520</div>
  <button>Advance Turn</button>
</header>
```

### Desired State
```tsx
<header>
  <h1>Title</h1>
  <div>Turn 5 of 50</div>  // Optional: Add turn counter here
  <button>Advance Turn</button>
</header>
```

### Acceptance Criteria
- [ ] Remove entire resource display div from header
- [ ] Keep title on left side
- [ ] Keep "Advance Turn" button on right side
- [ ] Optional: Add "Turn X of Y" display if not redundant with slider
- [ ] Maintain header height and visual balance
- [ ] Button remains disabled when viewing past turns

### Implementation
```typescript
// page.tsx:127-149
<header className="bg-pink-nebula-panel px-6 py-4 border-b border-pink-nebula-border">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-wide">Infinite Conflict Simulator</h1>
    <button
      onClick={handleAdvanceTurn}
      disabled={viewTurn < totalTurns - 1}
      className={buttonClasses}
    >
      Advance Turn
    </button>
  </div>
</header>
```

### Edge Cases
- [ ] Verify button disabled state works without resource display
- [ ] Check responsive behavior on smaller screens

---

## Ticket 22: Redesign Planet Summary as Horizontal Dashboard
**Priority**: High (Core UX)
**Estimated Effort**: 3 hours
**Files**: `src/components/PlanetSummary.tsx`, `src/app/page.tsx`
**New Files**: `src/components/PlanetDashboard.tsx`

### Problem
Planet summary occupies valuable horizontal space in a sidebar. With 3 lanes + selection panel, horizontal space is at a premium. Moving to horizontal layout maximizes lane visibility.

### Design Requirements
- Full-width horizontal bar (1800px max-width, responsive)
- Height: 120-150px max (compact but readable)
- 5 sections in horizontal layout
- High information density without clutter
- Visual hierarchy: Resources > Population > Space > Housing > Growth

### Acceptance Criteria
- [ ] Create new `PlanetDashboard.tsx` component (horizontal layout)
- [ ] Position between turn slider and lanes
- [ ] 5 sections displayed horizontally:
  1. **Resources**: 4 resource types with stocks + output/turn
  2. **Population**: Workers/Soldiers/Scientists with icons
  3. **Space**: Ground/Orbital usage bars
  4. **Housing**: Capacity indicators
  5. **Growth**: Next turn projection
- [ ] Each section visually separated (borders or background)
- [ ] Responsive: Stack to 2 rows on medium screens, vertical on mobile
- [ ] Remove old vertical `PlanetSummary` from sidebar
- [ ] Performance: Use `useMemo` to prevent unnecessary re-renders

### Layout Structure
```tsx
<div className="w-full max-w-[1800px] mx-auto px-6">
  <div className="grid grid-cols-5 gap-4 bg-pink-nebula-panel rounded-lg p-4">
    {/* Resources Section - Largest */}
    <div className="col-span-2">
      <h3>Resources</h3>
      <div className="grid grid-cols-2 gap-2">
        {resources.map(r => (
          <div key={r.id}>
            <span>{r.icon}</span>
            <span>{Math.floor(stocks[r.id])}</span>
            <span className="text-xs">{formatOutput(outputs[r.id])}/turn</span>
          </div>
        ))}
      </div>
    </div>

    {/* Population Section */}
    <div>
      <h3>Population</h3>
      <div className="space-y-1 text-sm">
        <div>👷 {workers} workers ({idle} idle)</div>
        <div>⚔️ {soldiers} soldiers</div>
        <div>🔬 {scientists} scientists</div>
      </div>
    </div>

    {/* Space Section */}
    <div>
      <h3>Space Usage</h3>
      <ProgressBar label="Ground" current={groundUsed} max={groundCap} />
      <ProgressBar label="Orbital" current={orbitalUsed} max={orbitalCap} />
    </div>

    {/* Housing Section */}
    <div>
      <h3>Housing</h3>
      <div className="text-xs space-y-1">
        <div>Workers: {workers}/{workerCap}</div>
        <div>Military: {soldiers}/{soldierCap}</div>
        <div>Science: {scientists}/{scientistCap}</div>
      </div>
    </div>
  </div>
</div>
```

### Responsive Breakpoints
```css
/* Desktop: 5 columns */
@media (min-width: 1280px) { grid-cols-5 }

/* Tablet: 3 columns, 2 rows */
@media (min-width: 768px) { grid-cols-3 }

/* Mobile: Single column */
@media (max-width: 767px) { grid-cols-1 }
```

### Migration Path
1. Create new `PlanetDashboard.tsx` with horizontal layout
2. Add to page.tsx between slider and lanes
3. Test side-by-side with old summary
4. Remove old `PlanetSummary` from right sidebar
5. Delete or archive old component

### Performance Considerations
- [ ] Memoize calculations with `useMemo`
- [ ] Use `React.memo` for component if re-rendering is excessive
- [ ] Minimize state subscriptions

---

## Ticket 23: Create Compact Queue Display Components
**Priority**: High (Core UX)
**Estimated Effort**: 4 hours
**Files to Modify**: `src/components/LaneBoard/LaneBoard.tsx`
**New Files**:
- `src/components/QueueDisplay/CompactLane.tsx`
- `src/components/QueueDisplay/CompactLaneEntry.tsx`

### Problem
Current lanes mix queue display with item selection, creating visual clutter. Lanes show unnecessary details (costs, duration) that belong in selection phase, not queue management.

### Design Goals
- **Information Hierarchy**: Show only what's needed for queue management
- **Scannability**: User can assess all 3 queues at a glance
- **Actionability**: Clear cancel action, visual status indicators

### Acceptance Criteria
- [ ] Fixed lane width: 280px (narrow, consistent columns)
- [ ] Entry format: `T{start}-T{end} [×{qty}] {name} {status}`
  - Structures: `T1-T5 Metal Mine ⏳4`
  - Ships: `T2-T6 ×5 Fighter ⏳5`
  - Colonists: `T3-T3 ×10 Soldier ⏳0`
- [ ] Batch indicator (`×N`) only for qty > 1
- [ ] Status indicators:
  - ⏳N = Active (N turns remaining)
  - ⏸ = Pending (waiting to activate)
  - ✓ = Completing this turn
- [ ] Visual states:
  - Pending: Blue border/background
  - Active: Green border + progress bar
  - Completing: Gold/yellow pulse animation
- [ ] Cancel button: Red × on hover (right-aligned)
- [ ] Empty state: Subtle "Queue empty" message
- [ ] Max height with scroll for long queues (>5 items)

### Component Structure
```tsx
// CompactLane.tsx
interface CompactLaneProps {
  laneId: 'building' | 'ship' | 'colonist';
  entries: QueueEntry[];
  currentTurn: number;
  onCancel: (index: number) => void;
  disabled?: boolean; // When viewing past turns
}

// CompactLaneEntry.tsx
interface CompactLaneEntryProps {
  entry: QueueEntry;
  currentTurn: number;
  onCancel: () => void;
  disabled?: boolean;
}

// Display logic
const formatEntry = (entry: QueueEntry): string => {
  const start = `T${entry.queuedTurn}`;
  const end = `T${entry.queuedTurn + entry.duration}`;
  const qty = entry.quantity > 1 ? `×${entry.quantity} ` : '';
  const status = entry.status === 'active'
    ? `⏳${entry.turnsRemaining}`
    : entry.status === 'pending'
      ? '⏸'
      : '✓';

  return `${start}-${end} ${qty}${entry.itemName} ${status}`;
};
```

### Visual Design
```
┌─ Structures ─────────────┐
│ T1-T5 Metal Mine ⏳4    ✕│
│ T6-T10 Solar Gen ⏸      ✕│
│                          │
│ [━━━━━     ] 40%        │ ← Progress bar for active
└──────────────────────────┘

┌─ Ships ──────────────────┐
│ T2-T6 ×5 Fighter ⏳5    ✕│
│                          │
│ [━━━━━━    ] 60%        │
└──────────────────────────┘

┌─ Colonists ──────────────┐
│ Queue empty              │
│                          │
│                          │
└──────────────────────────┘
```

### Styling Guidelines
```css
.compact-lane {
  width: 280px;
  max-height: 300px;
  overflow-y: auto;
  border: 2px solid theme('colors.pink-nebula-border');
}

.lane-entry-pending {
  background: rgba(59, 130, 246, 0.1); /* blue tint */
  border-left: 3px solid #3B82F6;
}

.lane-entry-active {
  background: rgba(34, 197, 94, 0.1); /* green tint */
  border-left: 3px solid #22C55E;
}

.lane-entry-completing {
  animation: pulse-gold 1s infinite;
}
```

### Accessibility
- [ ] Keyboard navigation for cancel buttons
- [ ] ARIA labels: "Cancel Metal Mine production"
- [ ] Screen reader announcements for status changes
- [ ] High contrast mode support

### Performance
- [ ] Virtualize list if >10 items (react-window)
- [ ] Memoize entry formatting
- [ ] Debounce progress bar updates

---

## Ticket 24: Implement Four-Column Production Layout
**Priority**: High (Core Layout)
**Estimated Effort**: 2 hours
**Files**: `src/app/page.tsx`

### Problem
Current layout has colonist lane below ships, wasting vertical space and breaking the conceptual model of "3 parallel production lanes." Need unified horizontal layout for all production queues.

### Layout Requirements
- **Column 1-3**: Queue lanes (280px each)
- **Column 4**: Item selection panel (400px)
- **Total width**: 1240px min, 1800px max
- **Height**: Fill available space below dashboard

### Acceptance Criteria
- [ ] Four-column grid layout:
  ```
  | Structures | Ships | Colonists | Selection |
  |   280px    | 280px |   280px   |   400px   |
  ```
- [ ] All columns same height (aligned tops and bottoms)
- [ ] Responsive behavior:
  - Desktop (>1240px): 4 columns
  - Tablet (768-1240px): 2×2 grid
  - Mobile (<768px): Single column stack
- [ ] No horizontal scrolling on desktop
- [ ] Vertical scroll per lane if needed
- [ ] Gap between columns: 16px
- [ ] Consistent borders and backgrounds

### Implementation
```tsx
// page.tsx main layout
<main className="flex-1 overflow-hidden">
  <div className="max-w-[1800px] mx-auto px-6">
    {/* Planet Dashboard (from Ticket 22) */}
    <PlanetDashboard summary={summary} />

    {/* Production Layout */}
    <div className="grid grid-cols-[280px_280px_280px_1fr] gap-4 mt-4 h-[calc(100vh-300px)]">
      {/* Lane 1: Structures */}
      <CompactLane
        laneId="building"
        entries={buildingLane.entries}
        currentTurn={viewTurn}
        onCancel={() => handleCancelItem('building')}
        disabled={viewTurn < totalTurns - 1}
      />

      {/* Lane 2: Ships */}
      <CompactLane
        laneId="ship"
        entries={shipLane.entries}
        currentTurn={viewTurn}
        onCancel={() => handleCancelItem('ship')}
        disabled={viewTurn < totalTurns - 1}
      />

      {/* Lane 3: Colonists */}
      <CompactLane
        laneId="colonist"
        entries={colonistLane.entries}
        currentTurn={viewTurn}
        onCancel={() => handleCancelItem('colonist')}
        disabled={viewTurn < totalTurns - 1}
      />

      {/* Column 4: Selection Panel */}
      <ItemSelectionPanel
        availableItems={availableItems}
        onQueueItem={handleQueueItem}
        canQueueItem={canQueueItem}
        currentTurn={viewTurn}
      />
    </div>
  </div>
</main>
```

### Responsive Grid
```tsx
// Tailwind classes for responsive
className={`
  grid gap-4 mt-4 h-[calc(100vh-300px)]
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-[280px_280px_280px_1fr]
`}
```

### Container Constraints
```css
.production-container {
  min-width: 1240px; /* 280×3 + 400 + gaps */
  max-width: 1800px;
  margin: 0 auto;
}

/* Prevent horizontal scroll */
@media (max-width: 1239px) {
  .production-container {
    min-width: 100%;
  }
}
```

### Edge Cases
- [ ] Test with empty lanes
- [ ] Test with full lanes (10+ items each)
- [ ] Verify alignment with varying content heights
- [ ] Check tab/keyboard navigation between columns

---

## Ticket 25: Build Tabbed Item Selection Panel
**Priority**: High (Core Feature)
**Estimated Effort**: 5 hours
**New Files**:
- `src/components/ItemSelection/ItemSelectionPanel.tsx`
- `src/components/ItemSelection/ItemCard.tsx`
- `src/components/ItemSelection/TabHeader.tsx`

### Problem
Current dropdown selection is clunky and hides available options. Users need to see all buildable items at once, with clear indication of what's available vs locked.

### Design Requirements
- **Discoverability**: All items visible when tab is open
- **Information Architecture**: Group by type (Structure/Ship/Colonist)
- **Progressive Disclosure**: Show costs/details on hover or focus
- **Visual Hierarchy**: Available items prominent, locked items subdued

### Acceptance Criteria
- [ ] Fixed width panel: 400px
- [ ] 3 tabs with icons:
  - 🏗️ Structures
  - 🚀 Ships
  - 👥 Colonists
- [ ] Tab behavior:
  - Only one open at a time (accordion)
  - Remember last open tab in session
  - Visual indicator for active tab
- [ ] Item states:
  - ✅ Available (meets all requirements)
  - ⚠️ Insufficient resources (has prereqs, lacks resources)
  - 🔒 Locked (missing prerequisites)
- [ ] Item display:
  - Grid layout: 2 columns for structures/ships, 1 for colonists
  - Card per item with icon, name, quick stats
  - Hover: Show detailed tooltip with full costs
  - Click: Queue item (if available)
- [ ] Smart filtering:
  - Available items at top
  - Sort by tier within availability
  - Search/filter box (optional enhancement)

### Component Architecture
```tsx
// ItemSelectionPanel.tsx
interface ItemSelectionPanelProps {
  availableItems: Record<string, ItemDefinition>;
  gameState: GameState;
  onQueueItem: (itemId: string, quantity: number) => void;
  canQueueItem: (itemId: string, quantity: number) => ValidationResult;
}

// State management
const [activeTab, setActiveTab] = useState<'structure' | 'ship' | 'colonist'>('structure');
const [hoveredItem, setHoveredItem] = useState<string | null>(null);

// Item categorization
const categorizeItems = (items: Record<string, ItemDef>, state: GameState) => {
  const categorized = {
    available: [],
    insufficientResources: [],
    locked: []
  };

  Object.entries(items).forEach(([id, def]) => {
    if (!hasPrereqs(state, def)) {
      categorized.locked.push({ id, def });
    } else if (!canAfford(state, def)) {
      categorized.insufficientResources.push({ id, def });
    } else {
      categorized.available.push({ id, def });
    }
  });

  return categorized;
};
```

### Item Card Design
```tsx
// ItemCard.tsx
<div
  className={`
    relative p-3 rounded-lg border-2 cursor-pointer transition-all
    ${available ? 'border-green-500 hover:bg-green-500/10' : ''}
    ${insufficient ? 'border-yellow-500 opacity-75' : ''}
    ${locked ? 'border-gray-500 opacity-50 cursor-not-allowed' : ''}
  `}
  onClick={() => available && onQueueItem(item.id, 1)}
  onMouseEnter={() => setShowTooltip(true)}
  onMouseLeave={() => setShowTooltip(false)}
>
  {/* Status indicator */}
  <div className="absolute top-1 right-1">
    {available && '✅'}
    {insufficient && '⚠️'}
    {locked && '🔒'}
  </div>

  {/* Main content */}
  <div className="flex items-center gap-2">
    <img src={item.icon} className="w-8 h-8" />
    <div>
      <div className="font-semibold text-sm">{item.name}</div>
      <div className="text-xs text-gray-400">
        T{item.tier} • {item.duration} turns
      </div>
    </div>
  </div>

  {/* Tooltip on hover */}
  {showTooltip && (
    <ItemTooltip item={item} state={gameState} />
  )}
</div>
```

### Tooltip Content
```tsx
<div className="absolute z-10 bg-gray-900 p-3 rounded shadow-lg w-64">
  <h4 className="font-bold">{item.name}</h4>

  {/* Costs */}
  <div className="text-xs mt-2">
    <div>Duration: {item.duration} turns</div>
    {item.costs.metal > 0 && (
      <div className={sufficientMetal ? '' : 'text-red-400'}>
        Metal: {item.costs.metal} (Have: {state.stocks.metal})
      </div>
    )}
    {/* Similar for other resources */}
  </div>

  {/* Prerequisites */}
  {item.prerequisites && (
    <div className="text-xs mt-2 border-t pt-2">
      Requires: {item.prerequisites.map(p => defs[p].name).join(', ')}
    </div>
  )}

  {/* Effects */}
  {item.effects && (
    <div className="text-xs mt-2 border-t pt-2">
      Produces: +{item.effects.production} {item.effects.resource}/turn
    </div>
  )}
</div>
```

### Tab Header Design
```tsx
<div className="flex border-b border-gray-600">
  {['structure', 'ship', 'colonist'].map(type => (
    <button
      key={type}
      onClick={() => setActiveTab(type)}
      className={`
        flex-1 py-2 px-3 transition-all
        ${activeTab === type
          ? 'bg-gray-700 border-b-2 border-blue-500'
          : 'hover:bg-gray-800'}
      `}
    >
      {type === 'structure' && '🏗️ Structures'}
      {type === 'ship' && '🚀 Ships'}
      {type === 'colonist' && '👥 Colonists'}
    </button>
  ))}
</div>
```

### Accessibility
- [ ] Keyboard navigation between tabs (Arrow keys)
- [ ] Tab panel has `role="tabpanel"`
- [ ] Items focusable and activatable with Enter/Space
- [ ] Screen reader announcements for item states
- [ ] Tooltips readable by screen readers

---

## Ticket 26: Implement Direct-Click Queueing with Feedback
**Priority**: High (Core UX)
**Estimated Effort**: 3 hours
**Files**: `src/components/ItemSelection/ItemCard.tsx`
**New Files**: `src/components/UI/QueueFeedback.tsx`, `src/hooks/useQueueFeedback.ts`

### Problem
Multi-step selection (dropdown → select → click button) creates friction. Users expect immediate action from clicking an item they want to build.

### Design Goals
- **Immediate Feedback**: User knows their action was registered
- **Error Clarity**: Clear explanation when queue fails
- **Quantity Control**: Easy batch queueing for appropriate items
- **Undo Capability**: Quick recovery from misclicks

### Acceptance Criteria
- [ ] Single click on available item immediately queues it
- [ ] Visual feedback sequence:
  1. Click animation (scale/pulse)
  2. Success: Green flash + checkmark
  3. Failure: Red shake + error message
- [ ] Default quantities:
  - Structures: Always 1
  - Ships: Quick selector (1, 5, 10, Max)
  - Colonists: Quick selector (1, 10, 50, Max)
- [ ] Error handling:
  - Toast notification with specific reason
  - Item card highlights problematic resource
  - 3-second auto-dismiss
- [ ] Keyboard support:
  - Enter/Space on focused item queues it
  - Shift+Click queues max affordable
  - Number keys (1-9) set quantity for ships/colonists

### Implementation
```tsx
// useQueueFeedback.ts
interface QueueFeedback {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
  itemId?: string;
}

const useQueueFeedback = () => {
  const [feedback, setFeedback] = useState<QueueFeedback>({ status: 'idle' });

  const queueWithFeedback = async (itemId: string, quantity: number) => {
    setFeedback({ status: 'processing', itemId });

    try {
      const result = await onQueueItem(itemId, quantity);

      if (result.success) {
        setFeedback({
          status: 'success',
          message: `Queued ${quantity}× ${itemName}`,
          itemId
        });
        // Auto-clear after animation
        setTimeout(() => setFeedback({ status: 'idle' }), 1000);
      } else {
        setFeedback({
          status: 'error',
          message: getErrorMessage(result.reason),
          itemId
        });
        setTimeout(() => setFeedback({ status: 'idle' }), 3000);
      }
    } catch (error) {
      setFeedback({
        status: 'error',
        message: 'Unexpected error',
        itemId
      });
    }
  };

  return { feedback, queueWithFeedback };
};
```

### Quantity Selector for Ships/Colonists
```tsx
// QuantitySelector.tsx
const QuantitySelector = ({ itemId, maxAffordable, onQueue }) => {
  const [showSelector, setShowSelector] = useState(false);

  const quickAmounts = [
    { label: '1', value: 1 },
    { label: '5', value: Math.min(5, maxAffordable) },
    { label: '10', value: Math.min(10, maxAffordable) },
    { label: `Max (${maxAffordable})`, value: maxAffordable }
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setShowSelector(!showSelector)}
        className="text-xs text-blue-400 hover:underline"
      >
        Qty ▼
      </button>

      {showSelector && (
        <div className="absolute top-full mt-1 bg-gray-800 rounded shadow-lg p-2 z-10">
          {quickAmounts.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => {
                onQueue(itemId, value);
                setShowSelector(false);
              }}
              disabled={value === 0}
              className="block w-full text-left px-2 py-1 hover:bg-gray-700 disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Error Messages
```typescript
const ERROR_MESSAGES = {
  'REQ_MISSING': 'Missing required structures. Check prerequisites.',
  'HOUSING_MISSING': 'Insufficient housing capacity.',
  'ENERGY_INSUFFICIENT': 'Would cause negative energy. Build more generators.',
  'INVALID_LANE': 'Lane is busy. Wait for current item to complete.',
  'RESOURCES': 'Insufficient resources.',
} as const;

const getErrorMessage = (reason: string): string => {
  return ERROR_MESSAGES[reason] || 'Cannot queue item';
};
```

### Animation Classes
```css
/* Success animation */
@keyframes queue-success {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(34, 197, 94, 0.5); }
  100% { transform: scale(1); }
}

.queue-success {
  animation: queue-success 0.5s ease-out;
}

/* Error animation */
@keyframes queue-error {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.queue-error {
  animation: queue-error 0.3s ease-out;
  border-color: #ef4444 !important;
}
```

### Accessibility
- [ ] Announce queue success/failure to screen readers
- [ ] Keyboard shortcuts documented in help text
- [ ] Focus management after queue action
- [ ] High contrast mode for feedback animations

---

## Ticket 27: Add Intuitive Cancel Controls to Queue Entries
**Priority**: Medium (UX Polish)
**Estimated Effort**: 2 hours
**Files**: `src/components/QueueDisplay/CompactLaneEntry.tsx`

### Problem
Users need clear, discoverable way to cancel queued items. Current system lacks visual affordance for cancellation.

### Design Requirements
- **Discoverability**: Cancel option visible on hover
- **Safety**: Prevent accidental cancellations
- **Feedback**: Clear confirmation of cancellation
- **Context**: Different behavior for pending vs active items

### Acceptance Criteria
- [ ] Cancel button appearance:
  - Hidden by default
  - Appears on hover over entry
  - Always visible on touch devices
  - Red X icon, 20×20px click target minimum
- [ ] Confirmation for active items:
  - Pending: Cancel immediately
  - Active: Show "Cancel? Resources will be refunded" tooltip
  - Click again to confirm (within 3 seconds)
- [ ] Visual states:
  - Hover: Red background on X
  - Active cancel: Pulsing red border on entry
  - Cancelling: Fade out animation
- [ ] Disabled states:
  - When viewing past turns
  - When lane is processing
- [ ] Refund indication:
  - Show "+X metal" float-up animation for refunds
  - Green text for resources returned

### Implementation
```tsx
// CompactLaneEntry.tsx enhancement
const [showCancel, setShowCancel] = useState(false);
const [confirmingCancel, setConfirmingCancel] = useState(false);

const handleCancelClick = () => {
  if (entry.status === 'pending') {
    // Immediate cancel for pending
    onCancel();
  } else if (entry.status === 'active') {
    if (confirmingCancel) {
      // Second click confirms
      onCancel();
    } else {
      // First click starts confirmation
      setConfirmingCancel(true);
      setTimeout(() => setConfirmingCancel(false), 3000);
    }
  }
};

return (
  <div
    className="relative group"
    onMouseEnter={() => setShowCancel(true)}
    onMouseLeave={() => {
      setShowCancel(false);
      setConfirmingCancel(false);
    }}
  >
    {/* Entry content */}
    <div className="flex items-center justify-between p-2">
      <span>{formatEntry(entry)}</span>

      {/* Cancel button */}
      {(showCancel || confirmingCancel) && !disabled && (
        <button
          onClick={handleCancelClick}
          className={`
            w-6 h-6 rounded flex items-center justify-center
            transition-all duration-200
            ${confirmingCancel
              ? 'bg-red-600 animate-pulse'
              : 'bg-red-600/20 hover:bg-red-600'}
          `}
          aria-label={`Cancel ${entry.itemName}`}
        >
          {confirmingCancel ? '!' : '✕'}
        </button>
      )}
    </div>

    {/* Confirmation tooltip */}
    {confirmingCancel && (
      <div className="absolute top-full mt-1 right-0 bg-gray-900 text-xs p-2 rounded shadow-lg z-10">
        Cancel? Resources will be refunded.
      </div>
    )}
  </div>
);
```

### Refund Animation
```tsx
// RefundAnimation.tsx
const RefundAnimation = ({ resources, onComplete }) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Object.entries(resources).map(([type, amount]) => (
        amount > 0 && (
          <div
            key={type}
            className="absolute top-1/2 left-1/2 text-green-400 font-bold animate-float-up"
            onAnimationEnd={onComplete}
          >
            +{amount} {type}
          </div>
        )
      ))}
    </div>
  );
};

/* Animation */
@keyframes float-up {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -150%);
  }
}

.animate-float-up {
  animation: float-up 1s ease-out forwards;
}
```

### Edge Cases
- [ ] Rapid clicking doesn't queue multiple cancellations
- [ ] Changing turns cancels confirmation state
- [ ] Touch devices show cancel button without hover
- [ ] Keyboard users can access cancel via Tab + Enter

---

## Ticket 28: Drag-and-Drop Queue System (Optional Enhancement)
**Priority**: Low (Enhancement)
**Estimated Effort**: 6 hours

### Problem
Drag-and-drop would be more intuitive than clicking for some users.

### Acceptance Criteria
- [ ] Drag item from selection panel
- [ ] Drop into appropriate lane
- [ ] Visual feedback during drag (ghost item)
- [ ] Prevents dropping into wrong lane (e.g., ship into structure lane)
- [ ] Falls back to click if drag not supported

### Implementation Notes
- Use HTML5 drag-and-drop API or `react-dnd` library
- Add `draggable` to items in selection panel
- Add drop zones to lanes
- Validate drop target matches item type

---

## Implementation Order

### Phase 5a: Critical Fixes and Layout (Tickets 20-22)
1. **Ticket 20**: Fix food decimal bug
2. **Ticket 21**: Remove header resources
3. **Ticket 22**: Horizontal planet summary

### Phase 5b: Lane Redesign (Tickets 23-24)
4. **Ticket 23**: Compact lane display
5. **Ticket 24**: Side-by-side layout

### Phase 5c: Selection UI (Tickets 25-27)
6. **Ticket 25**: Item selection panel
7. **Ticket 26**: Single-click queueing
8. **Ticket 27**: Cancel with "X" button

### Phase 5d: Enhancement (Ticket 28)
9. **Ticket 28**: Drag-and-drop (optional)

---

## Design Mockup (Text)

```
┌──────────────────────────────────────────────────────────────┐
│ Header: "Infinite Conflict Simulator" [Advance Turn]         │
├──────────────────────────────────────────────────────────────┤
│ Turn Slider: [◀] Turn 5 / 20 [▶]                            │
├──────────────────────────────────────────────────────────────┤
│ Planet Summary (Horizontal):                                 │
│ [Resources] [Space] [Population] [Housing] [Growth]          │
├─────────────────┬─────────────────┬─────────────────┬────────┤
│  STRUCTURES     │     SHIPS       │   COLONISTS     │ SELECT │
│                 │                 │                 │        │
│ T1-T5 Metal Mine│ T2-T6 x5 Fighter│ [Empty]         │┌──────┐│
│       4 turns[X]│       5 turns[X]│                 ││STRUCT││
│                 │                 │                 │├──────┤│
│ T6-T10 Solar Gen│                 │                 ││SHIPS ││
│       0 [pend][X]│                 │                 │├──────┤│
│                 │                 │                 ││COLON ││
│                 │                 │                 │└──────┘│
│                 │                 │                 │        │
│                 │                 │                 │Items:  │
│                 │                 │                 │☑ Outpost│
│                 │                 │                 │☑ Mine  │
│                 │                 │                 │☐ Yard  │
└─────────────────┴─────────────────┴─────────────────┴────────┘
```
