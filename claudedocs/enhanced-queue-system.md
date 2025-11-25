# Enhanced Queue System with Auto-Wait

## Overview

Implemented a comprehensive queueing enhancement that allows users to queue items that aren't immediately buildable. The system automatically calculates wait times needed and presents a confirmation modal with detailed information.

## Feature Summary

### Key Capabilities

1. **Queue Items Not Currently Buildable** - Items requiring prerequisites or housing can now be queued
2. **Auto-Wait Calculation** - Automatically determines how many wait turns are needed
3. **Visual Color Coding** - Four-state system with clear visual indicators
4. **Confirmation Modal** - Detailed modal showing wait reasons and allowing user decision
5. **Batch Defaulting** - Items activate with maximum affordable quantity at activation time
6. **Future Housing Validation** - Checks if housing will be available from queued buildings

### Visual States

**Item Card Colors:**
- ✅ **Green Border** - Available now (can queue immediately)
- ⏸️ **Blue Border** - Queueable with wait (auto-wait will be added for prerequisites, housing, or resource accumulation)
- 🔒 **Gray Border** - Locked (prerequisites not in queue, or impossible conditions like negative production)

## Implementation Details

### 1. Enhanced Validation System

**File**: `src/lib/sim/engine/queueValidation.ts`

```typescript
interface QueueValidationResult {
  canQueueNow: boolean;        // Can queue without waiting
  canQueueEventually: boolean; // Can queue with auto-wait
  waitTurnsNeeded: number;     // Wait turns required
  reason?: string;             // Human-readable reason
  blockers: QueueBlocker[];    // Detailed blocker info
}

interface QueueBlocker {
  type: 'PREREQUISITE' | 'HOUSING' | 'RESOURCES' | 'ENERGY' | 'PLANET_LIMIT';
  prereqId?: string;
  turnsUntilReady?: number;
  message: string;
}
```

**Key Functions:**
- `validateQueueWithWait()` - Main validation with wait calculation
- `calculatePrereqCompletionTurn()` - Determines when prerequisites complete
- `calculateHousingWaitTurns()` - Checks future housing availability
- `calculateResourceWaitTurns()` - Calculates when resources will accumulate to required amounts
- `calculateAutoWaitTurns()` - Returns wait turns needed

### 2. Auto-Wait Calculation

**Prerequisite Waiting:**
- Scans all lanes (building, ship, colonist, research) for prerequisites
- Calculates completion turn based on queue position and duration
- Accounts for active items and pending items
- Handles wait items in queue correctly

**Housing Waiting:**
- Checks current housing capacity
- Projects future capacity from queued/active buildings
- Calculates when housing will be sufficient
- Returns -1 if impossible without more buildings

**Resource Accumulation:**
- Computes net resource production per turn using `computeNetOutputsPerTurn()`
- For each insufficient resource, calculates: `turnsNeeded = ceil((required - current) / netPerTurn)`
- Returns maximum of all resource wait times
- Returns -1 if any resource has zero or negative net production (impossible to accumulate)

**Wait Turn Calculation:**
```typescript
// Example: Building requires research
// Research completes at T15, current turn is T5
// waitTurnsNeeded = 15 - 5 = 10 turns

// Example: Resource accumulation
// Need 500 metal, have 200, producing 50 per turn
// waitTurnsNeeded = ceil((500 - 200) / 50) = 6 turns

// Example: Multiple blockers
// Prerequisite ready at T10, housing ready at T15, resources at T8
// waitTurnsNeeded = max(10, 15, 8) = 15 turns
```

### 3. Confirmation Modal

**File**: `src/components/QueueConfirmationModal.tsx`

**Features:**
- Shows item name and quantity
- Displays wait turns prominently
- Lists all blockers with icons and messages
- Shows when each blocker will be ready (T+N format)
- Provides Accept/Cancel actions
- Explains what auto-wait means

**Blocker Icons:**
- 🔒 Prerequisites
- 🏠 Housing
- 📦 Resources
- ⚡ Energy

### 4. UI Integration

**ItemCard Enhancement** (`src/components/ItemSelection/ItemCard.tsx`):
- Added `queueableWithWait` prop
- Added `waitTurnsNeeded` prop
- Blue border styling for queueable-with-wait state
- Wait badge showing "+NT" in bottom-right corner
- Updated tooltip with wait information

