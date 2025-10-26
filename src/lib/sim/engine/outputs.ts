/**
 * Resource output calculations with abundance scaling
 */

import type { PlanetState, NetOutputs } from './types';
import { RESOURCE_TYPES } from '../rules/constants';

/**
 * Compute net outputs per turn
 * Σ(baseOutputsPerUnit × abundance × count) − Σ(upkeeps)
 */
export function computeNetOutputsPerTurn(state: PlanetState): NetOutputs {
  const netOutputs: NetOutputs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
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

  return netOutputs;
}

/**
 * Add computed outputs to stocks (no caps)
 */
export function addOutputsToStocks(state: PlanetState, outputs: NetOutputs): void {
  state.stocks.metal += outputs.metal;
  state.stocks.mineral += outputs.mineral;
  state.stocks.food += outputs.food;
  state.stocks.energy += outputs.energy;
}
