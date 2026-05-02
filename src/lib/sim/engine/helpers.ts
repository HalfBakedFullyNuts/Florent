/**
 * Helper utilities for state cloning and manipulation
 */

import type { PlanetState, LaneId, ItemDefinition } from './types';

/**
 * Deep clone planet state for immutable operations
 * Note: This uses JSON serialization for simplicity.
 * For production, consider using a library like structuredClone or immer.
 */
export function cloneState(state: PlanetState): PlanetState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Generate unique ID for work items
 */
export function generateWorkItemId(): string {
  return `wi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Refund activation costs when canceling or reordering an active item.
 * Restores resources, releases workers, and frees space.
 */
export function refundActivationCosts(
  state: PlanetState,
  def: ItemDefinition,
  quantity: number,
  laneId: LaneId
): void {
  const costs = def.costsPerUnit;

  // Refund resources
  state.stocks.metal += (costs.metal || 0) * quantity;
  state.stocks.mineral += (costs.mineral || 0) * quantity;
  state.stocks.food += (costs.food || 0) * quantity;
  state.stocks.energy += (costs.energy || 0) * quantity;
  state.stocks.research_points += (costs.research_points || 0) * quantity;

  // Release workers
  const workersNeeded = costs.workers || 0;
  if (workersNeeded > 0) {
    const totalWorkers = workersNeeded * quantity;
    state.population.workersIdle += totalWorkers;
    state.population.busyByLane[laneId] =
      (state.population.busyByLane[laneId] || 0) - totalWorkers;
  }

  // Release space — only structures reserved ground space, nothing to refund for ships/colonists
  const spaceNeeded = costs.space || 0;
  if (spaceNeeded > 0 && def.type === 'structure') {
    const totalSpace = spaceNeeded * quantity;
    state.space.groundUsed -= totalSpace;
  }
}
