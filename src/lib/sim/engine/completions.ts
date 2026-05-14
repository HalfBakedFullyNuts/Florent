/**
 * Completion handling for structures, ships, and colonists
 * Manages timing differences between same-turn and next-turn completions
 */

import type { PlanetState, WorkItem } from './types';
import { DEMOLISH_PREFIX, demolishTarget } from '../../game/demolish';

/**
 * Reverse the effects of a completed building when a demolish item finishes.
 * - Decrements completedCounts for the target structure
 * - Reverses housing / space-cap deltas from effectsOnComplete
 * - Frees the ground or orbital space that was reserved at build-activation time
 */
function applyDemolishCompletion(state: PlanetState, item: WorkItem): void {
  const targetId = demolishTarget(item.itemId);
  if (!targetId) return;

  const def = state.defs[targetId];
  if (!def) {
    console.error(`applyDemolishCompletion: no def for "${targetId}"`);
    return;
  }

  // Decrement count (guard against going below 0)
  const current = state.completedCounts[targetId] ?? 0;
  if (current > 0) {
    state.completedCounts[targetId] = current - 1;
    if (state.completedCounts[targetId] === 0) {
      delete state.completedCounts[targetId];
    }
  }

  // Reverse housing capacity changes
  const effects = def.effectsOnComplete ?? {};
  if (effects.housing_worker_cap)   state.housing.workerCap    -= effects.housing_worker_cap;
  if (effects.housing_soldier_cap)  state.housing.soldierCap   -= effects.housing_soldier_cap;
  if (effects.housing_scientist_cap) state.housing.scientistCap -= effects.housing_scientist_cap;

  // Reverse space capacity changes
  if (effects.space_ground_cap)   state.space.groundCap  -= effects.space_ground_cap;
  if (effects.space_orbital_cap)  state.space.orbitalCap -= effects.space_orbital_cap;

  // Free the physical space the building was occupying
  const costs = def.costsPerUnit ?? {};
  if ((costs.space ?? 0) > 0)         state.space.groundUsed  -= costs.space;
  if ((costs.space_orbital ?? 0) > 0) state.space.orbitalUsed -= costs.space_orbital;
}

/**
 * Apply effects when structure/ship/research completes
 * Releases workers/space, updates counts, applies housing/space deltas, research effects
 */
export function applyStructureCompletion(state: PlanetState, item: WorkItem): void {
  // Demolish items reverse an existing building's effects instead of adding new ones
  if (item.itemId.startsWith(DEMOLISH_PREFIX)) {
    applyDemolishCompletion(state, item);
    return;
  }

  const def = state.defs[item.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${item.itemId}`);
    return;
  }

  // For research items, add to completedResearch instead of completedCounts
  if (def.lane === 'research') {
    if (!state.completedResearch) {
      state.completedResearch = [];
    }
    if (!state.completedResearch.includes(item.itemId)) {
      state.completedResearch.push(item.itemId);
    }
  } else {
    // Update completed counts for non-research items
    state.completedCounts[item.itemId] = (state.completedCounts[item.itemId] || 0) + item.quantity;
  }

  // Apply effects from completion
  const effects = def.effectsOnComplete;
  if (!effects) {
    return;
  }

  // Apply housing capacity changes
  if (effects.housing_worker_cap) {
    state.housing.workerCap += effects.housing_worker_cap * item.quantity;
  }
  if (effects.housing_soldier_cap) {
    state.housing.soldierCap += effects.housing_soldier_cap * item.quantity;
  }
  if (effects.housing_scientist_cap) {
    state.housing.scientistCap += effects.housing_scientist_cap * item.quantity;
  }

  // Apply space capacity changes
  if (effects.space_ground_cap) {
    state.space.groundCap += effects.space_ground_cap * item.quantity;
  }
  if (effects.space_orbital_cap) {
    state.space.orbitalCap += effects.space_orbital_cap * item.quantity;
  }

  // Apply research-specific effects
  if (effects.planet_limit && state.planetLimit !== undefined) {
    state.planetLimit = effects.planet_limit; // Set new planet limit
  }

  // Note: Workers are already released in progressActive()
  // Space used is permanent (structures/ships occupy space)
  // Research doesn't consume workers or space
}

/**
 * Apply colonist conversion (soldiers/scientists)
 * Happens in same turn - refund (n-1) workers, convert 1 to colonist
 */
export function applyColonistConversion(state: PlanetState, item: WorkItem): void {
  const def = state.defs[item.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${item.itemId}`);
    return;
  }

  if (!def.colonistKind) {
    console.error(`Item is not a colonist: ${item.itemId}`);
    return;
  }

  // Calculate worker refund (n-1 pattern)
  const workersOccupied = def.costsPerUnit.workers || 0;
  const totalWorkersOccupied = workersOccupied * item.quantity;
  const workersToRefund = totalWorkersOccupied - item.quantity; // n-1 per unit
  const colonistsCreated = item.quantity; // 1 per unit

  // Refund workers to idle pool
  state.population.workersIdle += workersToRefund;

  // Convert workers to colonists
  state.population.workersTotal -= colonistsCreated;
  if (def.colonistKind === 'soldier') {
    state.population.soldiers += colonistsCreated;
  } else if (def.colonistKind === 'scientist') {
    state.population.scientists += colonistsCreated;
  }

  // Update completed counts
  state.completedCounts[item.itemId] = (state.completedCounts[item.itemId] || 0) + item.quantity;
}

/**
 * Process all pending colonist conversions
 */
export function applyColonistConversions(state: PlanetState): void {
  // Process each pending conversion
  for (const item of state.pendingColonistConversions) {
    applyColonistConversion(state, item);
  }

  // Clear the pending conversions array
  state.pendingColonistConversions = [];
}

/**
 * Process completions from a list of completed items
 * This is called by the turn runner after draining the completion buffer
 */
export function processCompletions(state: PlanetState, completedItems: WorkItem[]): void {
  for (const item of completedItems) {
    applyStructureCompletion(state, item);
  }
}
