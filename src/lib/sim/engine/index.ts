/**
 * Core simulation engine exports
 * Entry point for all engine functionality
 */

// Core types
export type {
  ResourceId,
  LaneId,
  UnitType,
  Status,
  Costs,
  Upkeep,
  Effects,
  ItemDefinition,
  WorkItem,
  LaneState,
  PlanetState,
  NetOutputs,
  GrowthCalculation,
  CanQueueResult,
} from './types';

// Validation
export { hasPrereqs, housingExistsForColonist, energyNonNegativeAfterCompletion, canQueue, clampBatchAtActivation } from './validation';

// Lane management
export { tryActivateNext, progressActive } from './lanes';

// Completion handling
export { applyStructureCompletion, applyColonistConversion, applyColonistConversions, processCompletions } from './completions';

// Completion buffer
export { CompletionBuffer } from './buffers';

// Output calculations
export { computeNetOutputsPerTurn, addOutputsToStocks } from './outputs';

// Growth and food upkeep
export { computeGrowthBonus, applyWorkerGrowth, computeFoodUpkeep, applyFoodUpkeep } from './growth_food';

// Turn execution
export { runTurn, simulate } from './turn';

// Helpers
export { cloneState, generateWorkItemId } from './helpers';
