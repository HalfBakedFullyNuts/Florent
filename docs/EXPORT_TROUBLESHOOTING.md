# Export Feature Troubleshooting Guide

## Common Issues and Solutions

### 1. Export Shows Empty or Missing Items

**Symptom**: When clicking "Export Current View" or "Export Full List", the export shows only some items or appears empty, especially for ships and colonists.

**Root Cause**: The export feature correctly shows what's actually in the queues. If items are missing from the export, it's because they were never successfully queued.

### 2. Why Can't I Queue Ships or Colonists?

Most ships and colonists require prerequisite structures to be built first:

#### Ship Prerequisites:
- **Fighter**: Requires `Shipyard`
- **Bomber**: Requires `Shipyard`
- **Heavy Bomber**: Requires `Shipyard`
- **Destroyer**: Requires `Shipyard`
- **Cruiser**: Requires `Shipyard`
- **Battleship**: Requires `Shipyard`

#### Colonist Prerequisites:
- **Soldier**: Requires `Army Barracks`
- **Scientist**: Requires `Research Lab`

#### Buildings with Prerequisites:
- **Habitat**: Requires `Launch Site`
- **Metropolis**: Requires `Launch Site`
- Many Tier 3+ structures have additional requirements

### 3. How to Successfully Queue Items

1. **Check Prerequisites**: Before trying to queue a ship or colonist, ensure you have built the required structure
2. **Build Prerequisites First**: Queue and complete the prerequisite structures
3. **Wait for Completion**: Prerequisites must be COMPLETED (not just queued) before you can queue dependent items
4. **Queue at the Right Turn**: After prerequisites complete, advance to or past that turn to queue dependent items

### 4. Example Workflow

To export a build order with ships:

```
Turn 1: Queue Shipyard
Turn 11: Shipyard completes (assuming 10 turn build time)
Turn 11+: Now you can queue Fighter, Bomber, etc.
Export: Will show both Shipyard and the ships
```

### 5. What Gets Exported

The export feature includes ALL items in your build order:
- **Completed Items**: Items that have already finished building (your full strategy from the start)
- **Active Items**: Items currently being built with their ETA
- **Pending Items**: Items queued and waiting to be built

This is a **build order planner** - the export shows your complete strategy so you can share it with friends!

### 6. Export Modes

- **Export Current View**: Exports items completing up to and including the currently viewed turn
- **Export Full List**: Exports ALL items (completed, active, and pending) regardless of completion turn

### 7. Debugging Export Issues

If your export seems wrong:

1. **Check the Queue Display**: The export shows exactly what's in the Planet Queue display
2. **Look for Error Messages**: Failed queue attempts show reasons (REQ_MISSING = missing prerequisites)
3. **Verify Prerequisites**: Use the item grid to see requirements (shown in red when not met)
4. **Check Turn Number**: Some items can only be queued after certain structures complete

### 8. Technical Details

The export system works by:
1. Reading the current lane states (building, ship, colonist)
2. Including ALL items: completed (with completionTurn), active (with eta), and pending (with completionTurn)
3. Sorting all items by their completion turn
4. Formatting the data as Plain Text or Discord table

### Important Notes

- The export shows your **complete build order** from turn 1 onwards
- This is a build order planner - you share your full strategy with friends
- Empty exports for ships/colonists usually mean prerequisites aren't met
- The game prevents queueing items without requirements to maintain game balance