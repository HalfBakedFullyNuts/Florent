/**
 * Selectors - Read-only projections for UI
 * Pure functions that derive views from game state
 */

import type { PlanetState, LaneId, NetOutputs, ResourceId, WorkItem } from '../sim/engine/types';
import { computeNetOutputsPerTurn, calculatePopulationFoodUpkeep, computeProjectedNetOutputsPerTurn } from '../sim/engine/outputs';
import { computeGrowthBonus } from '../sim/engine/growth_food';
import { WORKER_GROWTH_BASE } from '../sim/rules/constants';
import { validateQueueWithWait, type QueueBlocker } from '../sim/engine/queueValidation';

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
  minStartTurn?: number; // Earliest world turn this item may activate
  invalid?: boolean; // Whether this item is invalid (fails validation)
  invalidReason?: string; // Human-readable reason for invalidity
  missingPrereqs?: string[]; // List of missing prerequisites
  isWait?: boolean; // True for wait items
  isAutoWait?: boolean; // True for auto-inserted wait items
}

export interface LaneView {
  laneId: LaneId;
  entries: LaneEntry[];
}

export type WarningType =
  | 'NEGATIVE_ENERGY'
  | 'NO_FOOD'
  | 'HOUSING_FULL'
  | 'SPACE_FULL'
  | 'QUEUE_CASCADE_REMOVAL';

export interface Warning {
  type: WarningType;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Enriched queue availability result returned by canQueueItem.
 * Consumers should grey out ONLY when canQueueEventually === false.
 * When canQueueNow === false but canQueueEventually === true, show delay info.
 */
export interface SmartQueueCheck {
  allowed: boolean;            // Can queue and activate now
  canQueueEventually: boolean; // Can queue; item will activate after a wait
  waitTurnsNeeded: number;     // Estimated turns until item can activate (0 = now)
  blockers: QueueBlocker[];    // Detailed blocker list from validateQueueWithWait
  reason?: string;             // Human-readable reason for hard block
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
    minStartTurn: item.minStartTurn,
    isWait: item.isWait,
    isAutoWait: item.isAutoWait,
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
  const entries: Array<{ entry: LaneEntry; order: number }> = [];
  let order = 0;
  const addEntry = (entry: LaneEntry) => {
    entries.push({ entry, order: order++ });
  };

  // Add completed items in history order. The final sort below keeps the
  // selector contract chronological even when callers pass simulated snapshots.
  for (const completed of lane.completionHistory) {
    addEntry(workItemToLaneEntry(completed, state.defs, 'completed'));
  }

  // Build timeline for pending items
  let scheduleStart = calculateScheduleStart(lane, state.currentTurn);

  for (const pending of lane.pendingQueue) {
    const def = state.defs[pending.itemId];
    const duration = pending.isWait ? pending.turnsRemaining : (def?.durationTurns || 4);
    const displayStart = Math.max(scheduleStart, pending.minStartTurn ?? scheduleStart);
    const displayEnd = displayStart + duration - 1;

    addEntry(workItemToLaneEntry(pending, state.defs, 'pending', {
      eta: displayEnd,
      startTurn: displayStart,
      completionTurn: displayEnd,
    }));

    scheduleStart = displayEnd + 1;
  }

  // Add active entry
  if (lane.active) {
    const eta = state.currentTurn + lane.active.turnsRemaining;
    addEntry(workItemToLaneEntry(lane.active, state.defs, 'active', { eta }));
  }

  entries.sort((a, b) => {
    const finishA = a.entry.completionTurn ?? a.entry.eta ?? Number.MAX_SAFE_INTEGER;
    const finishB = b.entry.completionTurn ?? b.entry.eta ?? Number.MAX_SAFE_INTEGER;
    if (finishA !== finishB) return finishA - finishB;

    const startA = a.entry.startTurn ?? a.entry.queuedTurn ?? finishA;
    const startB = b.entry.startTurn ?? b.entry.queuedTurn ?? finishB;
    if (startA !== startB) return startA - startB;

    return a.order - b.order;
  });

