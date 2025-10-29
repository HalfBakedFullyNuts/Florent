# Structure Cancellation Bug Analysis

## Problem
Cancelling structures from Planet Queue shows "Invalid Turn" error, while ships/colonists work correctly.

## Root Cause

### The Bug Location
`src/lib/game/selectors.ts` line 202:

```typescript
entries.push({
  id: pending.id,
  itemId: pending.itemId,
  itemName: def?.name || 'Unknown',
  status: 'pending',
  quantity: pending.quantity,
  turnsRemaining: pending.turnsRemaining,
  eta: displayEnd,
  queuedTurn: displayStart, // ❌ BUG: Overwrites actual queue turn with display value!
  startTurn: displayStart,
  completionTurn: displayEnd,
});
```

### The Issue Chain

1. **Item Queued**: Structure queued at Turn 1
   - WorkItem created with `queuedTurn: 1` (actual queue turn)

2. **Auto-Advance**: Buildings auto-advance view to completion turn
   - User now viewing Turn 15 (completion turn)

3. **Selector Overwrites**: `getLaneView()` calculates display schedule
   - `displayStart = 10` (calculated from schedule)
   - Creates LaneEntry with `queuedTurn: 10` (overwrites actual value!)

4. **Cancel Attempt**: User clicks cancel
   - `handleCancelItem` uses `entry.queuedTurn` (which is 10, not 1)
   - `cancelEntryByIdSmart(10, 'building', entryId)` is called

5. **Search Fails**:
   - Looks at Turn 10 state
   - Item not in pending queue at Turn 10 (it's at Turn 1!)
   - Item might be active or in different state at Turn 10
   - Returns "INVALID_TURN" or "NOT_FOUND"

### Why Ships/Colonists Still Work

Ships/colonists DON'T auto-advance, so:
- Item queued at Turn 5
- User still viewing Turn 5 (no auto-advance)
- Selector overwrites with `displayStart` but displayStart ≈ Turn 5
- Cancel uses Turn 5, which is correct
- Works by accident!

## The Fix

**Preserve the actual `queuedTurn` from WorkItem:**

```typescript
entries.push({
  id: pending.id,
  itemId: pending.itemId,
  itemName: def?.name || 'Unknown',
  status: 'pending',
  quantity: pending.quantity,
  turnsRemaining: pending.turnsRemaining,
  eta: displayEnd,
  queuedTurn: pending.queuedTurn, // ✅ FIX: Preserve actual queue turn
  startTurn: displayStart,         // Display: when work starts
  completionTurn: displayEnd,      // Display: when work completes
});
```

## Why This Fix is Safe

1. **Minimal Change**: Only changes one field assignment
2. **Preserves Data**: Uses actual `queuedTurn` from WorkItem (source of truth)
3. **Display Unaffected**: `startTurn` and `completionTurn` still have display values
4. **No Lane Interference**: Change is in selector only, doesn't affect engine
5. **Ships/Colonists Unaffected**: They already work because their `queuedTurn` is close to `displayStart`

## Fix Implementation Status

✅ **FIXED** - `src/lib/game/selectors.ts:202`

Changed from:
```typescript
queuedTurn: displayStart, // For display purposes
```

To:
```typescript
queuedTurn: pending.queuedTurn, // Preserve actual queue turn for cancellation
```

## Verification

Confirmed that other sections already preserve `queuedTurn` correctly:
- **Active entries** (line 223): `queuedTurn: lane.active.queuedTurn` ✅
- **Completed entries** (line 155): `queuedTurn: completed.queuedTurn` ✅

The bug was isolated to pending entries only.

## Testing Checklist

- [ ] Cancel structure from first position in queue
- [ ] Cancel structure from middle of queue
- [ ] Cancel structure from last position in queue
- [ ] Cancel active structure (currently building)
- [ ] Cancel ship (regression test - should still work)
- [ ] Cancel colonist (regression test - should still work)
- [ ] Cancel batched ship (e.g., 5× Freighter)
- [ ] Queue structure, view completion turn, cancel (specific bug case)
