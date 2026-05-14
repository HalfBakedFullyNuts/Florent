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

  // Reset per-turn projected-activation flag (cloned from previous state, must be cleared)
  state.activationUsedProjectedProduction = false;

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
        // All non-colonist completions (structures and ships) apply same-turn so
        // completedCounts reflects the correct turn for both queue scheduling and UI.
        sameTurnCompletions.push(completedItem);
      }
    }
  }

  // Apply building completions immediately (same turn)
  processCompletions(state, sameTurnCompletions);

  // Phase 2b: Re-activate lanes freed by this turn's completions.
  // tryActivateNext ran at the TOP of each lane's iteration (before progressActive could
  // complete the active item), so any lane whose item just finished would not pick up the
  // next pending item until the following turn — causing an off-by-one delay.
  // Running a second pass here (after structure effects are applied) closes that gap.
  //
  // Projected production is passed so items that need "just a bit more" than the opening
  // stocks can still start this turn — matching the actual game's turn-atomic behaviour.
  // If the bonus was the deciding factor, state.activationUsedProjectedProduction is set
  // and the UI will render stocks in italic with a tooltip explaining the situation.
  const projectedOutputs = computeNetOutputsPerTurn(state);

  // Track which lanes are idle so we know which ones Phase 2b newly activates.
  const idleBeforePhase2b = new Set<string>();
  for (const laneId of LANE_ORDER) {
    if (!state.lanes[laneId].active) idleBeforePhase2b.add(laneId);
  }

  for (const laneId of LANE_ORDER) {
    tryActivateNext(state, laneId, projectedOutputs);
  }

  // Give Phase 2b items their first tick in the same turn their prerequisite completed.
  // Without this, the item activates but sits idle until the next turn — a wasted turn.
  // Wait items are excluded: they represent explicit pauses and must run for their full
  // declared duration — giving them an early tick would silently shorten the wait.
  const phase2bCompletions: WorkItem[] = [];
  for (const laneId of LANE_ORDER) {
    if (idleBeforePhase2b.has(laneId) && state.lanes[laneId].active && !state.lanes[laneId].active!.isWait) {
      const completedItem = progressActive(state, laneId);
      if (completedItem) {
        const def = state.defs[completedItem.itemId];
        if (def && !def.colonistKind) {
          phase2bCompletions.push(completedItem);
        }
      }
    }
  }
  // Apply any structures that completed on their first Phase 2b tick, then give
  // dependent items one more activation opportunity (handles chained prerequisites).
  if (phase2bCompletions.length > 0) {
    processCompletions(state, phase2bCompletions);
    for (const laneId of LANE_ORDER) {
      tryActivateNext(state, laneId, projectedOutputs);
    }
  }

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