  return { laneId, entries: entries.map(({ entry }) => entry) };
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
 * Calculate the first turn when a lane will have its slot free.
 * Uses the simple formula: sum of active + all pending durations.
 * Returns currentTurn if the lane is already empty.
 */
export function getFirstFreeTurnForLane(state: PlanetState, laneId: LaneId): number {
  const lane = state.lanes[laneId];
  if (!lane) return state.currentTurn;

  // Empty lane: free immediately
  if (!lane.active && lane.pendingQueue.length === 0) {
    return state.currentTurn;
  }

  // Walk forward: active remaining + pending durations
  let turnCursor = state.currentTurn;

  if (lane.active) {
    turnCursor += lane.active.turnsRemaining;
  }

  for (const item of lane.pendingQueue) {
    const def = state.defs[item.itemId];
    turnCursor += item.isWait ? item.turnsRemaining : (def?.durationTurns || 0);
  }

  return turnCursor;
}

/**
 * Calculate the first turn when the research lane has enough RP to run something.
 * Returns currentTurn if RP are already available or being produced.
 * Falls back to colonist queue scan if no scientists exist yet.
 */
export function getFirstFreeTurnForResearch(state: PlanetState): number {
  // If there's already RP or positive production, research can start now
  const projected = computeProjectedNetOutputsPerTurn(state);
  if (state.stocks.research_points > 0 || projected.research_points > 0) {
    return getFirstFreeTurnForLane(state, 'research');
  }

  // No RP production — check if scientists are queued in the colonist lane
  const colonistLane = state.lanes.colonist;
  const queuedItems = [
    ...(colonistLane.active ? [colonistLane.active] : []),
    ...colonistLane.pendingQueue,
  ];

  let turnCursor = state.currentTurn;
  for (const item of queuedItems) {
    const def = state.defs[item.itemId];
    if (def?.colonistKind === 'scientist') {
      // Scientists will produce RP one turn after they complete conversion
      const conversionTurn = turnCursor + (item.isWait ? item.turnsRemaining : (def?.durationTurns || 0));
      return Math.max(conversionTurn + 1, getFirstFreeTurnForLane(state, 'research'));
    }
    turnCursor += item.isWait ? item.turnsRemaining : (def?.durationTurns || 0);
  }

  // No scientists in queue — research cannot start (hard block path)
  return state.currentTurn;
}

/**
 * Map a QueueBlocker type back to the legacy CanQueueReason code.
 * This keeps TabbedItemGrid.humanizeReason and existing tests working.
 */
function blockerTypeToReasonCode(blockers: QueueBlocker[]): string | undefined {
  if (blockers.length === 0) return undefined;
  switch (blockers[0].type) {
    case 'PREREQUISITE': return 'REQ_MISSING';
    case 'PLANET_LIMIT': return 'PLANET_LIMIT_REACHED';
    case 'HOUSING': return 'HOUSING_MISSING';
    case 'ENERGY': return 'ENERGY_INSUFFICIENT';
    case 'RESOURCES': return 'INSUFFICIENT_RESOURCES';
    default: return blockers[0].message;
  }
}

/**
 * Smart queue availability check using first-free-turn validation.
 * Returns enriched SmartQueueCheck instead of a bare { allowed, reason }.
 * Grey out ONLY when canQueueEventually === false (hard block).
 * When canQueueNow === false but canQueueEventually === true, show wait info.
 */
export function canQueueItem(
  state: PlanetState,
  itemId: string,
  quantity: number
): SmartQueueCheck {
  const def = state.defs[itemId];
  if (!def) {
    return { allowed: false, canQueueEventually: false, waitTurnsNeeded: 0, blockers: [], reason: 'Item not found' };
  }

  // Run the full enriched validation on the current state.
  // The caller (page.tsx) is responsible for passing the state at the correct
  // first-free turn so that the validation context matches when the item would activate.
  const result = validateQueueWithWait(state, def, quantity);

  // Map blocker type back to a legacy reason code so humanizeReason() in TabbedItemGrid
  // continues to produce the right UI messages (it switches on the code, not the raw string).
  const reasonCode = blockerTypeToReasonCode(result.blockers);

  return {
    allowed: result.canQueueNow,
    canQueueEventually: result.canQueueEventually,
    waitTurnsNeeded: result.waitTurnsNeeded,
    blockers: result.blockers,
    reason: reasonCode,
  };
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
