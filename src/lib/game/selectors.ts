/**
 * Selectors - Read-only projections for UI
 * Pure functions that derive views from game state
 */

import type { PlanetState, LaneId, NetOutputs, ResourceId, WorkItem } from '../sim/engine/types';
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
 * Calculate projected worker growth for a given population count.
 * Returns 0 if no food available or growth rate is invalid.
 */
function calculateProjectedGrowth(state: PlanetState, workerCount: number): number {
  if (!state.stocks || state.stocks.food <= 0) {
    return 0;
  }
  const growthBonus = computeGrowthBonus(state);
  const totalGrowthRate = WORKER_GROWTH_BASE + growthBonus;
  return Math.floor(workerCount * totalGrowthRate);
}

/**
 * Calculate worker growth hint based on current food and population.
 * Returns a human-readable string describing expected growth.
 */
function calculateGrowthHint(state: PlanetState): string {
  if (!state.stocks || !state.population) {
    return 'No growth data available';
  }
  if (state.population.workersTotal < 0) {
    console.error('calculateGrowthHint: negative worker count');
    return 'Invalid population';
  }

  const projectedGrowth = calculateProjectedGrowth(state, state.population.workersTotal);

  return projectedGrowth > 0
    ? `+${projectedGrowth} workers at end of turn`
    : 'No growth (need food > 0)';
}

/**
 * Extract counts of completed items by type from completedCounts.
 * Filters state.completedCounts to return only items matching the given type.
 */
function extractCompletedByType(
  state: PlanetState,
  type: 'ship' | 'structure'
): Record<string, number> {
  if (!state.completedCounts) {
    return {};
  }
  if (!state.defs) {
    console.error('extractCompletedByType: missing defs');
    return {};
  }

  const result: Record<string, number> = {};
  Object.entries(state.completedCounts).forEach(([itemId, count]) => {
    const def = state.defs[itemId];
    if (def && def.type === type && count > 0) {
      result[itemId] = count;
    }
  });
  return result;
}

/**
 * Get planet summary for specific turn.
 * Aggregates all relevant state into a UI-friendly summary object.
 */
export function getPlanetSummary(state: PlanetState): PlanetSummary {
  if (!state) {
    throw new Error('PlanetState is required');
  }

  const outputs = computeNetOutputsPerTurn(state);
  const growthHint = calculateGrowthHint(state);
  const foodUpkeep = calculatePopulationFoodUpkeep(state);

  const workersBusy = Object.values(state.population.busyByLane).reduce(
    (sum, count) => sum + (count || 0),
    0
  );

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
    ships: extractCompletedByType(state, 'ship'),
    structures: extractCompletedByType(state, 'structure'),
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
  const { workerCap } = state.housing;

  // Already at or above cap
  if (workersTotal >= workerCap) {
    return null;
  }

  // No workers means no growth possible
  if (workersTotal === 0) {
    return null;
  }

  // Calculate projected growth per turn using shared helper
  const projectedGrowth = calculateProjectedGrowth(state, workersTotal);

  // No growth
  if (projectedGrowth <= 0 || !isFinite(projectedGrowth)) {
    return null;
  }

  // Calculate turns to reach cap
  const workersNeeded = workerCap - workersTotal;
  const turnsToHousingCap = Math.ceil(workersNeeded / projectedGrowth);

  // Validate result
  if (!isFinite(turnsToHousingCap) || turnsToHousingCap <= 0) {
    return null;
  }

  return turnsToHousingCap;
}

/**
 * Convert a WorkItem to a LaneEntry for display.
 * Handles both wait items and normal items with appropriate naming.
 */
