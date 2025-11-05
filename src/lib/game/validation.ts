/**
 * Queue Validation System
 *
 * Validates queue entries across all lanes to detect invalid states
 * after queue modifications (removals, additions, etc.)
 */

import type { PlanetState, LaneId, ItemDefinition } from '../sim/engine/types';
import { canQueue } from '../sim/engine/validation';
import type { LaneEntry } from './selectors';

export interface QueueValidationResult {
  entryId: string;
  laneId: LaneId;
  valid: boolean;
  reason?: string; // e.g., "REQ_MISSING: metal_mine"
  missingPrereqs?: string[]; // For detailed error messages
}

/**
 * Validate all items in all queues
 * Returns list of validation results for each item
 *
 * This function is called after queue modifications (like removal)
 * to identify items that have become invalid.
 *
 * Performance: Optimized to complete in <50ms for 10+ items across 3 lanes
 */
export function validateAllQueueItems(
  state: PlanetState,
  getLaneEntries: (state: PlanetState, laneId: LaneId) => LaneEntry[]
): QueueValidationResult[] {
  const results: QueueValidationResult[] = [];

  // Validate each lane in sequence
  const laneIds: LaneId[] = ['building', 'ship', 'colonist'];

  for (const laneId of laneIds) {
    const entries = getLaneEntries(state, laneId);

    for (const entry of entries) {
      // Skip completed items - they're already built
      if (entry.status === 'completed') continue;

      const validation = validateQueueEntry(state, entry, laneId);
      results.push({
        entryId: entry.id,
        laneId,
        ...validation
      });
    }
  }

  return results;
}

/**
 * Validate a single queue entry
 *
 * Checks:
 * - Prerequisites: Does the item require structures/research that won't exist?
 * - Resources: Will resources be available at queue time?
 * - Workers: Will enough workers be available at activation time?
 * - Space: Will ground/orbital space be available?
 * - Housing: For colonists, will housing capacity exist?
 */
export function validateQueueEntry(
  state: PlanetState,
  entry: LaneEntry,
  laneId: LaneId
): { valid: boolean; reason?: string; missingPrereqs?: string[] } {

  const def = state.defs[entry.itemId];
  if (!def) {
    return { valid: false, reason: 'UNKNOWN_ITEM' };
  }

  // For pending/active items, check prerequisites at the item's start turn
  // This handles the case where a prerequisite structure was removed from the queue
  const checkTurn = entry.startTurn || state.currentTurn;

  // Prerequisite check
  if (def.prerequisites && def.prerequisites.length > 0) {
    const missing: string[] = [];

    for (const prereqId of def.prerequisites) {
      // Check if this prerequisite will exist at the item's start turn
      // Look at completed counts in current state
      const count = state.completedCounts[prereqId] || 0;

      // Also check if the prerequisite is in the queue before this item
      // (items earlier in the queue will complete before this one)
      let willExist = count > 0;

      if (!willExist && entry.startTurn) {
        // Check if prerequisite is queued earlier and will complete before this item starts
        const prereqDef = state.defs[prereqId];
        if (prereqDef) {
          const prereqLane = state.lanes[prereqDef.lane];

          // Check active item
          if (prereqLane.active && prereqLane.active.itemId === prereqId) {
            const activeCompletion = prereqLane.active.completionTurn;
            if (activeCompletion && activeCompletion < entry.startTurn) {
              willExist = true;
            }
          }

          // Check pending queue
          for (const pending of prereqLane.pendingQueue) {
            if (pending.itemId === prereqId) {
              // Calculate when this pending item will complete
              // This is a simplified check - actual completion depends on queue position
              const pendingDef = state.defs[pending.itemId];
              if (pendingDef) {
                // Estimate completion turn (this is approximate)
                let estimatedCompletion = state.currentTurn;
                if (prereqLane.active) {
                  estimatedCompletion += prereqLane.active.turnsRemaining;
                }
                // Add duration of all items before this one in queue
                const pendingIndex = prereqLane.pendingQueue.indexOf(pending);
                for (let i = 0; i < pendingIndex; i++) {
                  const priorDef = state.defs[prereqLane.pendingQueue[i].itemId];
                  if (priorDef) {
                    estimatedCompletion += priorDef.durationTurns;
                  }
                }
                estimatedCompletion += pendingDef.durationTurns;

                if (estimatedCompletion < entry.startTurn) {
                  willExist = true;
                  break;
                }
              }
            }
          }
        }
      }

      if (!willExist) {
        missing.push(prereqId);
      }
    }

    if (missing.length > 0) {
      return {
        valid: false,
        reason: `REQ_MISSING: ${missing[0]}`,
        missingPrereqs: missing
      };
    }
  }

  // Housing check (for colonists)
  if (laneId === 'colonist') {
    const housingRequired = def.costsPerUnit?.housing || 0;
    const availableHousing = state.housing.workerCap - state.population.workersTotal;

    if (housingRequired > availableHousing) {
      return {
        valid: false,
        reason: `INSUFFICIENT_HOUSING: need ${housingRequired}, have ${availableHousing}`
      };
    }
  }

  // Resource check - use the canQueue validation which checks resources
  const canAfford = canQueue(state, def, entry.quantity);
  if (!canAfford.allowed) {
    return {
      valid: false,
      reason: canAfford.reason
    };
  }

  return { valid: true };
}

/**
 * Get human-readable validation message
 * Converts validation reason codes to user-friendly messages
 */
export function getValidationMessage(result: QueueValidationResult): string {
  if (result.valid) {
    return '';
  }

  const reason = result.reason || 'UNKNOWN';

  if (reason.startsWith('REQ_MISSING:')) {
    const prereq = reason.split(':')[1]?.trim() || 'unknown';
    return `Missing prerequisite: ${prereq}`;
  }

  if (reason.startsWith('INSUFFICIENT_HOUSING:')) {
    return reason.replace('INSUFFICIENT_HOUSING:', 'Not enough housing:');
  }

  switch (reason) {
    case 'HOUSING_MISSING':
      return 'Insufficient housing capacity';
    case 'ENERGY_INSUFFICIENT':
      return 'Not enough energy';
    case 'REQ_MISSING':
      return 'Missing prerequisites';
    default:
      return reason;
  }
}
