/**
 * Worker growth and food upkeep calculations
 */

import type { PlanetState, GrowthCalculation } from './types';
import {
  WORKER_GROWTH_BASE,
  BONUS_PER_FACILITY,
  FOOD_PER_WORKER,
  GROWTH_FACILITY_IDS,
} from '../rules/constants';

/**
 * Compute growth bonus from leisure centre and hospital
 * Base: 1% + 0.5% per facility
 */
export function computeGrowthBonus(state: PlanetState): number {
  let facilityCount = 0;

  for (const facilityId of GROWTH_FACILITY_IDS) {
    facilityCount += state.completedCounts[facilityId] || 0;
  }

  return BONUS_PER_FACILITY * facilityCount;
}

/**
 * Calculate and apply worker growth
 * Only applies if food > 0 after production
 * Growth is clamped to not exceed housing cap
 */
export function applyWorkerGrowth(state: PlanetState): GrowthCalculation {
  // No growth if food is depleted
  if (state.stocks.food <= 0) {
    return { baseRate: 0, bonusRate: 0, totalRate: 0, growthAmount: 0 };
  }

  const baseRate = WORKER_GROWTH_BASE;
  const bonusRate = computeGrowthBonus(state);
  const totalRate = baseRate + bonusRate;
  const growthAmount = Math.floor(state.population.workersTotal * totalRate);

  // Calculate available housing
  const availableHousing = state.housing.workerCap - state.population.workersTotal;

  // Clamp growth to not exceed housing cap
  const actualGrowth = Math.max(0, Math.min(growthAmount, availableHousing));

  // Apply growth (only if there's available housing)
  state.population.workersTotal += actualGrowth;
  state.population.workersIdle += actualGrowth;

  return { baseRate, bonusRate, totalRate, growthAmount: actualGrowth };
}
