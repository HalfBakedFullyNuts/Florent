/**
 * Game rules and constants
 */

import type { ResourceId, LaneId } from '../engine/types';

// Worker growth mechanics
export const WORKER_GROWTH_BASE = 0.01; // 1% base growth per turn
export const BONUS_PER_FACILITY = 0.005; // 0.5% bonus per leisure centre or hospital

// Food consumption
export const FOOD_PER_WORKER = 0.002; // 200 food per 100k workers per turn

// Abundance scaling
export const ABUNDANCE_MIN = 0.0; // 0%
export const ABUNDANCE_MAX = 2.0; // 200%
export const ABUNDANCE_DEFAULT = 1.0; // 100%

// Resource types
export const RESOURCE_TYPES: readonly ResourceId[] = ['metal', 'mineral', 'food', 'energy'] as const;

// Lane order (critical for deterministic execution)
export const LANE_ORDER: readonly LaneId[] = ['building', 'ship', 'colonist'] as const;

// Starting state constants
export const STARTING_STATE = {
  stocks: {
    metal: 30000,
    mineral: 20000,
    food: 1000,
    energy: 0,
  },
  abundance: {
    metal: 1.0,
    mineral: 1.0,
    food: 1.0,
    energy: 1.0,
  },
  population: {
    workersTotal: 20000,
    workersIdle: 20000,
    soldiers: 0,
    scientists: 0,
  },
  space: {
    groundUsed: 8, // 3 metal mines + 3 mineral extractors + 1 farm + 1 solar generator
    groundCap: 60,
    orbitalUsed: 0,
    orbitalCap: 40,
  },
} as const;

// Colonist worker occupation rules
export const SOLDIER_WORKERS_OCCUPIED = 10; // Reserves 10 workers during training, converts 1 at completion
export const SCIENTIST_WORKERS_OCCUPIED = 25; // Reserves 25 workers during training, converts 1 at completion

// Growth facilities (for bonus calculation)
export const GROWTH_FACILITY_IDS = ['leisure_centre', 'hospital'] as const;
