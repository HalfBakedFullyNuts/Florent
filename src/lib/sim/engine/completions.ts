/**
 * Completion handling for structures, ships, and colonists
 * Manages timing differences between same-turn and next-turn completions
 */

import type { PlanetState, WorkItem } from './types';

/**
 * Apply effects when structure/ship completes
 * Releases workers/space, updates counts, applies housing/space deltas
 */
export function applyStructureCompletion(state: PlanetState, item: WorkItem): void {
  const def = state.defs[item.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${item.itemId}`);
    return;
  }

  // Update completed counts
  state.completedCounts[item.itemId] = (state.completedCounts[item.itemId] || 0) + item.quantity;

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

  // Note: Workers are already released in progressActive()
  // Space used is permanent (structures/ships occupy space)
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
