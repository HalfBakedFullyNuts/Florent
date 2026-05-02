/**
 * Validation primitives for queue operations
 * Implements static queue guards and dynamic batch clamping
 */

import type { PlanetState, ItemDefinition, CanQueueResult } from './types';
import { computeNetOutputsPerTurn, computeProjectedNetOutputsPerTurn } from './outputs';

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
 * Projects future housing capacity by scanning the queue
 */
export function housingExistsForColonist(
  state: PlanetState,
  def: ItemDefinition,
  qty: number
): boolean {
  if (!def.colonistKind) {
    return true; // Not a colonist, no housing check needed
  }

  // Calculate future housing capacity from queued buildings
  let futureSoldierCap = state.housing.soldierCap;
  let futureScientistCap = state.housing.scientistCap;

  const queuedBuildings = [
    ...(state.lanes.building.active ? [state.lanes.building.active] : []),
    ...state.lanes.building.pendingQueue
  ];

  for (const item of queuedBuildings) {
    const itemDef = state.defs[item.itemId];
    const effects = itemDef?.effectsOnComplete;
    if (effects) {
      if (effects.housing_soldier_cap) {
        futureSoldierCap += effects.housing_soldier_cap * item.quantity;
      }
      if (effects.housing_scientist_cap) {
        futureScientistCap += effects.housing_scientist_cap * item.quantity;
      }
    }
  }

  // Calculate future population from queued colonists
  let futureSoldiers = state.population.soldiers;
  let futureScientists = state.population.scientists;

  const queuedColonists = [
    ...(state.lanes.colonist.active ? [state.lanes.colonist.active] : []),
    ...state.lanes.colonist.pendingQueue
  ];

  for (const item of queuedColonists) {
    const itemDef = state.defs[item.itemId];
    if (itemDef?.colonistKind === 'soldier') futureSoldiers += item.quantity;
    if (itemDef?.colonistKind === 'scientist') futureScientists += item.quantity;
  }

  if (def.colonistKind === 'soldier') {
    return futureSoldierCap - futureSoldiers >= qty;
  }

  if (def.colonistKind === 'scientist') {
    return futureScientistCap - futureScientists >= qty;
  }

  return true;
}

/**
 * Check if a unique item has already been built, researched, or is in the queue.
 * Applies to any lane: building, research, ship, colonist.
 * Returns false immediately for non-unique items.
 */
export function isUniqueLimitReached(
  state: PlanetState,
  def: ItemDefinition
): boolean {
  // Non-unique items are always allowed
  if (!def.unique) {
    return false;
  }

  // For research lane: also check completedResearch list
  if (def.lane === 'research' && state.completedResearch?.includes(def.id)) {
    return true;
  }

  // Check completed counts (covers buildings, units, etc.)
  if ((state.completedCounts[def.id] || 0) >= 1) {
    return true;
  }

  // Check the item's own lane — active slot and pending queue
  const lane = state.lanes[def.lane];
  if (!lane) return false;

  if (lane.active?.itemId === def.id) {
    return true;
  }

  for (const item of lane.pendingQueue) {
    if (item.itemId === def.id) {
      return true;
    }
  }

  return false;
}

/**
 * @deprecated Use isUniqueLimitReached instead.
 * Kept as alias to avoid breaking test files that reference old name.
 */
export const isPlanetLimitReached = isUniqueLimitReached;

/**
 * Forward check: ensure energy output per turn won't go negative after completion
 * Projects future energy output by scanning the queue
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

  // Get current net energy output per turn
  const currentOutputs = computeNetOutputsPerTurn(state);
  let futureEnergyOutput = currentOutputs.energy;

  // Calculate net change in energy output from queued items
  const allLanes = [
    state.lanes.building,
    state.lanes.ship,
    state.lanes.colonist,
    state.lanes.research
  ];

  for (const lane of allLanes) {
    const queuedItems = [
      ...(lane.active ? [lane.active] : []),
      ...lane.pendingQueue
    ];

    for (const item of queuedItems) {
      const itemDef = state.defs[item.itemId];
      if (!itemDef) continue;
      
      // Add future production
      if (itemDef.effectsOnComplete?.production_energy) {
        const production = itemDef.effectsOnComplete.production_energy;
        const scaledProduction = itemDef.isAbundanceScaled
            ? production * state.abundance.energy
            : production;
        futureEnergyOutput += scaledProduction * item.quantity;
      }

      // Subtract future upkeep
      if (itemDef.upkeepPerUnit?.energy) {
         futureEnergyOutput -= itemDef.upkeepPerUnit.energy * item.quantity;
      }
    }
  }

  // Calculate total energy upkeep after completion of the requested item
  const totalNewUpkeep = energyUpkeep * qty;

  // Allow exactly 0 to permit building the first energy-consuming structure
  return futureEnergyOutput - totalNewUpkeep >= 0;
}

/**
 * Resource feasibility under activation-time pricing.
 * A queue is allowed when the costs are reachable from
 * current stocks + future net production (positive lanes).
 * Returns true if the resource can be accumulated, false otherwise.
 */
