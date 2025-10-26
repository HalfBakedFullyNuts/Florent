/**
 * Test helpers for engine tests
 */

import type { PlanetState, WorkItem } from '../types';

let itemIdCounter = 0;

export function generateItemId(): string {
  return `item_${++itemIdCounter}`;
}

export function queueItem(state: PlanetState, itemId: string, quantity: number): void {
  const def = state.defs[itemId];
  if (!def) {
    throw new Error(`Definition not found: ${itemId}`);
  }

  const lane = state.lanes[def.lane];
  if (!lane) {
    throw new Error(`Lane not found: ${def.lane}`);
  }

  const workItem: WorkItem = {
    id: generateItemId(),
    itemId,
    status: 'pending',
    quantity,
    turnsRemaining: 0,
  };

  lane.pendingQueue.push(workItem);
}
