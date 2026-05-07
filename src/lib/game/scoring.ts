import type { PlanetSummary } from './selectors';

/**
 * Compute planet score for the viewed turn.
 *
 * Scored categories: ships, colonists (workers / soldiers / scientists),
 * and structures. Resources have no score_value in the current data and
 * contribute 0. Missing score values are treated as 0 and never throw.
 */
export function computePlanetScore(
  summary: PlanetSummary,
  defs: Record<string, { scoreValue?: number }>
): number {
  let score = 0;

  for (const [id, count] of Object.entries(summary.ships)) {
    score += count * (defs[id]?.scoreValue ?? 0);
  }

  for (const [id, count] of Object.entries(summary.structures)) {
    score += count * (defs[id]?.scoreValue ?? 0);
  }

  score += summary.population.workersTotal * (defs['worker']?.scoreValue ?? 0);
  score += summary.population.soldiers * (defs['soldier']?.scoreValue ?? 0);
  score += summary.population.scientists * (defs['scientist']?.scoreValue ?? 0);

  return score;
}
