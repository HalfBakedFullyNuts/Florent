/**
 * Enhanced queue validation with auto-wait calculation
 * Determines if items can be queued now or eventually with waiting
 */

import type { PlanetState, ItemDefinition, LaneId, WorkItem, ResourceId } from './types';
import { hasPrereqs, isPlanetLimitReached, energyNonNegativeAfterCompletion } from './validation';
import { computeNetOutputsPerTurn } from './outputs';

export interface QueueValidationResult {
  canQueueNow: boolean; // Can queue immediately without waiting
  canQueueEventually: boolean; // Can queue with auto-wait
  waitTurnsNeeded: number; // How many wait turns needed (0 if can queue now)
  reason?: string; // Human-readable reason
  blockers: QueueBlocker[]; // Detailed blocker information
}

export interface QueueBlocker {
  type: 'PREREQUISITE' | 'HOUSING' | 'RESOURCES' | 'ENERGY' | 'PLANET_LIMIT';
  prereqId?: string; // For prerequisite blockers
  turnsUntilReady?: number; // Estimated turns until blocker is resolved
  message: string;
}

/**
 * Calculate when a prerequisite will be completed
 * Returns null if prerequisite is not in queue/active
 */
function calculatePrereqCompletionTurn(
  state: PlanetState,
  prereqId: string
): number | null {
  // Check if already completed
  if (state.completedResearch?.includes(prereqId)) {
    return state.currentTurn; // Already available
  }
  if ((state.completedCounts[prereqId] || 0) > 0) {
    return state.currentTurn; // Already available
  }

  // Check all lanes for the prerequisite
  const allLanes: LaneId[] = ['building', 'ship', 'colonist', 'research'];

  for (const laneId of allLanes) {
    const lane = state.lanes[laneId];

    // Check active item
    if (lane.active?.itemId === prereqId) {
      // Calculate when it will complete
      return state.currentTurn + lane.active.turnsRemaining;
    }

    // Check pending queue
    const pendingIndex = lane.pendingQueue.findIndex(item => item.itemId === prereqId);
    if (pendingIndex !== -1) {
      // Calculate when it will complete
      // Need to sum up duration of all items before it + its own duration
      let turnsUntilStart = 0;

      // Add active item duration if exists
      if (lane.active) {
        turnsUntilStart += lane.active.turnsRemaining;
      }

      // Add duration of all pending items before this one
      for (let i = 0; i < pendingIndex; i++) {
        const item = lane.pendingQueue[i];
        const def = state.defs[item.itemId];
        turnsUntilStart += item.isWait ? item.turnsRemaining : (def?.durationTurns || 0);
      }

      // Add duration of the prerequisite itself
      const prereqDef = state.defs[prereqId];
      const prereqDuration = prereqDef?.durationTurns || 0;

      return state.currentTurn + turnsUntilStart + prereqDuration;
    }
  }

  return null; // Not found in queue
}

/**
 * Calculate when housing will be available for colonists
 * Returns turns until housing is ready, or 0 if ready now
 */
function calculateHousingWaitTurns(
  state: PlanetState,
  def: ItemDefinition,
  qty: number
): number {
  if (!def.colonistKind) {
    return 0; // Not a colonist, no housing needed
  }

  const housingType = def.colonistKind;
  const currentCap = housingType === 'soldier'
    ? state.housing.soldierCap
    : state.housing.scientistCap;
  const currentPop = housingType === 'soldier'
    ? state.population.soldiers
    : state.population.scientists;

  const availableNow = currentCap - currentPop;
  if (availableNow >= qty) {
    return 0; // Housing available now
  }

  // Check if housing capacity will increase from queued/active buildings
  const buildingLane = state.lanes.building;
  let futureCapIncrease = 0;
  let turnsUntilIncrease = 0;

  // Check active building
  if (buildingLane.active) {
    const activeDef = state.defs[buildingLane.active.itemId];
    if (activeDef?.effectsOnComplete) {
      const capIncrease = housingType === 'soldier'
        ? (activeDef.effectsOnComplete.housing_soldier_cap || 0)
        : (activeDef.effectsOnComplete.housing_scientist_cap || 0);
      if (capIncrease > 0) {
        futureCapIncrease += capIncrease * buildingLane.active.quantity;
        turnsUntilIncrease = buildingLane.active.turnsRemaining;
      }
    }
  }

  // Check pending buildings
  let cumulativeTurns = buildingLane.active?.turnsRemaining || 0;
  for (const pending of buildingLane.pendingQueue) {
    const pendingDef = state.defs[pending.itemId];
    if (pendingDef?.effectsOnComplete) {
      const capIncrease = housingType === 'soldier'
        ? (pendingDef.effectsOnComplete.housing_soldier_cap || 0)
        : (pendingDef.effectsOnComplete.housing_scientist_cap || 0);
      if (capIncrease > 0) {
        futureCapIncrease += capIncrease * pending.quantity;
        if (turnsUntilIncrease === 0) {
          turnsUntilIncrease = cumulativeTurns + (pendingDef.durationTurns || 0);
        }
      }
    }
    cumulativeTurns += pendingDef?.durationTurns || 0;
  }

  // Check if future capacity will be sufficient
  const futureAvailable = (currentCap + futureCapIncrease) - currentPop;
  if (futureAvailable >= qty) {
    return turnsUntilIncrease; // Will be ready after these turns
  }

  // Not enough housing even with queued buildings
  return -1; // Indicate impossible without more housing buildings
}

/**
 * Calculate when resources will accumulate to required amounts
 * Returns turns until all resources are sufficient, or -1 if impossible
 */