function workItemToLaneEntry(
  item: WorkItem,
  defs: PlanetState['defs'],
  status: 'pending' | 'active' | 'completed',
  overrides?: Partial<LaneEntry>
): LaneEntry {
  if (!item || !item.id) {
    console.error('workItemToLaneEntry: invalid item');
    return {
      id: 'error',
      itemId: 'unknown',
      itemName: 'Error',
      status,
      quantity: 0,
      turnsRemaining: 0,
      eta: null,
    };
  }

  const def = defs[item.itemId];
  const itemName = item.isWait ? 'Wait' : (def?.name || 'Unknown');

  return {
    id: item.id,
    itemId: item.itemId,
    itemName,
    status,
    quantity: item.quantity,
    turnsRemaining: item.turnsRemaining,
    eta: overrides?.eta ?? null,
    queuedTurn: item.queuedTurn,
    startTurn: overrides?.startTurn ?? item.startTurn,
    completionTurn: overrides?.completionTurn ?? item.completionTurn,
  };
}

/**
 * Calculate the schedule start turn for pending items.
 * Based on last completion or active item completion time.
 */
function calculateScheduleStart(
  lane: PlanetState['lanes'][LaneId],
  currentTurn: number
): number {
  if (!lane) {
    console.error('calculateScheduleStart: lane is required');
    return 1;
  }
  if (currentTurn < 0) {
    console.error('calculateScheduleStart: currentTurn must be non-negative');
    return 1;
  }

  let scheduleStart = 1;

  if (lane.completionHistory && lane.completionHistory.length > 0) {
    const lastCompleted = lane.completionHistory[lane.completionHistory.length - 1];
    if (lastCompleted.completionTurn) {
      scheduleStart = lastCompleted.completionTurn + 1;
    }
  }

  if (lane.active) {
    scheduleStart = lane.active.completionTurn
      ? lane.active.completionTurn + 1
      : currentTurn + lane.active.turnsRemaining;
  }

  return scheduleStart;
}

/**
 * Get lane view for specific turn.
 * Builds a display-ready list of entries from completed, active, and pending items.
 */
export function getLaneView(state: PlanetState, laneId: LaneId): LaneView {
  if (!state || !state.lanes[laneId]) {
    return { laneId, entries: [] };
  }

  const lane = state.lanes[laneId];
  const entries: LaneEntry[] = [];

  // Add completed items (most recent first)
  for (const completed of [...lane.completionHistory].reverse()) {
    entries.push(workItemToLaneEntry(completed, state.defs, 'completed'));
  }

  // Build timeline for pending items
  let scheduleStart = calculateScheduleStart(lane, state.currentTurn);

  for (const pending of lane.pendingQueue) {
    const def = state.defs[pending.itemId];
    const duration = pending.isWait ? pending.turnsRemaining : (def?.durationTurns || 4);
    const displayEnd = scheduleStart + duration - 1;

    entries.push(workItemToLaneEntry(pending, state.defs, 'pending', {
      eta: displayEnd,
      startTurn: scheduleStart,
      completionTurn: displayEnd,
    }));

    scheduleStart = displayEnd + 1;
  }

  // Add active entry
  if (lane.active) {
    const eta = state.currentTurn + lane.active.turnsRemaining;
    entries.push(workItemToLaneEntry(lane.active, state.defs, 'active', { eta }));
  }

  entries.reverse();
  return { laneId, entries };
}

/** Threshold for capacity warnings (95%). */
const CAPACITY_WARNING_THRESHOLD = 0.95;

/**
 * Check if usage ratio exceeds warning threshold.
 * Returns false if capacity is zero to avoid division errors.
 */
function isNearCapacity(used: number, cap: number): boolean {
  if (cap <= 0) return false;
  return used / cap >= CAPACITY_WARNING_THRESHOLD;
}

/**
 * Check housing capacity for all population types.
 * Returns warnings for any housing type near capacity.
 */
