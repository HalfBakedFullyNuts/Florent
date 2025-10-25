/**
 * Game rules and constants exports
 */

// Constants
export {
  WORKER_GROWTH_BASE,
  BONUS_PER_FACILITY,
  FOOD_PER_WORKER,
  ABUNDANCE_MIN,
  ABUNDANCE_MAX,
  ABUNDANCE_DEFAULT,
  RESOURCE_TYPES,
  LANE_ORDER,
  STARTING_STATE,
  SOLDIER_WORKERS_OCCUPIED,
  SCIENTIST_WORKERS_OCCUPIED,
  GROWTH_FACILITY_IDS,
} from './constants';

// Turn order
export { TurnPhase, TURN_ORDER, getPhaseDescription } from './order';
