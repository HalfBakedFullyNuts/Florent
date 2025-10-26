/**
 * Lane activation and progression logic
 * Handles queue management for building, ship, and colonist lanes
 */

import type { PlanetState, LaneId, WorkItem } from './types';
import { clampBatchAtActivation } from './validation';

/**
 * Try to activate next pending item in lane
 * Deducts resources and reserves workers/space at activation
 */
export function tryActivateNext(state: PlanetState, laneId: LaneId): void {
  const lane = state.lanes[laneId];

  // Check if there's a pending item and no active item
  if (lane.pendingQueue.length === 0 || lane.active) {
    return;
  }

  const pending = lane.pendingQueue[0];
  const def = state.defs[pending.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${pending.itemId}`);
    return;
  }

  // Clamp batch size based on available resources
  const actualQty = clampBatchAtActivation(state, def, pending.quantity);

  // If we can't afford any, keep it pending
  if (actualQty === 0) {
    return;
  }

  // Deduct resources from stocks
  const costs = def.costsPerUnit;
  state.stocks.metal -= costs.metal * actualQty;
  state.stocks.mineral -= costs.mineral * actualQty;
  state.stocks.food -= costs.food * actualQty;
  state.stocks.energy -= costs.energy * actualQty;

  // Reserve workers
  const workersNeeded = costs.workers || 0;
  if (workersNeeded > 0) {
    const totalWorkers = workersNeeded * actualQty;
    state.population.workersIdle -= totalWorkers;
    state.population.busyByLane[laneId] =
      (state.population.busyByLane[laneId] || 0) + totalWorkers;
  }

  // Reserve space
  const spaceNeeded = costs.space || 0;
  if (spaceNeeded > 0) {
    const totalSpace = spaceNeeded * actualQty;
    if (def.type === 'structure') {
      state.space.groundUsed += totalSpace;
    } else {
      state.space.orbitalUsed += totalSpace;
    }
  }

  // Move item from pending to active with turn tracking
  lane.active = {
    ...pending,
    quantity: actualQty,
    status: 'active',
    turnsRemaining: def.durationTurns,
    startTurn: state.currentTurn,
    // completionTurn will be set when the item actually completes
  };

  // Remove from pending queue
  lane.pendingQueue.shift();
}

/**
 * Progress active item in lane (decrement turnsRemaining)
 * Marks for completion when turnsRemaining reaches 0
 * Returns the completed item if it finished this turn, null otherwise
 */
export function progressActive(state: PlanetState, laneId: LaneId): WorkItem | null {
  const lane = state.lanes[laneId];

  // No active item to progress
  if (!lane.active) {
    return null;
  }

  const active = lane.active;
  const def = state.defs[active.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${active.itemId}`);
    return null;
  }

  // Decrement turns remaining
  active.turnsRemaining -= 1;

  // Check if completed
  if (active.turnsRemaining <= 0) {
    // Return workers to idle pool
    const workersNeeded = def.costsPerUnit.workers || 0;
    if (workersNeeded > 0) {
      const totalWorkers = workersNeeded * active.quantity;
      state.population.busyByLane[laneId] =
        (state.population.busyByLane[laneId] || 0) - totalWorkers;

      // For colonists, we don't return all workers (n-1 pattern handled in conversions)
      // For structures/ships, return all workers
      if (!def.colonistKind) {
        state.population.workersIdle += totalWorkers;
      }
    }

    // Mark as completed and set completion turn
    active.status = 'completed';
    active.completionTurn = state.currentTurn;
    const completedItem = { ...active };

    // Add to completion history for visual display
    lane.completionHistory.push(completedItem);

    lane.active = null;

    // For colonists, add to pending conversions (same-turn completion)
    if (def.colonistKind) {
      state.pendingColonistConversions.push(completedItem);
    }

    return completedItem;
  }

  return null;
}
