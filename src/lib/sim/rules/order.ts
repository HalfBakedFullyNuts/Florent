/**
 * Canonical turn order for deterministic simulation
 *
 * This defines the exact sequence of operations within a turn.
 * Order is critical for deterministic behavior.
 */

export enum TurnPhase {
  // Phase 1: Process completions from previous turn
  START_OF_TURN_COMPLETIONS = 'start_of_turn_completions',

  // Phase 2: Building lane
  BUILDING_LANE_ACTIVATION = 'building_lane_activation',
  BUILDING_LANE_PROGRESSION = 'building_lane_progression',

  // Phase 3: Ship lane
  SHIP_LANE_ACTIVATION = 'ship_lane_activation',
  SHIP_LANE_PROGRESSION = 'ship_lane_progression',

  // Phase 4: Colonist lane
  COLONIST_LANE_ACTIVATION = 'colonist_lane_activation',
  COLONIST_LANE_PROGRESSION = 'colonist_lane_progression',

  // Phase 5: Colonist conversions (same-turn completion)
  COLONIST_CONVERSIONS = 'colonist_conversions',

  // Phase 6: Resource production
  RESOURCE_PRODUCTION = 'resource_production',

  // Phase 7: Worker growth
  WORKER_GROWTH = 'worker_growth',

  // Phase 8: Food upkeep
  FOOD_UPKEEP = 'food_upkeep',
}

/**
 * Canonical order of turn phases
 */
export const TURN_ORDER: readonly TurnPhase[] = [
  TurnPhase.START_OF_TURN_COMPLETIONS,
  TurnPhase.BUILDING_LANE_ACTIVATION,
  TurnPhase.BUILDING_LANE_PROGRESSION,
  TurnPhase.SHIP_LANE_ACTIVATION,
  TurnPhase.SHIP_LANE_PROGRESSION,
  TurnPhase.COLONIST_LANE_ACTIVATION,
  TurnPhase.COLONIST_LANE_PROGRESSION,
  TurnPhase.COLONIST_CONVERSIONS,
  TurnPhase.RESOURCE_PRODUCTION,
  TurnPhase.WORKER_GROWTH,
  TurnPhase.FOOD_UPKEEP,
] as const;

/**
 * Get human-readable description of a turn phase
 */
export function getPhaseDescription(phase: TurnPhase): string {
  switch (phase) {
    case TurnPhase.START_OF_TURN_COMPLETIONS:
      return 'Process structure and ship completions from previous turn';
    case TurnPhase.BUILDING_LANE_ACTIVATION:
      return 'Activate queued building lane items';
    case TurnPhase.BUILDING_LANE_PROGRESSION:
      return 'Progress active building lane items';
    case TurnPhase.SHIP_LANE_ACTIVATION:
      return 'Activate queued ship lane items';
    case TurnPhase.SHIP_LANE_PROGRESSION:
      return 'Progress active ship lane items';
    case TurnPhase.COLONIST_LANE_ACTIVATION:
      return 'Activate queued colonist training';
    case TurnPhase.COLONIST_LANE_PROGRESSION:
      return 'Progress active colonist training';
    case TurnPhase.COLONIST_CONVERSIONS:
      return 'Convert workers to soldiers/scientists';
    case TurnPhase.RESOURCE_PRODUCTION:
      return 'Calculate and apply resource production with abundance scaling';
    case TurnPhase.WORKER_GROWTH:
      return 'Apply worker population growth (if food > 0)';
    case TurnPhase.FOOD_UPKEEP:
      return 'Deduct food upkeep for all workers';
    default:
      return 'Unknown phase';
  }
}
