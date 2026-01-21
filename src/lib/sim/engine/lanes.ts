/**
 * Lane activation and progression logic
 * Handles queue management for building, ship, and colonist lanes
 */

import type { PlanetState, LaneId, WorkItem, ItemDefinition } from './types';
import { clampBatchAtActivation } from './validation';
import { getLogger } from '../../game/logger';

/**
 * Activate a wait item in the lane.
 * Wait items have no resource costs and always activate immediately.
 */
function activateWaitItem(
  state: PlanetState,
  lane: PlanetState['lanes'][LaneId],
  laneId: LaneId,
  pending: WorkItem
): void {
  if (!pending.isWait) {
    console.error('activateWaitItem called with non-wait item');
    return;
  }
  if (pending.turnsRemaining <= 0) {
    console.error('Wait item must have positive turnsRemaining');
    return;
  }

  lane.active = {
    ...pending,
    status: 'active',
    startTurn: state.currentTurn,
  };

  getLogger().logQueueOperation(
    state.currentTurn,
    'activate',
    laneId,
    '__wait__',
    'Wait',
    pending.quantity,
    `Wait activated for ${pending.turnsRemaining} turns`
  );

  lane.pendingQueue.shift();
}

/**
 * Deduct resource costs from state for activating an item.
 * Modifies state.stocks in place based on costs and quantity.
 */
function deductActivationCosts(
  state: PlanetState,
  def: ItemDefinition,
  quantity: number,
  laneId: LaneId
): void {
  if (quantity <= 0) {
    console.error('deductActivationCosts: quantity must be positive');
    return;
  }
  if (!def.costsPerUnit) {
    console.error('deductActivationCosts: definition missing costsPerUnit');
    return;
  }

  const costs = def.costsPerUnit;
  state.stocks.metal -= costs.metal * quantity;
  state.stocks.mineral -= costs.mineral * quantity;
  state.stocks.food -= costs.food * quantity;
  state.stocks.energy -= costs.energy * quantity;

  if (laneId !== 'research') {
    state.stocks.research_points -= costs.research_points * quantity;
  }
}

/**
 * Reserve workers and space for an activating item.
 * Updates population.busyByLane and space usage.
 */
function reserveWorkersAndSpace(
  state: PlanetState,
  def: ItemDefinition,
  quantity: number,
  laneId: LaneId
): void {
  if (quantity <= 0) return;
  if (!def.costsPerUnit) return;

  const workersNeeded = def.costsPerUnit.workers || 0;
  if (workersNeeded > 0) {
    const totalWorkers = workersNeeded * quantity;
    if (totalWorkers > state.population.workersIdle) {
      console.error('reserveWorkersAndSpace: insufficient idle workers');
    }
    state.population.workersIdle -= totalWorkers;
    state.population.busyByLane[laneId] =
      (state.population.busyByLane[laneId] || 0) + totalWorkers;
  }

  const spaceNeeded = def.costsPerUnit.space || 0;
  if (spaceNeeded > 0) {
    const totalSpace = spaceNeeded * quantity;
    if (def.type === 'structure') {
      state.space.groundUsed += totalSpace;
    } else {
      state.space.orbitalUsed += totalSpace;
    }
  }
}

/**
 * Try to activate next pending item in lane.
 * Deducts resources and reserves workers/space at activation.
 */
export function tryActivateNext(state: PlanetState, laneId: LaneId): void {
  if (!state || !state.lanes[laneId]) return;

  const lane = state.lanes[laneId];
  if (lane.pendingQueue.length === 0 || lane.active) return;

  const pending = lane.pendingQueue[0];

  if (pending.isWait) {
    activateWaitItem(state, lane, laneId, pending);
    return;
  }

  const def = state.defs[pending.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${pending.itemId}`);
    return;
  }

  const actualQty = clampBatchAtActivation(state, def, pending.quantity);
  if (actualQty === 0) return;

  deductActivationCosts(state, def, actualQty, laneId);
  reserveWorkersAndSpace(state, def, actualQty, laneId);

  lane.active = {
    ...pending,
    quantity: actualQty,
    status: 'active',
    turnsRemaining: def.durationTurns,
    startTurn: state.currentTurn,
  };

  getLogger().logQueueOperation(
    state.currentTurn,
    'activate',
    laneId,
    def.id,
    def.name,
    actualQty,
    `Activated with ${actualQty} quantity (requested: ${pending.quantity})`
  );

  lane.pendingQueue.shift();
}

/**
 * Complete a wait item and record in history.
 * Returns the completed item for tracking.
 */
function completeWaitItem(
  state: PlanetState,
  lane: PlanetState['lanes'][LaneId],
  laneId: LaneId,
  active: WorkItem
): WorkItem {
  active.status = 'completed';
  active.completionTurn = state.currentTurn;
  const completedItem = { ...active };

  getLogger().logQueueOperation(
    state.currentTurn,
    'complete',
    laneId,
    '__wait__',
    'Wait',
    active.quantity,
    `Wait completed at turn ${state.currentTurn}`
  );

  lane.completionHistory.push(completedItem);
  lane.active = null;
  return completedItem;
}

/**
 * Return workers to idle pool after item completion.
 * Colonists don't return workers (handled by conversion logic).
 */
function returnWorkersOnCompletion(
  state: PlanetState,
  def: ItemDefinition,
  quantity: number,
  laneId: LaneId
): void {
  const workersNeeded = def.costsPerUnit.workers || 0;
  if (workersNeeded <= 0) return;

  const totalWorkers = workersNeeded * quantity;
  state.population.busyByLane[laneId] =
    (state.population.busyByLane[laneId] || 0) - totalWorkers;

  if (!def.colonistKind) {
    state.population.workersIdle += totalWorkers;
  }
}

/**
 * Complete a normal (non-wait) item and record in history.
 * Returns the completed item, or null if definition not found.
 */
function completeNormalItem(
  state: PlanetState,
  lane: PlanetState['lanes'][LaneId],
  laneId: LaneId,
  active: WorkItem
): WorkItem | null {
  const def = state.defs[active.itemId];
  if (!def) {
    console.error(`Definition not found for item: ${active.itemId}`);
    return null;
  }

  returnWorkersOnCompletion(state, def, active.quantity, laneId);

  active.status = 'completed';
  active.completionTurn = state.currentTurn;
  const completedItem = { ...active };

  getLogger().logQueueOperation(
    state.currentTurn,
    'complete',
    laneId,
    def.id,
    def.name,
    active.quantity,
    `Completed at turn ${state.currentTurn}`
  );

  lane.completionHistory.push(completedItem);
  lane.active = null;

  if (def.colonistKind) {
    state.pendingColonistConversions.push(completedItem);
  }

  return completedItem;
}

/**
 * Progress active item in lane (decrement turnsRemaining).
 * Returns completed item if finished this turn, null otherwise.
 */
export function progressActive(state: PlanetState, laneId: LaneId): WorkItem | null {
  if (!state || !state.lanes[laneId]) return null;

  const lane = state.lanes[laneId];
  if (!lane.active) return null;

  const active = lane.active;
  active.turnsRemaining -= 1;

  if (active.turnsRemaining > 0) return null;

  return active.isWait
    ? completeWaitItem(state, lane, laneId, active)
    : completeNormalItem(state, lane, laneId, active);
}
