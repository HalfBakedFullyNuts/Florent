/**
 * Turn runner - implements deterministic turn sequencing
 * Canonical order: building → ship → colonist → colonist conversion → production (includes upkeep) → growth
 */

import type { PlanetState, WorkItem } from './types';
import { LANE_ORDER, RESOURCE_TYPES } from '../rules/constants';
import { tryActivateNext, progressActive } from './lanes';
import { processCompletions, applyColonistConversions } from './completions';
import { computeNetOutputsPerTurn, addOutputsToStocks } from './outputs';
import { applyWorkerGrowth } from './growth_food';
import { CompletionBuffer } from './buffers';
import { cloneState } from './helpers';

/**
 * Run a single turn following canonical order
 * 1. Start-of-turn completions (structures/ships from previous turn)
 * 2. Building lane (activation & progression)
 * 3. Ship lane (activation & progression)
 * 4. Colonist lane (activation & progression)
 * 5. Colonist conversions (same turn)
 * 6. Resource production (with abundance scaling and population upkeep subtracted)
 * 7. Clamp stocks to 0 minimum
 * 8. Worker growth (only if food > 0)
 */
export function runTurn(state: PlanetState, completionBuffer: CompletionBuffer): void {
  const currentTurn = state.currentTurn;

  // Phase 1: Process completions from previous turn
  const completedItems = completionBuffer.drain(currentTurn);
  processCompletions(state, completedItems);

  // Phase 2-4: Process each lane in order (building → ship → colonist)
  const sameTurnCompletions: WorkItem[] = [];
  for (const laneId of LANE_ORDER) {
    // Activation phase
    tryActivateNext(state, laneId);

    // Progression phase
    const completedItem = progressActive(state, laneId);

    // If item completed
    if (completedItem) {
      const def = state.defs[completedItem.itemId];
      if (def && !def.colonistKind) {
        // Buildings get same-turn completion, ships get next-turn
        if (def.type === 'structure') {
          sameTurnCompletions.push(completedItem);
        } else {
          completionBuffer.enqueue(currentTurn + 1, completedItem);
        }
      }
    }
  }

  // Apply building completions immediately (same turn)
  processCompletions(state, sameTurnCompletions);

  // Phase 5: Process colonist conversions (same-turn completion)
  applyColonistConversions(state);

  // Phase 6: Resource production (includes population food upkeep)
  const outputs = computeNetOutputsPerTurn(state);
  addOutputsToStocks(state, outputs);

  // Phase 7: Clamp stocks to 0 minimum (cannot go negative)
  for (const resourceId of RESOURCE_TYPES) {
    state.stocks[resourceId] = Math.max(0, state.stocks[resourceId]);
  }

  // Phase 8: Worker growth (only if food > 0)
  applyWorkerGrowth(state);

  // NOTE: Food upkeep is now handled in computeNetOutputsPerTurn
  // No separate applyFoodUpkeep call to avoid double deduction

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
