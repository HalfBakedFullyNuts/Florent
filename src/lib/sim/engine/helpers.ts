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
 * Monotonic counter for work-item IDs. Deterministic within a session and
 * seeded past restored ids so saves never collide after a reload.
 */
let workItemIdSeq = 0;

const WORK_ITEM_ID_PREFIX = 'wi_';

function extractWorkItemSeq(id: string | undefined): number {
  if (!id || !id.startsWith(WORK_ITEM_ID_PREFIX)) return 0;
  const n = Number(id.slice(WORK_ITEM_ID_PREFIX.length));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

/**
 * Advance the counter past every id already present in a (restored) state.
 * Safe to call with undefined — resets nothing, just skips scanning.
 */
export function seedWorkItemIdCounterFromState(state: PlanetState | undefined): void {
  if (!state) return;
  let max = 0;
  const consider = (id: string | undefined): void => {
    const n = extractWorkItemSeq(id);
    if (n > max) max = n;
  };
  for (const lane of Object.values(state.lanes || {})) {
    consider(lane.active?.id);
    for (const pending of lane.pendingQueue) consider(pending.id);
    for (const done of lane.completionHistory) consider(done.id);
  }
  for (const conv of state.pendingColonistConversions) consider(conv.id);
  if (max >= workItemIdSeq) workItemIdSeq = max + 1;
}

/**
 * Generate unique ID for work items (strictly increasing, no clock/random).
 */
export function generateWorkItemId(): string {
  workItemIdSeq += 1;
  return `${WORK_ITEM_ID_PREFIX}${workItemIdSeq}`;
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