**ItemSelectionPanel Updates** (`src/components/ItemSelection/ItemSelectionPanel.tsx`):
- Uses `validateQueueWithWait()` for categorization
- Three-category system: available, queueableWithWait, locked
- Modal state management
- `handleQueueItem()` checks if modal needed
- `handleModalConfirm()` queues wait then item
- Footer hint updated: "Blue items require wait"

### 5. Batch Size Defaulting

**Already Handled**: The existing `clampBatchAtActivation()` function automatically defaults batch sizes to maximum affordable when items activate.

**How It Works:**
- User queues 500 fighters with 5-turn wait
- Wait completes at T6
- Activation checks resources/workers/space
- Only 400 fighters affordable → batch defaults to 400
- Item activates with 400 quantity

**Location**: `src/lib/sim/engine/validation.ts:190-231`

## User Workflows

### Workflow 1: Building Requires Research

1. User clicks on "Advanced Factory" (requires "Industrial Research")
2. Research not complete but queued (completes T20, current T5)
3. Modal appears: "Auto-Wait Required: 15 turns"
4. Shows blocker: "🔒 Waiting for Industrial Research (15 turns)"
5. User clicks "Queue with Wait"
6. System queues: Wait(15 turns) → Advanced Factory

### Workflow 2: Colonist Needs Housing

1. User clicks on "Scientist" (requires housing capacity)
2. Housing insufficient but barracks queued (ready T12, current T7)
3. Modal appears: "Auto-Wait Required: 5 turns"
4. Shows blocker: "🏠 Waiting for housing capacity (5 turns)"
5. User confirms
6. System queues: Wait(5 turns) → Scientist

### Workflow 3: Multiple Blockers

1. User clicks on "Elite Soldiers" (requires barracks + housing)
2. Barracks completes T10, housing ready T15 (current T5)
3. Modal appears: "Auto-Wait Required: 15 turns" (uses max)
4. Shows blockers:
   - "🔒 Waiting for Army Barracks (5 turns)"
   - "🏠 Waiting for housing capacity (10 turns)"
5. User confirms
6. System queues: Wait(15 turns) → Elite Soldiers

## Technical Architecture

### Validation Flow

```
User clicks item
     ↓
validateQueueWithWait()
     ↓
Check Prerequisites → calculatePrereqCompletionTurn()
     ↓
Check Housing → calculateHousingWaitTurns()
     ↓
Check Energy → energyNonNegativeAfterCompletion()
     ↓
Calculate max wait needed
     ↓
Return QueueValidationResult
```

### Queue Flow

```
User confirms in modal
     ↓
handleModalConfirm()
     ↓
onQueueWait(laneId, waitTurns) → Queue wait item
     ↓
onQueueItem(itemId, quantity) → Queue actual item
     ↓
Items appear in queue: [Wait (N turns)] → [Item]
```

### Activation Flow

```
Turn advances
     ↓
tryActivateNext() processes wait item
     ↓
Wait progresses N turns
     ↓
Wait completes
     ↓
tryActivateNext() processes actual item
     ↓
clampBatchAtActivation() defaults quantity
     ↓
Item activates with max affordable quantity
```

## Edge Cases Handled

### 1. Prerequisites Not in Queue
**Situation**: Item requires research not queued at all
**Handling**: `canQueueEventually = false`, locked (gray), not clickable

### 2. Housing Never Available
**Situation**: No housing buildings queued and insufficient capacity
**Handling**: `canQueueEventually = false`, hard blocker message

### 3. Multiple Prerequisites
**Situation**: Item requires 3 buildings, each at different completion turns
**Handling**: Uses maximum wait time to ensure all prerequisites complete

### 4. Wait Items in Queue
**Situation**: Prerequisite behind wait items in queue
**Handling**: Correctly includes wait durations in calculation

### 5. Planet Limit Reached
**Situation**: Building limited to 1 per planet, already exists
**Handling**: Hard blocker, not queueable

### 6. Negative Resource Production
**Situation**: Item requires resources but production is zero or negative for that resource
**Handling**: Hard blocker (`canQueueEventually = false`), locked (gray), cannot accumulate

### 7. Energy Negative After Completion
**Situation**: Building would cause negative energy
**Handling**: Soft blocker (shows warning), user can still queue

## Files Modified/Created

### Modified (5 files)
1. `src/components/ItemSelection/ItemCard.tsx` - Added queueableWithWait state and wait badge
2. `src/components/ItemSelection/ItemSelectionPanel.tsx` - Integrated modal and enhanced validation
3. `src/lib/sim/engine/validation.ts` - Base validation functions (unchanged, used by new system)
4. `src/lib/sim/engine/lanes.ts` - Activation logic (unchanged, already handles batch defaulting)
5. `src/lib/sim/engine/types.ts` - Types for WorkItem (unchanged, already has isWait)