function resourcesFeasible(
  state: PlanetState,
  def: ItemDefinition,
  qty: number
): boolean {
  const c = def.costsPerUnit;
  // Use projected production so queued scientists/buildings unblock research queuing
  const net = computeProjectedNetOutputsPerTurn(state);
  const required: Record<string, number> = {
    metal: (c.metal || 0) * qty,
    mineral: (c.mineral || 0) * qty,
    food: (c.food || 0) * qty,
    energy: (c.energy || 0) * qty,
    research_points: (c.research_points || 0) * qty,
  };
  for (const r of ['metal', 'mineral', 'food', 'energy', 'research_points'] as const) {
    const need = required[r];
    if (need <= 0) continue;
    const have = state.stocks[r] || 0;
    if (need <= have) continue;
    // Need to accumulate. Net production must be positive.
    if ((net[r] || 0) <= 0) return false;
  }
  return true;
}

/**
 * Static validation: can we queue this item?
 * Activation-time pricing model:
 *   - prereqs must exist OR be queued (so they will land before this item runs)
 *   - planet limit not exceeded
 *   - housing reachable (colonists)
 *   - energy projection is a HARD per-planet block
 *   - resources need not be sufficient NOW; only reachable via net production
 */
export function canQueue(
  state: PlanetState,
  def: ItemDefinition,
  requestedQty: number
): CanQueueResult {
  if (!hasPrereqs(state, def)) {
    return { allowed: false, reason: 'REQ_MISSING' };
  }
  if (isUniqueLimitReached(state, def)) {
    return { allowed: false, reason: 'PLANET_LIMIT_REACHED' };
  }
  if (def.colonistKind && !housingExistsForColonist(state, def, requestedQty)) {
    return { allowed: false, reason: 'HOUSING_MISSING' };
  }
  if (!energyNonNegativeAfterCompletion(state, def, requestedQty)) {
    return { allowed: false, reason: 'ENERGY_INSUFFICIENT' };
  }
  if (!resourcesFeasible(state, def, requestedQty)) {
    return { allowed: false, reason: 'INSUFFICIENT_RESOURCES' };
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

  // Check if prerequisites are ACTUALLY completed
  if (def.prerequisites && def.prerequisites.length > 0) {
    for (const prereqId of def.prerequisites) {
      if (!state.completedResearch?.includes(prereqId) && (state.completedCounts[prereqId] || 0) <= 0) {
        return 0; // Prerequisite not yet built, stall queue
      }
    }
  }

  // Check if housing is CURRENTLY available
  if (def.colonistKind) {
    if (def.colonistKind === 'soldier') {
      const availableCapacity = state.housing.soldierCap - state.population.soldiers;
      maxAffordable = Math.min(maxAffordable, availableCapacity);
    } else if (def.colonistKind === 'scientist') {
      const availableCapacity = state.housing.scientistCap - state.population.scientists;
      maxAffordable = Math.min(maxAffordable, availableCapacity);
    }
  }

  // Resources are deducted at activation time, so the live stocks bound the batch.
  // Whichever resource is scarcest determines the affordable count.
  const c = def.costsPerUnit;
  if ((c.metal || 0) > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.metal / c.metal));
  }
  if ((c.mineral || 0) > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.mineral / c.mineral));
  }
  if ((c.food || 0) > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.food / c.food));
  }
  if ((c.energy || 0) > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.energy / c.energy));
  }
  if ((c.research_points || 0) > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.stocks.research_points / c.research_points));
  }

  // Check worker constraints
  const workersNeeded = def.costsPerUnit.workers || 0;
  if (workersNeeded > 0) {
    maxAffordable = Math.min(maxAffordable, Math.floor(state.population.workersIdle / workersNeeded));
  }

  // Check space constraints — only structures consume space
  if (def.type === 'structure') {
    const groundNeeded = def.costsPerUnit.space || 0;
    if (groundNeeded > 0) {
      const availableGround = state.space.groundCap - state.space.groundUsed;
      maxAffordable = Math.min(maxAffordable, Math.floor(availableGround / groundNeeded));
    }
    const orbitalNeeded = def.costsPerUnit.space_orbital || 0;
    if (orbitalNeeded > 0) {
      const availableOrbital = state.space.orbitalCap - state.space.orbitalUsed;
      maxAffordable = Math.min(maxAffordable, Math.floor(availableOrbital / orbitalNeeded));
    }
  }

  // Clamp to 0 if we can't afford anything
  return Math.max(0, maxAffordable);
}
