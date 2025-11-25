/**
 * Validation primitives for queue operations
 * Implements static queue guards and dynamic batch clamping
 */

import type { PlanetState, ItemDefinition, CanQueueResult } from './types';
import { computeNetOutputsPerTurn } from './outputs';

/**
 * Check if prerequisites are met for queuing an item
 * Checks completed structures, queued/active items, AND completed research
 */
export function hasPrereqs(state: PlanetState, def: ItemDefinition): boolean {
  if (!def.prerequisites || def.prerequisites.length === 0) {
    return true;
  }

  for (const prereqId of def.prerequisites) {
    // Check completed research first (for research items)
    if (state.completedResearch && state.completedResearch.includes(prereqId)) {
      continue; // Prerequisite met via completed research
    }

    // Check completed counts (for structures/units)
    const completedCount = state.completedCounts[prereqId] || 0;
    if (completedCount > 0) {
      continue; // Prerequisite met via completed structures
    }

    // Check all lanes for queued or active items (including research)
    const allLanes = [
      state.lanes.building,
      state.lanes.ship,
      state.lanes.colonist,
      state.lanes.research
    ];
    let foundInLane = false;

    for (const lane of allLanes) {
      // Check active item
      if (lane.active?.itemId === prereqId) {
        foundInLane = true;
        break;
      }

      // Check pending queue
      if (lane.pendingQueue.some(item => item.itemId === prereqId)) {
        foundInLane = true;
        break;
      }
    }

    if (foundInLane) {
      continue; // Prerequisite met via queued or active item
    }

    // Prerequisite not found anywhere
    return false;
  }

  return true;
}

/**
 * Check if housing exists for colonist at activation time
 */
export function housingExistsForColonist(
  state: PlanetState,
  def: ItemDefinition,
  qty: number
): boolean {
  if (!def.colonistKind) {
    return true; // Not a colonist, no housing check needed
  }

  if (def.colonistKind === 'soldier') {
    const availableCapacity = state.housing.soldierCap - state.population.soldiers;
    return availableCapacity >= qty;
  }

  if (def.colonistKind === 'scientist') {
    const availableCapacity = state.housing.scientistCap - state.population.scientists;
    return availableCapacity >= qty;
  }

  return true;
}

/**
 * Check if building has reached its planet limit
 * Only applies to buildings with maxPerPlanet set
 */
export function isPlanetLimitReached(
  state: PlanetState,
  def: ItemDefinition
): boolean {
  // If no limit is set, always allow
  if (def.maxPerPlanet === null || def.maxPerPlanet === undefined) {
    return false;
  }

  // Only applies to building lane items
  if (def.lane !== 'building') {
    return false;
  }

  // Count total instances of this item
  let totalCount = 0;

  // Count completed buildings
  totalCount += state.completedCounts[def.id] || 0;

  // Count active building in building lane
  if (state.lanes.building.active?.itemId === def.id) {
    totalCount += state.lanes.building.active.quantity;
  }

  // Count pending buildings in building lane
  for (const item of state.lanes.building.pendingQueue) {
    if (item.itemId === def.id) {
      totalCount += item.quantity;
    }
  }

  // Check if limit is reached
  return totalCount >= def.maxPerPlanet;
}

/**
 * Forward check: ensure energy output per turn won't go negative after completion
 */
export function energyNonNegativeAfterCompletion(
  state: PlanetState,
  def: ItemDefinition,
  qty: number
): boolean {
  const energyUpkeep = def.upkeepPerUnit?.energy || 0;
  if (energyUpkeep === 0) {
    return true; // No energy upkeep, always safe
  }

  // Calculate total energy upkeep after completion
  const totalNewUpkeep = energyUpkeep * qty;

  // Get current net energy output per turn
  const currentOutputs = computeNetOutputsPerTurn(state);
  const currentEnergyOutput = currentOutputs.energy;

  // Check if net energy output will remain non-negative
  // Allow exactly 0 to permit building the first energy-consuming structure
  return currentEnergyOutput - totalNewUpkeep >= 0;
}

/**
 * Static validation: can we queue this item?
 * Checks prerequisites, planet limits, housing, and energy forward-check
 */
export function canQueue(
  state: PlanetState,
  def: ItemDefinition,
  requestedQty: number
): CanQueueResult {
  // Check prerequisites
  if (!hasPrereqs(state, def)) {
    return { allowed: false, reason: 'REQ_MISSING' };
  }

  // Check planet limit for unique buildings
  if (isPlanetLimitReached(state, def)) {
    return { allowed: false, reason: 'PLANET_LIMIT_REACHED' };
  }

  // Check housing for colonists
  if (def.colonistKind && !housingExistsForColonist(state, def, requestedQty)) {
    return { allowed: false, reason: 'HOUSING_MISSING' };
  }

  // Check energy forward-check
  if (!energyNonNegativeAfterCompletion(state, def, requestedQty)) {
    return { allowed: false, reason: 'ENERGY_INSUFFICIENT' };
  }

  return { allowed: true };
}

/**
 * Dynamic validation: clamp batch size at activation based on available resources
 * Returns clamped quantity (0 means keep pending)
 */
export function clampBatchAtActivation(
  state: PlanetState,
  def: ItemDefinition,
  requested: number
): number {
  let maxAffordable = requested;

  // Check resource constraints
  const costs = def.costsPerUnit;
  if (costs.metal > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.metal / costs.metal));
  }
  if (costs.mineral > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.mineral / costs.mineral));
  }
  if (costs.food > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.food / costs.food));
  }
  if (costs.energy > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.energy / costs.energy));
  }

  // Check worker constraints
  const workersNeeded = def.costsPerUnit.workers || 0;
  if (workersNeeded > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.population.workersIdle / workersNeeded));
  }

  // Check space constraints
  const spaceNeeded = def.costsPerUnit.space || 0;
  if (spaceNeeded > 0) {
    const spaceType = def.type === 'structure' ? 'ground' : 'orbital';
    const availableSpace =
      spaceType === 'ground'
        ? state.space.groundCap - state.space.groundUsed
        : state.space.orbitalCap - state.space.orbitalUsed;
    maxAffordable = Math.min(maxAffordable, Math.floor(availableSpace / spaceNeeded));
  }

  // Clamp to 0 if we can't afford anything
  return Math.max(0, maxAffordable);
}
