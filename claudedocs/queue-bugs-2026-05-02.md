# Queue Bugs & Feature Tickets — 2026-05-02

## Ticket 1: Research items must be unique (no duplicate queueing)

**Problem**: Research items can be queued multiple times. E.g. PL6 can be added again even though it's already in the research queue.

**Diagnosis steps**:
1. Check `canQueueItem` in `src/app/page.tsx` — does it check whether the item is already in the research queue?
2. Check `isUniqueLimitReached` in `src/lib/sim/engine/validation.ts` — it checks `completedCounts` and active/pending queue, but only for items with `unique: true`.
3. Check `adapter.client.ts` `convertResearch` — does it set `unique: true` on research ItemDefinitions? (Likely `false` currently.)

**Fix direction**:
- Set `unique: true` for all research items in `convertResearch()` in `adapter.client.ts`.
- Verify `isUniqueLimitReached` counts research lane pending/active items correctly (it currently scans `state.lanes[def.lane]`).
- Confirm the UI greys out already-queued research in `TabbedItemGrid.tsx`.

---

## Ticket 2: Removed research items cannot be re-added

**Problem**: After removing a research item from the queue, it stays greyed out and can't be queued again.

**Diagnosis steps**:
1. After cancelling a research item, inspect `state.completedCounts[itemId]` and `state.completedResearch` — is the item incorrectly left in one of these?
2. Check `cancelPlannedItem` in `src/lib/game/commands.ts` — does it clean up completion tracking correctly?
3. Check whether cascade removal (Ticket 4) is incorrectly removing related items, making it look like the item itself can't be re-added.
4. Check `isUniqueLimitReached` — if Ticket 1 sets `unique: true` for research, does the count correctly decrement on cancel?

**Fix direction**:
- Ensure cancellation fully removes the item from all tracking (pendingQueue, active slot, completedCounts, completedResearch).
- If the issue is cascade removal (Ticket 4), fixing that may resolve this automatically.
- Add a test: queue research → cancel → verify canQueueItem returns allowed.

---

## Ticket 3: Add "Reset Queue" button

**Problem**: No way to reset the simulator to its starting state without refreshing the page.

**Diagnosis steps**:
1. Check `GameController` or `commands.ts` for an existing reset/clear method.
2. Check `GameStateContext.tsx` for how planets are initialized — need to replicate that fresh state.

**Fix direction**:
- Add a `resetPlanet()` method to `GameController` that replaces the timeline with a fresh initial state (same as planet creation).
- Add a button in the planet tab bar area (far right) in `src/app/page.tsx` or the relevant header component.
- Style: small, clearly labeled "Reset Queue" with a confirmation prompt (or undo toast) to prevent accidental clicks.
- The button should reset ALL lanes (building, ship, colonist, research) and restore starting resources/population.

---

## Ticket 4: Cascade removal removes items in wrong direction

**Problem**: Removing a comms satellite (which *requires* a launch site) incorrectly cascade-removes the launch site, research lab, all research, and the shipyard. The dependency direction is inverted — removing a *dependent* item should NOT remove its *prerequisites*.

**Diagnosis steps**:
1. Read `getDependentQueueItems` in `src/lib/game/validation.ts` (line 209-253) — this finds items that *depend on* the cancelled item.
2. Read `executeCancellation` in `src/app/page.tsx` — trace exactly what happens after cancel.
3. **Key question**: Is `getDependentQueueItems` being called with the right item? Or is cascade removal running in a loop that snowballs?
4. Check if `validateAllQueueItems` (called after repack) is over-flagging items as invalid because the repack itself shifts timing, making prerequisites appear "not yet completed" at new start turns.
5. Check `validateQueueEntry` — the `willExist` logic uses `estimatedCompletion < entry.startTurn`. After repack, start turns shift — does this cause false positives?

**Root cause hypothesis**:
The cascade loop in `executeCancellation` calls `validateAllQueueItems` after removing one item + repacking. Repacking shifts all start/completion turns. Items that were valid before now fail the timing check (`estimatedCompletion < entry.startTurn`) because their start turn moved earlier while their prerequisite's completion turn didn't update in the cloned state. This creates a snowball: remove 1 item → repack → timing shifts → 5 more items appear "broken" → auto-remove those too.

**Fix direction**:
- The cascade should ONLY remove items whose prerequisite *item* was the one cancelled (direct dependency), not items that fail a timing re-check.
- Replace the post-repack `validateAllQueueItems` approach with a targeted graph walk: find items that list the cancelled item's definition ID in their `prerequisites` array, then recursively find items depending on *those*, etc.
- Do NOT re-validate timing — only check prerequisite chain breakage.
- Add tests: cancel comms_satellite → launch_site stays; cancel launch_site → comms_satellite removed.