function checkHousingWarnings(state: PlanetState): Warning[] {
  if (!state.population || !state.housing) {
    console.error('checkHousingWarnings: missing population or housing data');
    return [];
  }

  const warnings: Warning[] = [];
  const { population, housing } = state;

  if (isNearCapacity(population.workersTotal, housing.workerCap)) {
    warnings.push({
      type: 'HOUSING_FULL',
      message: 'Worker housing near capacity. Build more housing.',
      severity: 'warning',
    });
  }

  if (isNearCapacity(population.soldiers, housing.soldierCap)) {
    warnings.push({
      type: 'HOUSING_FULL',
      message: 'Soldier housing near capacity.',
      severity: 'warning',
    });
  }

  if (isNearCapacity(population.scientists, housing.scientistCap)) {
    warnings.push({
      type: 'HOUSING_FULL',
      message: 'Scientist housing near capacity.',
      severity: 'warning',
    });
  }

  return warnings;
}

/**
 * Get warnings for specific turn.
 * Checks resources, housing, and space capacity.
 */
export function getWarnings(state: PlanetState): Warning[] {
  if (!state) return [];

  const warnings: Warning[] = [];

  if (state.stocks.energy < 0) {
    warnings.push({
      type: 'NEGATIVE_ENERGY',
      message: 'Energy is negative! Production will be affected.',
      severity: 'error',
    });
  }

  if (state.stocks.food <= 0) {
    warnings.push({
      type: 'NO_FOOD',
      message: 'No food available. Worker growth is halted.',
      severity: 'warning',
    });
  }

  warnings.push(...checkHousingWarnings(state));

  if (isNearCapacity(state.space.groundUsed, state.space.groundCap)) {
    warnings.push({
      type: 'SPACE_FULL',
      message: 'Ground space near capacity.',
      severity: 'warning',
    });
  }

  if (isNearCapacity(state.space.orbitalUsed, state.space.orbitalCap)) {
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

/**
 * Check if a lane is empty (no active or pending items)
 */
export function isLaneEmpty(state: PlanetState, laneId: LaneId): boolean {
  const lane = state.lanes[laneId];
  return !lane.active && lane.pendingQueue.length === 0;
}

/**
 * Find the first turn where a specific lane becomes empty
 * Returns null if no lane activity at all, or current turn if already empty
 */
export function getFirstEmptyTurnForLane(
  getStateAtTurn: (turn: number) => PlanetState | undefined,
  laneId: LaneId,
  currentTurn: number,
  maxTurn: number
): number | null {
  // Check current turn first - if lane is already empty, return current turn
  const currentState = getStateAtTurn(currentTurn);
  if (!currentState) return null;

  const currentLane = currentState.lanes[laneId];
  if (!currentLane.active && currentLane.pendingQueue.length === 0) {
    // Already empty at current turn
    return currentTurn;
  }

  // Lane has work - find when it becomes empty
  // Binary search would be faster but linear is simpler and max 200 turns
  const MAX_ITERATIONS = 200;
  let iterations = 0;

  for (let turn = currentTurn + 1; turn <= maxTurn && iterations < MAX_ITERATIONS; turn++) {
    iterations++;
    const state = getStateAtTurn(turn);
    if (!state) continue;

    const lane = state.lanes[laneId];
    if (!lane.active && lane.pendingQueue.length === 0) {
      return turn;
    }
  }

  // Lane never becomes empty within simulation range
  return null;
}

export interface FirstEmptyTurns {
  building: number | null;
  ship: number | null;
  colonist: number | null;
}

/**
 * Get first empty turn for all three production lanes
 */
export function getFirstEmptyTurns(
  getStateAtTurn: (turn: number) => PlanetState | undefined,
  currentTurn: number,
  maxTurn: number
): FirstEmptyTurns {
  return {
    building: getFirstEmptyTurnForLane(getStateAtTurn, 'building', currentTurn, maxTurn),
    ship: getFirstEmptyTurnForLane(getStateAtTurn, 'ship', currentTurn, maxTurn),
    colonist: getFirstEmptyTurnForLane(getStateAtTurn, 'colonist', currentTurn, maxTurn),
  };
}
