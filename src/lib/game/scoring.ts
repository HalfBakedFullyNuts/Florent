import type { PlanetSummary } from './selectors';
import type { ItemDefinition } from '../sim/engine/types';

/** Score value per 1 000 units of each resource (matches PHP $score_map resource IDs 1–4). */
export const RESOURCE_SCORE_VALUES: Record<string, number> = {
  metal: 1,
  mineral: 1.5,
  food: 2,
  energy: 2,
};

/** Score value per 1 000 population units (PHP $score_map IDs 7–9). */
export const POPULATION_SCORE_VALUES = {
  worker:    12,
  soldier:   128,
  scientist: 340,
} as const;

/** All scores are divided by this constant (per 1 000 units). */
export const SCORE_DIVISOR = 1000;

/** Cost-spread multiplier applied after weighting resource costs. */
const COST_SPREAD = 1.5;

/** Build-time divisor: a 4-turn item gets ×1, an 8-turn item gets ×2, etc. */
const TURNS_DIVISOR = 4;

/**
 * Compute the asset score for one item definition from its build cost and duration.
 *
 * Formula (mirrors PHP):
 *   weightedCost = metal×1 + mineral×1.5 + food×2 + energy×2
 *   assetScore   = round((weightedCost × 1.5) / 1000) × (durationTurns / 4)
 *
 * This is the canonical per-item score used for every ship and structure.
 */
export function computeItemAssetScore(def: ItemDefinition): number {
  const costs = def.costsPerUnit;
  const weightedCost =
    (costs.metal   ?? 0) * RESOURCE_SCORE_VALUES.metal   +
    (costs.mineral ?? 0) * RESOURCE_SCORE_VALUES.mineral +
    (costs.food    ?? 0) * RESOURCE_SCORE_VALUES.food    +
    (costs.energy  ?? 0) * RESOURCE_SCORE_VALUES.energy;

  return Math.round((weightedCost * COST_SPREAD) / SCORE_DIVISOR) * (def.durationTurns / TURNS_DIVISOR);
}

/**
 * Compute planet score for the viewed turn.
 *
 * Resources and population use their per-1000 score maps; ships and structures
 * use their in-game asset score. Unknown items score 0 and never throw.
 */
export function computePlanetScore(
  summary: PlanetSummary,
  defs: Record<string, ItemDefinition>
): number {
  let score = 0;

  for (const [id, amount] of Object.entries(summary.stocks)) {
    score += (amount / SCORE_DIVISOR) * (RESOURCE_SCORE_VALUES[id] ?? 0);
  }

  for (const [id, count] of [...Object.entries(summary.ships), ...Object.entries(summary.structures)]) {
    const def = defs[id];
    if (def) score += (count / SCORE_DIVISOR) * computeItemAssetScore(def);
  }

  score += (summary.population.workersTotal / SCORE_DIVISOR) * POPULATION_SCORE_VALUES.worker;
  score += (summary.population.soldiers / SCORE_DIVISOR) * POPULATION_SCORE_VALUES.soldier;
  score += (summary.population.scientists / SCORE_DIVISOR) * POPULATION_SCORE_VALUES.scientist;

  return score;
}
