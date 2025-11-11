/**
 * Resource output calculations with abundance scaling
 */

import type { PlanetState, NetOutputs } from './types';
import { RESOURCE_TYPES, FOOD_PER_WORKER } from '../rules/constants';

/**
 * Compute net outputs per turn
 * Σ(baseOutputsPerUnit × abundance × count) − Σ(upkeeps) − populationUpkeep
 * Food upkeep is now subtracted from production, not stocks
 * Scientists produce 1 RP per scientist per turn
 */
export function computeNetOutputsPerTurn(state: PlanetState): NetOutputs {
  const netOutputs: NetOutputs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
    research_points: 0,
  };

  // Iterate through all completed items
  for (const [itemId, count] of Object.entries(state.completedCounts)) {
    if (count === 0) continue;

    const def = state.defs[itemId];
    if (!def) continue;

    // Get production from effects
    const effects = def.effectsOnComplete;
    if (effects) {
      // Add production (with abundance scaling if applicable)
      for (const resourceId of RESOURCE_TYPES) {
        const productionKey = `production_${resourceId}` as keyof typeof effects;
        const production = effects[productionKey] || 0;

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

  // CRITICAL: Subtract population food upkeep from PRODUCTION, not stocks
  // This makes upkeep visible in net production calculations
  const populationFoodUpkeep = calculatePopulationFoodUpkeep(state);
  netOutputs.food -= populationFoodUpkeep;

  // Scientists produce 1 RP per scientist per turn
  netOutputs.research_points += state.population.scientists;

  return netOutputs;
}

/**
 * Calculate total food upkeep for all population types
 * Workers: FOOD_PER_WORKER (0.002) per worker
 * Soldiers: FOOD_PER_WORKER per soldier
 * Scientists: FOOD_PER_WORKER per scientist
 */
export function calculatePopulationFoodUpkeep(state: PlanetState): number {
  const { workersTotal, soldiers, scientists } = state.population;

  // All population types consume food at the same rate
  const totalPopulation = workersTotal + soldiers + scientists;

  // Use the existing FOOD_PER_WORKER constant (0.002 per worker)
  // This gives 200 food per 100,000 population
  return totalPopulation * FOOD_PER_WORKER;
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