### Created (2 files)
1. `src/lib/sim/engine/queueValidation.ts` - Enhanced validation system with auto-wait
2. `src/components/QueueConfirmationModal.tsx` - Auto-wait confirmation modal

## Configuration

### Customization Points

**Wait Calculation Logic** (`queueValidation.ts`):
```typescript
// Adjust prerequisite scan
const allLanes: LaneId[] = ['building', 'ship', 'colonist', 'research'];

// Modify housing projection depth
// Currently checks all queued buildings

// Change blocker priority
// Currently uses max() of all wait times
```

**Modal Appearance** (`QueueConfirmationModal.tsx`):
```typescript
// Customize colors, icons, messages
// Add/remove blocker types
// Change confirmation button text
```

**Item Card Colors** (`ItemCard.tsx`):
```typescript
// Green: Available
border-green-500

// Blue: Queueable with wait
border-blue-500

// Yellow: Insufficient resources
border-yellow-500

// Gray: Locked
border-gray-500
```

## Future Enhancements

### Potential Improvements

1. **Multiple Item Queue** - Queue multiple items with single auto-wait
2. **Wait Optimization** - Suggest optimal wait times based on multiple items
3. **Smart Queue Reordering** - Automatically reorder to minimize total wait
4. **Wait Templates** - Save common wait patterns for reuse
5. **Research Lane Support** - Add auto-wait for global research queue
6. **Visual Timeline** - Show when items will activate on timeline
7. **Wait Cancellation** - Smart wait adjustment when prerequisites change
8. **Dynamic Recalculation** - Recalculate wait times when queue changes during wait period

### Known Limitations

1. **Research Lane** - Auto-wait not yet supported for research items (different queue system)
2. **Dynamic Production Changes** - Doesn't account for production rate changes that happen during wait (assumes constant production)
3. **Multiple Paths** - Assumes first found prerequisite path, not optimal
4. **Future Queue Changes** - If user cancels queued items during wait, validation doesn't automatically recalculate

## Testing

### Manual Test Scenarios

**Test 1: Basic Prerequisite Wait**
- Queue research
- Try to queue building requiring that research
- Verify modal shows, correct wait turns calculated
- Confirm and verify both items queued

**Test 2: Housing Wait**
- Fill housing capacity
- Try to queue colonist
- Verify modal shows housing blocker
- Queue housing building first
- Retry colonist - should now show wait for housing

**Test 3: Multiple Blockers**
- Create situation with multiple blockers
- Verify modal shows all blockers
- Verify wait time is maximum of all blockers

**Test 4: Impossible Queue**
- Try to queue item with prerequisite not in queue
- Verify item is gray (locked)
- Verify not clickable

**Test 5: Batch Defaulting**
- Queue high quantity with wait
- Verify activates with max affordable after wait

### Automated Tests Needed

- Unit tests for `validateQueueWithWait()`
- Unit tests for `calculatePrereqCompletionTurn()`
- Unit tests for `calculateHousingWaitTurns()`
- Integration tests for modal workflow
- UI tests for color coding

## Performance Considerations

### Optimization Points

**Validation Caching**:
- `validateQueueWithWait()` called for every item during categorization
- Consider memoization with state hash
- ~O(n*m) where n=items, m=queue depth

**Prerequisite Scanning**:
- Scans all lanes for each prerequisite
- Could maintain prerequisite index
- Current performance acceptable for typical queue sizes

**Re-categorization**:
- Happens on every state change
- Uses React useMemo to minimize
- Only re-runs when dependencies change

## Documentation

See also:
- `wait-feature-implementation.md` - Base wait item functionality
- `ARCHITECTURE.md` - Overall system architecture
- `CLAUDE.md` - Development guidelines

## Summary

This enhancement transforms the queue system from "queue only what's ready now" to "queue anything that will eventually be ready". The auto-wait calculation and confirmation modal provide transparency and control, while the visual color coding makes the system intuitive and easy to understand.

Key benefits:
- ✅ Strategic planning - Queue entire build orders upfront
- ✅ Reduced micromanagement - Set it and forget it
- ✅ Clear feedback - Always know why and when items will build
- ✅ Flexible control - Accept or cancel auto-waits as needed
- ✅ Smart defaulting - Batch sizes optimize at activation time
