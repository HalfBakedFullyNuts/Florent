/**
 * Selectors - Read-only projections for UI
 * Pure functions that derive views from game state
 */

import type { PlanetState, LaneId, NetOutputs, ResourceId } from '../sim/engine/types';
import { computeNetOutputsPerTurn } from '../sim/engine/outputs';
import { computeGrowthBonus } from '../sim/engine/growth_food';
import { WORKER_GROWTH_BASE, FOOD_PER_WORKER } from '../sim/rules/constants';
import { canQueue } from '../sim/engine/validation';

export interface PlanetSummary {
  turn: number;
  stocks: Record<ResourceId, number>;
  abundance: Record<ResourceId, number>;
  outputsPerTurn: NetOutputs;
  space: {
    groundUsed: number;
    groundCap: number;
    orbitalUsed: number;
    orbitalCap: number;
  };
  housing: {
    workerCap: number;
    soldierCap: number;
    scientistCap: number;
  };
  population: {
    workersTotal: number;
    workersIdle: number;
    workersBusy: number;
    soldiers: number;
    scientists: number;
  };
  ships: Record<string, number>; // shipId -> count
  growthHint: string; // "+X workers at end of turn"
  foodUpkeep: number;
}

export interface LaneEntry {
  id: string;
  itemId: string;
  itemName: string;
  status: 'pending' | 'active' | 'completed';
  quantity: number;
  turnsRemaining: number;
  eta: number | null; // Turn number when it will complete, null if pending
}

export interface LaneView {
  laneId: LaneId;
  entries: LaneEntry[];
}

export type WarningType =
  | 'NEGATIVE_ENERGY'
  | 'NO_FOOD'
  | 'HOUSING_FULL'
  | 'SPACE_FULL';

export interface Warning {
  type: WarningType;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Get planet summary for specific turn
 */
export function getPlanetSummary(state: PlanetState): PlanetSummary {
  const outputs = computeNetOutputsPerTurn(state);

  // Calculate worker growth hint
  const growthBonus = computeGrowthBonus(state);
  const totalGrowthRate = WORKER_GROWTH_BASE + growthBonus;
  const projectedGrowth = state.stocks.food > 0
    ? Math.floor(state.population.workersTotal * totalGrowthRate)
    : 0;

  const growthHint = projectedGrowth > 0
    ? `+${projectedGrowth} workers at end of turn`
    : 'No growth (need food > 0)';

  // Calculate total busy workers
  const workersBusy = Object.values(state.population.busyByLane).reduce(
    (sum, count) => sum + (count || 0),
    0
  );

  // Calculate food upkeep
  const foodUpkeep = state.population.workersTotal * FOOD_PER_WORKER;

  // Extract ship counts from completedCounts
  const ships: Record<string, number> = {};
  Object.entries(state.completedCounts).forEach(([itemId, count]) => {
    const def = state.defs[itemId];
    if (def && def.type === 'ship' && count > 0) {
      ships[itemId] = count;
    }
  });

  return {
    turn: state.currentTurn,
    stocks: { ...state.stocks },
    abundance: { ...state.abundance },
    outputsPerTurn: outputs,
    space: { ...state.space },
    housing: { ...state.housing },
    population: {
      workersTotal: state.population.workersTotal,
      workersIdle: state.population.workersIdle,
      workersBusy,
      soldiers: state.population.soldiers,
      scientists: state.population.scientists,
    },
    ships,
    growthHint,
    foodUpkeep,
  };
}

/**
 * Get lane view for specific turn
 */
export function getLaneView(state: PlanetState, laneId: LaneId): LaneView {
  const lane = state.lanes[laneId];
  const entries: LaneEntry[] = [];

  // Add all pending entries from queue
  for (const pending of lane.pendingQueue) {
    const def = state.defs[pending.itemId];
    entries.push({
      id: pending.id,
      itemId: pending.itemId,
      itemName: def?.name || 'Unknown',
      status: 'pending',
      quantity: pending.quantity,
      turnsRemaining: pending.turnsRemaining,
      eta: null, // Pending, so no ETA yet
    });
  }

  // Add active entry
  if (lane.active) {
    const def = state.defs[lane.active.itemId];
    const eta = state.currentTurn + lane.active.turnsRemaining;
    entries.push({
      id: lane.active.id,
      itemId: lane.active.itemId,
      itemName: def?.name || 'Unknown',
      status: 'active',
      quantity: lane.active.quantity,
      turnsRemaining: lane.active.turnsRemaining,
      eta,
    });
  }

  return {
    laneId,
    entries,
  };
}

/**
 * Get warnings for specific turn
 */
export function getWarnings(state: PlanetState): Warning[] {
  const warnings: Warning[] = [];

  // Check for negative energy
  if (state.stocks.energy < 0) {
    warnings.push({
      type: 'NEGATIVE_ENERGY',
      message: 'Energy is negative! Production will be affected.',
      severity: 'error',
    });
  }

  // Check for no food
  if (state.stocks.food <= 0) {
    warnings.push({
      type: 'NO_FOOD',
      message: 'No food available. Worker growth is halted.',
      severity: 'warning',
    });
  }

  // Check for full housing
  const workerHousingUsage = state.population.workersTotal / state.housing.workerCap;
  if (workerHousingUsage >= 0.95) {
    warnings.push({
      type: 'HOUSING_FULL',
      message: 'Worker housing near capacity. Build more housing.',
      severity: 'warning',
    });
  }

  const soldierHousingUsage = state.population.soldiers / state.housing.soldierCap;
  if (soldierHousingUsage >= 0.95 && state.housing.soldierCap > 0) {
    warnings.push({
      type: 'HOUSING_FULL',
      message: 'Soldier housing near capacity.',
      severity: 'warning',
    });
  }

  const scientistHousingUsage = state.population.scientists / state.housing.scientistCap;
  if (scientistHousingUsage >= 0.95 && state.housing.scientistCap > 0) {
    warnings.push({
      type: 'HOUSING_FULL',
      message: 'Scientist housing near capacity.',
      severity: 'warning',
    });
  }

  // Check for full space
  const groundUsage = state.space.groundUsed / state.space.groundCap;
  if (groundUsage >= 0.95) {
    warnings.push({
      type: 'SPACE_FULL',
      message: 'Ground space near capacity.',
      severity: 'warning',
    });
  }

  const orbitalUsage = state.space.orbitalUsed / state.space.orbitalCap;
  if (orbitalUsage >= 0.95) {
    warnings.push({
      type: 'SPACE_FULL',
      message: 'Orbital space near capacity.',
      severity: 'warning',
    });
  }

  return warnings;
}

/**
 * Get all available item definitions that can be queued
 */
export function getAvailableItems(state: PlanetState): Record<string, any> {
  return state.defs;
}

/**
 * Check if an item can be queued (for UI validation)
 */
export function canQueueItem(
  state: PlanetState,
  itemId: string,
  quantity: number
): { allowed: boolean; reason?: string } {
  const def = state.defs[itemId];
  if (!def) {
    return { allowed: false, reason: 'Item not found' };
  }

  const lane = state.lanes[def.lane];

  // Check if lane has an active item (lane is busy)
  if (lane.active) {
    return { allowed: false, reason: 'Lane is busy' };
  }

  if (lane.pendingQueue.length >= lane.maxQueueDepth) {
    return { allowed: false, reason: 'Queue is full' };
  }

  // Use validation logic which checks prerequisites and energy
  return canQueue(state, def, quantity);
}
