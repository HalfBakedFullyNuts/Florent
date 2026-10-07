/**
 * Resource output calculations with abundance scaling
 */

import type { PlanetState, NetOutputs } from './types';
import { getDefs } from './defsRegistry';
import { RESOURCE_TYPES, FOOD_PER_WORKER } from '../rules/constants';

/**
 * Compute per-turn production minus structure upkeep for all completed items.
 * Does NOT include population food upkeep — callers add that separately
 * (see computeNetOutputsPerTurn) so it always reflects the CURRENT population.
 */
export function computeProductionPerTurn(state: PlanetState): NetOutputs {
  const netOutputs: NetOutputs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
    research_points: 0,
  };

  // Iterate through all completed items in CANONICAL (sorted) order.
  // Iteration order must not depend on key insertion history (demolish deletes
  // zero-count entries; rebuilds re-append them), otherwise float summation
  // order changes and logically identical planets diverge over time.
  const completedIds = Object.keys(state.completedCounts).sort();
  for (const itemId of completedIds) {
    const count = state.completedCounts[itemId];
    if (count === 0) continue;

    const def = getDefs()[itemId];
    if (!def) continue;

    // Get production from effects
    const effects = def.effectsOnComplete;
    if (effects) {
      // Add production (with abundance scaling if applicable)
      for (const resourceId of RESOURCE_TYPES) {
        const productionKey = `production_${resourceId}` as keyof typeof effects;
        const production = (effects[productionKey] || 0) as number;

        if (production > 0) {
          const scaledProduction = def.isAbundanceScaled
            ? production * state.abundance[resourceId]
            : production;
          netOutputs[resourceId] += scaledProduction * count;
        }
      }
    }

    // Subtract upkeep
    const upkeep = def.upkeepPerUnit;
    if (upkeep) {
      for (const resourceId of RESOURCE_TYPES) {
        const upkeepAmount = upkeep[resourceId] || 0;
        netOutputs[resourceId] -= upkeepAmount * count;
      }
    }
  }

  return netOutputs;
}

/**
 * Compute net outputs per turn
 * Σ(baseOutputsPerUnit × abundance × count) − Σ(upkeeps) − populationUpkeep
 * Food upkeep is now subtracted from production, not stocks
 */
export function computeNetOutputsPerTurn(state: PlanetState): NetOutputs {
  const netOutputs = computeProductionPerTurn(state);

  // CRITICAL: Subtract population food upkeep from PRODUCTION, not stocks
  // This makes upkeep visible in net production calculations
  netOutputs.food -= calculatePopulationFoodUpkeep(state);

  return netOutputs;
}

/**
 * Calculate total food upkeep for the population.
 * Workers and soldiers eat FOOD_PER_WORKER (0.002) each; scientists eat nothing.
 */
export function calculatePopulationFoodUpkeep(state: PlanetState): number {
  const { workersTotal, soldiers } = state.population;

  const totalPopulation = workersTotal + soldiers;

  // Use the existing FOOD_PER_WORKER constant (0.002 per worker)
  // This gives 200 food per 100,000 population
  return totalPopulation * FOOD_PER_WORKER;
}

/**
 * Compute projected net outputs including queued-but-not-yet-complete items.
 * Used for queue-time feasibility checks so that items depending on future
 * production (e.g. research requiring RP from queued scientists) are not
 * incorrectly blocked at the moment of queuing.
 */
export function computeProjectedNetOutputsPerTurn(state: PlanetState): NetOutputs {
  const projected = { ...computeNetOutputsPerTurn(state) };

  // Future production from queued buildings
  const buildingLane = state.lanes.building;
  const queuedBuildings = [
    ...(buildingLane.active ? [buildingLane.active] : []),
    ...buildingLane.pendingQueue,
  ];
  for (const item of queuedBuildings) {
    const def = getDefs()[item.itemId];
    const effects = def?.effectsOnComplete;
    if (!effects) continue;
    for (const resourceId of RESOURCE_TYPES) {
      const productionKey = `production_${resourceId}` as keyof typeof effects;
      const production = (effects[productionKey] || 0) as number;
      if (production > 0) {
        const scaledProduction = def.isAbundanceScaled
          ? production * state.abundance[resourceId]
          : production;
        projected[resourceId] += scaledProduction * item.quantity;
      }
    }
  }

  return projected;
}

/**
 * Add computed outputs to stocks (no caps)
 */
export function addOutputsToStocks(state: PlanetState, outputs: NetOutputs): void {
  state.stocks.metal += outputs.metal;
  state.stocks.mineral += outputs.mineral;
  state.stocks.food += outputs.food;
  state.stocks.energy += outputs.energy;
  state.stocks.research_points += outputs.research_points;
}
