/**
 * Turn runner - implements deterministic turn sequencing
 * Canonical order: building → ship → colonist → colonist conversion → production → growth → food upkeep
 */

import type { PlanetState } from './types';
import { LANE_ORDER } from '../rules/constants';
import { tryActivateNext, progressActive } from './lanes';
import { processCompletions, applyColonistConversions } from './completions';
import { computeNetOutputsPerTurn, addOutputsToStocks } from './outputs';
import { applyWorkerGrowth, applyFoodUpkeep } from './growth_food';
import { CompletionBuffer } from './buffers';
import { cloneState } from './helpers';

/**
 * Run a single turn following canonical order
 * 1. Start-of-turn completions (structures/ships from previous turn)
 * 2. Building lane (activation & progression)
 * 3. Ship lane (activation & progression)
 * 4. Colonist lane (activation & progression)
 * 5. Colonist conversions (same turn)
 * 6. Resource production (with abundance scaling)
 * 7. Worker growth (if food > 0)
 * 8. Food upkeep (clamped at 0)
 */
export function runTurn(state: PlanetState, completionBuffer: CompletionBuffer): void {
  const currentTurn = state.currentTurn;

  // Phase 1: Process completions from previous turn
  const completedItems = completionBuffer.drain(currentTurn);
  processCompletions(state, completedItems);

  // Phase 2-4: Process each lane in order (building → ship → colonist)
  for (const laneId of LANE_ORDER) {
    // Activation phase
    tryActivateNext(state, laneId);

    // Progression phase
    const completedItem = progressActive(state, laneId);

    // If item completed and it's not a colonist, enqueue for next turn
    if (completedItem) {
      const def = state.defs[completedItem.itemId];
      if (def && !def.colonistKind) {
        completionBuffer.enqueue(currentTurn + 1, completedItem);
      }
    }
  }

  // Phase 5: Process colonist conversions (same-turn completion)
  applyColonistConversions(state);

  // Phase 6: Resource production
  const outputs = computeNetOutputsPerTurn(state);
  addOutputsToStocks(state, outputs);

  // Phase 7: Worker growth (only if food > 0)
  applyWorkerGrowth(state);

  // Phase 8: Food upkeep (clamped at 0)
  applyFoodUpkeep(state);

  // Increment turn counter
  state.currentTurn += 1;
}

/**
 * Simulate N turns from initial state
 */
export function simulate(initial: PlanetState, turns: number): PlanetState[] {
  const states: PlanetState[] = [cloneState(initial)];
  const completionBuffer = new CompletionBuffer();

  let currentState = cloneState(initial);

  for (let i = 0; i < turns; i++) {
    runTurn(currentState, completionBuffer);
    states.push(cloneState(currentState));
  }

  return states;
}
