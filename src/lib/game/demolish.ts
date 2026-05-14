/**
 * Demolish helpers — scheduling the removal of a completed building.
 *
 * A demolish work item is queued into the building lane just like any other
 * structure, but its itemId is prefixed with DEMOLISH_PREFIX. When it
 * completes, completions.ts reverses the building's effects:
 *   - decrements completedCounts
 *   - restores housing/space caps
 *   - frees the ground or orbital space that was reserved at build time
 *
 * Duration: ceil(originalDuration / 2), minimum 1 turn.
 * Workers: same requirement as original construction.
 *
 * Prerequisites: [structureId] — the demolish waits in the queue until the
 * target building actually exists (so queuing a demolish of a yet-to-be-built
 * structure works correctly: it activates only after construction completes).
 *
 * Safety rule for enabling the button: demolishing is allowed when
 *   count > 1  → at least one copy remains, so no dependent building breaks, OR
 *   count == 1 → no other CURRENTLY BUILT building lists this as a prerequisite.
 * Pending queue items are not checked here; the player is responsible for
 * ensuring their queue stays consistent.
 */

import type { PlanetState, ItemDefinition, LaneId, UnitType } from '../sim/engine/types';

export const DEMOLISH_PREFIX = '__demolish__:';

/** Return the target structure id from a demolish item id, or null. */
export function demolishTarget(itemId: string): string | null {
  return itemId.startsWith(DEMOLISH_PREFIX) ? itemId.slice(DEMOLISH_PREFIX.length) : null;
}

/**
 * Create the synthetic ItemDefinition for demolishing `structureId`.
 * The def is injected into state.defs at queue time so the engine can
 * look it up normally (validation, worker reservation, completion).
 */
export function createDemolishDef(
  structureId: string,
  defs: Record<string, ItemDefinition>,
): ItemDefinition {
  const target = defs[structureId];
  if (!target) throw new Error(`createDemolishDef: no def for "${structureId}"`);

  const baseDuration = target.durationTurns ?? 1;
  const demolishDuration = Math.max(1, Math.ceil(baseDuration / 2));

  return {
    id: `${DEMOLISH_PREFIX}${structureId}`,
    name: `Demolish ${target.name}`,
    lane: 'building' as LaneId,
    type: 'structure' as UnitType,
    tier: target.tier ?? 0,
    durationTurns: demolishDuration,
    costsPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
      research_points: 0,
      workers: target.costsPerUnit?.workers ?? 0,
      space: 0,
      space_orbital: 0,
    },
    effectsOnComplete: {},
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
      research_points: 0,
    },
    // Waits in queue until the target building actually exists.
    prerequisites: [structureId],
    isAbundanceScaled: false,
  };
}

/**
 * Returns true if the building can be scheduled for demolition without
 * breaking the prerequisites of any other currently-built structure.
 *
 * Uses the state at the currently viewed turn so the check matches what
 * the player sees in the dashboard.
 */
export function canDemolish(
  structureId: string,
  state: PlanetState,
  defs: Record<string, any>,
): boolean {
  const count = state.completedCounts[structureId] ?? 0;
  if (count === 0) return false;

  // Demolishing one copy still leaves count - 1 copies.
  // All prerequisite checks only require count >= 1, so if count > 1 we're always safe.
  if (count > 1) return true;

  // count === 1: check whether any OTHER completed building requires this one.
  for (const [otherId, otherCount] of Object.entries(state.completedCounts)) {
    if ((otherCount as number) <= 0) continue;
    if (otherId === structureId) continue;
    const prereqs: string[] = defs[otherId]?.prerequisites ?? [];
    if (prereqs.includes(structureId)) return false;
  }

  return true;
}
