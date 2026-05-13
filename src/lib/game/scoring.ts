import type { PlanetSummary } from './selectors';

/** Score value per 1 000 units of each resource. */
export const RESOURCE_SCORE_VALUES: Record<string, number> = {
  metal: 1,
  mineral: 1.5,
  food: 2,
  energy: 2,
};

/** All scores are divided by this constant (per 1 000 units). */
export const SCORE_DIVISOR = 1000;

/**
 * Compute planet score for the viewed turn.
 *
 * Every category (resources, ships, population, structures) is
 * scored as `(amount / 1000) * scoreValue`.
 * Missing score values are treated as 0 and never throw.
 */
export function computePlanetScore(
  summary: PlanetSummary,
  defs: Record<string, { scoreValue?: number }>
): number {
  let score = 0;

  for (const [id, amount] of Object.entries(summary.stocks)) {
    score += (amount / SCORE_DIVISOR) * (RESOURCE_SCORE_VALUES[id] ?? 0);
  }

  for (const [id, count] of Object.entries(summary.ships)) {
    score += (count / SCORE_DIVISOR) * (defs[id]?.scoreValue ?? 0);
  }

  for (const [id, count] of Object.entries(summary.structures)) {
    score += (count / SCORE_DIVISOR) * (defs[id]?.scoreValue ?? 0);
  }

  score += (summary.population.workersTotal / SCORE_DIVISOR) * (defs['worker']?.scoreValue ?? 0);
  score += (summary.population.soldiers / SCORE_DIVISOR) * (defs['soldier']?.scoreValue ?? 0);
  score += (summary.population.scientists / SCORE_DIVISOR) * (defs['scientist']?.scoreValue ?? 0);

  return score;
}