function calculateResourceWaitTurns(
  state: PlanetState,
  def: ItemDefinition,
  qty: number
): number {
  const costs = def.costsPerUnit;
  if (!costs) return 0;

  const netOutputs = computeNetOutputsPerTurn(state);
  let maxWaitTurns = 0;

  // Check each resource type
  const resourceTypes: ResourceId[] = ['metal', 'mineral', 'food', 'energy', 'research_points'];

  for (const resourceId of resourceTypes) {
    const required = (costs[resourceId] || 0) * qty;
    const current = state.stocks[resourceId] || 0;

    if (required <= current) {
      continue; // Already have enough
    }

    const needed = required - current;
    const netPerTurn = netOutputs[resourceId] || 0;

    if (netPerTurn <= 0) {
      // Not producing this resource (or consuming more than producing)
      return -1; // Impossible to accumulate
    }

    const turnsNeeded = Math.ceil(needed / netPerTurn);
    maxWaitTurns = Math.max(maxWaitTurns, turnsNeeded);
  }

  return maxWaitTurns;
}

/**
 * Enhanced validation with auto-wait calculation
 */
export function validateQueueWithWait(
  state: PlanetState,
  def: ItemDefinition,
  requestedQty: number
): QueueValidationResult {
  const blockers: QueueBlocker[] = [];
  let maxWaitTurns = 0;

  // Check planet limit (hard blocker - can never be queued)
  if (isPlanetLimitReached(state, def)) {
    return {
      canQueueNow: false,
      canQueueEventually: false,
      waitTurnsNeeded: 0,
      reason: 'Planet limit reached',
      blockers: [{
        type: 'PLANET_LIMIT',
        message: `Maximum ${def.maxPerPlanet} per planet already reached`,
      }],
    };
  }

  // Check prerequisites
  if (!hasPrereqs(state, def)) {
    // Find which prerequisites are missing
    for (const prereqId of def.prerequisites || []) {
      const completionTurn = calculatePrereqCompletionTurn(state, prereqId);

      if (completionTurn === null) {
        // Prerequisite not in queue at all - hard blocker
        const prereqDef = state.defs[prereqId];
        return {
          canQueueNow: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          reason: 'Missing prerequisite',
          blockers: [{
            type: 'PREREQUISITE',
            prereqId,
            message: `Requires ${prereqDef?.name || prereqId} (not queued)`,
          }],
        };
      }

      if (completionTurn > state.currentTurn) {
        // Prerequisite in queue, will be ready in future
        const turnsUntilReady = completionTurn - state.currentTurn;
        maxWaitTurns = Math.max(maxWaitTurns, turnsUntilReady);
        const prereqDef = state.defs[prereqId];
        blockers.push({
          type: 'PREREQUISITE',
          prereqId,
          turnsUntilReady,
          message: `Waiting for ${prereqDef?.name || prereqId} (${turnsUntilReady} turns)`,
        });
      }
    }
  }

  // Check housing for colonists
  if (def.colonistKind) {
    const housingWait = calculateHousingWaitTurns(state, def, requestedQty);
    if (housingWait === -1) {
      // Not enough housing even with queued buildings - hard blocker
      return {
        canQueueNow: false,
        canQueueEventually: false,
        waitTurnsNeeded: 0,
        reason: 'Insufficient housing capacity',
        blockers: [{
          type: 'HOUSING',
          message: `Need to queue more ${def.colonistKind === 'soldier' ? 'barracks' : 'research labs'}`,
        }],
      };
    }

    if (housingWait > 0) {
      maxWaitTurns = Math.max(maxWaitTurns, housingWait);
      blockers.push({
        type: 'HOUSING',
        turnsUntilReady: housingWait,
        message: `Waiting for housing capacity (${housingWait} turns)`,
      });
    }
  }

  // Check resource accumulation
  const resourceWait = calculateResourceWaitTurns(state, def, requestedQty);
  if (resourceWait === -1) {
    // Not producing resources needed - hard blocker
    return {
      canQueueNow: false,
      canQueueEventually: false,
      waitTurnsNeeded: 0,
      reason: 'Insufficient resource production',
      blockers: [{
        type: 'RESOURCES',
        message: 'Resources not being produced (or net negative production)',
      }],
    };
  }

  if (resourceWait > 0) {
    maxWaitTurns = Math.max(maxWaitTurns, resourceWait);
    blockers.push({
      type: 'RESOURCES',
      turnsUntilReady: resourceWait,
      message: `Waiting for resources to accumulate (${resourceWait} turns)`,
    });
  }

  // Check energy forward-check
  if (!energyNonNegativeAfterCompletion(state, def, requestedQty)) {
    blockers.push({
      type: 'ENERGY',
      message: 'Would cause negative energy output',
    });
    // This is a soft blocker - user might want to queue anyway
    // Don't return early, let them decide
  }

  // Determine result
  const canQueueNow = blockers.length === 0;
  const canQueueEventually = true; // If we got here, no hard blockers

  return {
    canQueueNow,
    canQueueEventually,
    waitTurnsNeeded: maxWaitTurns,
    reason: blockers.length > 0 ? blockers[0].message : undefined,
    blockers,
  };
}

/**
 * Calculate auto-wait turns needed before an item can be queued
 * Returns the number of wait turns to insert before the item
 */
export function calculateAutoWaitTurns(
  state: PlanetState,
  def: ItemDefinition,
  requestedQty: number
): number {
  const validation = validateQueueWithWait(state, def, requestedQty);
  return validation.waitTurnsNeeded;
}
