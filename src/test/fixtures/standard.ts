/**
 * Standard test fixture - Full starting scenario
 * Uses actual game_data.json for comprehensive testing
 */

import type { PlanetState, ItemDefinition } from '../../lib/sim/engine/types';
import { createStandardStart } from '../../lib/sim/defs/seed';

// Import game data (this would be loaded from game_data.json in production)
// For now, we'll export a function that takes the loaded defs

/**
 * Create standard test scenario from loaded game definitions
 */
export function createStandardFixture(defs: Record<string, ItemDefinition>): PlanetState {
  return createStandardStart(defs);
}

/**
 * Expected starting values for validation
 */
export const expectedStartingValues = {
  turn: 0,
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
  structures: {
    outpost: 1,
    metal_mine: 3,
    mineral_extractor: 3,
    farm: 1,
    solar_generator: 1,
  },
};
