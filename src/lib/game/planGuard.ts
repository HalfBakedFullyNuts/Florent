/**
 * Guards a planet queue change: snapshot the plan, apply the change, list the problems it adds,
 * and undo it if the player declines. Also probes whether an entry only waits for stock, so the
 * player can choose between waiting and starting now with an accepted shortfall.
 */

import type { GameController } from './commands';
import type { LaneId } from '../sim/engine/types';
import { cloneState } from '../sim/engine/helpers';
import { diagnosePlan, findNewProblems, type PlanDiagnosis, type PlanProblem } from './planDiagnostics';

export interface PlanGuard {
  /** Problems the change added (empty when the plan is still as valid as before). */
  finish: (options?: { changedEntryId?: string }) => PlanProblem[];
  /** Restores the plan to the snapshot taken at begin. */
  undo: () => void;
}

export interface ShortfallChoice {
  /** Start turn when waiting for stock (null = never within the horizon). */
  waitStart: number | null;
  /** Start turn when starting now and overspending. */
  forcedStart: number;
}

export function diagnoseController(controller: GameController, planTurn: number): PlanDiagnosis {
  const lastTurn = planTurn + controller.getTotalTurns() - 1;
  return diagnosePlan((turn) => controller.getStateAtTurn(turn), planTurn, lastTurn);
}

export function beginPlanGuard(controller: GameController, planTurn: number): PlanGuard {
  const start = controller.getStateAtTurn(planTurn);
  if (!start) throw new Error(`No plan state at T${planTurn}`);
  const snapshot = cloneState(start);
  const before = diagnoseController(controller, planTurn);
  return {
    finish: (options) => findNewProblems(before, diagnoseController(controller, planTurn), options),
    undo: () => controller.restorePlanStart(snapshot),
  };
}

/** Non-null when accepting a shortfall would start the entry earlier than waiting for stock. */
export function findShortfallChoice(
  controller: GameController,
  planTurn: number,
  laneId: LaneId,
  entryId: string,
): ShortfallChoice | null {
  const start = controller.getStateAtTurn(planTurn);
  if (!start) return null;
  const waitStart = diagnoseController(controller, planTurn).starts.get(entryId) ?? null;
  const snapshot = cloneState(start);
  if (!controller.setAllowShortfall(planTurn, laneId, entryId, true)) return null;
  const forcedStart = diagnoseController(controller, planTurn).starts.get(entryId) ?? null;
  controller.restorePlanStart(snapshot);
  if (forcedStart === null || (waitStart !== null && forcedStart >= waitStart)) return null;
  return { waitStart, forcedStart };
}
