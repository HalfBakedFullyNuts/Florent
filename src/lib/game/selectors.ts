/**
 * Selectors - Read-only projections for UI
 * Pure functions that derive views from game state
 */

import type { PlanetState, LaneId, NetOutputs, ResourceId } from '../sim/engine/types';
import { computeNetOutputsPerTurn, calculatePopulationFoodUpkeep } from '../sim/engine/outputs';
import { computeGrowthBonus } from '../sim/engine/growth_food';
import { WORKER_GROWTH_BASE } from '../sim/rules/constants';
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
  structures: Record<string, number>; // structureId -> count
  growthHint: string; // "+X workers at end of turn"
  foodUpkeep: number;
  planetLimit: number; // Maximum number of planets allowed
  completedResearch: string[]; // List of completed research IDs
}

export interface LaneEntry {
  id: string;
  itemId: string;
  itemName: string;
  status: 'pending' | 'active' | 'completed';
  quantity: number;
  turnsRemaining: number;
  eta: number | null; // Turn number when it will complete, null if pending
  queuedTurn?: number; // Turn when item was queued
  startTurn?: number; // Turn when work started
  completionTurn?: number; // Turn when work completed
  invalid?: boolean; // Whether this item is invalid (fails validation)
  invalidReason?: string; // Human-readable reason for invalidity
  missingPrereqs?: string[]; // List of missing prerequisites
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

  // Use engine's upkeep calculation for consistency
  const foodUpkeep = calculatePopulationFoodUpkeep(state);

  // Extract ship counts from completedCounts
  const ships: Record<string, number> = {};
  Object.entries(state.completedCounts).forEach(([itemId, count]) => {
    const def = state.defs[itemId];
    if (def && def.type === 'ship' && count > 0) {
      ships[itemId] = count;
    }
  });

  // Extract structure counts from completedCounts (single source of truth)
  const structures: Record<string, number> = {};

  Object.entries(state.completedCounts).forEach(([itemId, count]) => {
    const def = state.defs[itemId];
    if (def && def.type === 'structure' && count > 0) {
      structures[itemId] = count;
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
    structures,
    growthHint,
    foodUpkeep,
    planetLimit: state.planetLimit || 4,
    completedResearch: state.completedResearch || [],
  };
}

/**
 * Calculate turns until housing cap is reached
 * Returns null if no growth or already at/above cap
 *
 * TICKET-4: Housing Cap Warning
 */
export function getTurnsUntilHousingCap(
  state: PlanetState,
  _completionTurn?: number
): number | null {
  const { workersTotal } = state.population;
  const { housingCap } = state.space;

  // Already at or above cap
  if (workersTotal >= housingCap) {
    return null;
  }

  // No workers means no growth possible
  if (workersTotal === 0) {
    return null;
  }

  // Calculate growth rate
  const growthBonus = computeGrowthBonus(state);
  const totalGrowthRate = WORKER_GROWTH_BASE + growthBonus;

  // Calculate projected growth per turn
  const projectedGrowth = state.stocks.food > 0
    ? Math.floor(workersTotal * totalGrowthRate)
    : 0;

  // No growth
  if (projectedGrowth <= 0 || !isFinite(projectedGrowth)) {
    return null;
  }

  // Calculate turns to reach cap
  const workersNeeded = housingCap - workersTotal;
  const turnsToHousingCap = Math.ceil(workersNeeded / projectedGrowth);

  // Validate result
  if (!isFinite(turnsToHousingCap) || turnsToHousingCap <= 0) {
    return null;
  }

  return turnsToHousingCap;
}

/**
 * Get lane view for specific turn
 */
export function getLaneView(state: PlanetState, laneId: LaneId): LaneView {
  const lane = state.lanes[laneId];
  const entries: LaneEntry[] = [];

  // Add completed items from history (most recent first)
  for (const completed of [...lane.completionHistory].reverse()) {
    const def = state.defs[completed.itemId];
    entries.push({
      id: completed.id,
      itemId: completed.itemId,
      itemName: def?.name || 'Unknown',
      status: 'completed',
      quantity: completed.quantity,
      turnsRemaining: 0,
      eta: null, // Already completed
      queuedTurn: completed.queuedTurn,
      startTurn: completed.startTurn,
      completionTurn: completed.completionTurn,
    });
  }

  // Calculate the schedule starting point based on what's already scheduled
  let scheduleStart = 1; // Default to T1

  // Check if there are completed items to continue from
  if (lane.completionHistory.length > 0) {
    // Find the latest completion
    const lastCompleted = lane.completionHistory[lane.completionHistory.length - 1];
    if (lastCompleted.completionTurn) {
      scheduleStart = lastCompleted.completionTurn + 1;
    }
  }

  // If there's an active item, next slot starts after it completes
  if (lane.active) {
    // For active items, we know when they'll complete
    if (lane.active.completionTurn) {
      scheduleStart = lane.active.completionTurn + 1;
    } else {
      // Fall back to calculating based on current turn and remaining
      scheduleStart = state.currentTurn + lane.active.turnsRemaining;
    }
  }

  // Build continuous timeline for pending items
  for (let i = 0; i < lane.pendingQueue.length; i++) {
    const pending = lane.pendingQueue[i];
    const def = state.defs[pending.itemId];
    const duration = def?.durationTurns || 4;

    // Simple continuous scheduling: each item gets duration turns
    const displayStart = scheduleStart;
    const displayEnd = scheduleStart + duration - 1;

    entries.push({
      id: pending.id,
      itemId: pending.itemId,
      itemName: def?.name || 'Unknown',
      status: 'pending',
      quantity: pending.quantity,
      turnsRemaining: pending.turnsRemaining,
      eta: displayEnd,
      queuedTurn: pending.queuedTurn, // Preserve actual queue turn for cancellation
      startTurn: displayStart,
      completionTurn: displayEnd,
    });

    // Next item starts immediately after this one completes
    scheduleStart = displayEnd + 1;
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
      queuedTurn: lane.active.queuedTurn,
      startTurn: lane.active.startTurn,
      completionTurn: lane.active.completionTurn,
    });
  }

  // Reverse the entire array so latest activity appears at top
  entries.reverse();

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
