/**
 * Initial planet state factory
 * Creates initial PlanetState with specified starting conditions
 */

import type { PlanetState, ItemDefinition } from '../engine/types';
import { STARTING_STATE } from '../rules/constants';

export interface SeedConfig {
  stocks?: {
    metal?: number;
    mineral?: number;
    food?: number;
    energy?: number;
  };
  abundance?: {
    metal?: number;
    mineral?: number;
    food?: number;
    energy?: number;
  };
  population?: {
    workersTotal?: number;
    soldiers?: number;
    scientists?: number;
  };
  structures?: Record<string, number>; // structure_id -> count
  space?: {
    groundCap?: number;
    orbitalCap?: number;
  };
}

/**
 * Create initial planet state from definitions and configuration
 */
export function createInitialState(
  defs: Record<string, ItemDefinition>,
  config: SeedConfig = {}
): PlanetState {
  // Merge config with defaults
  const stocks = {
    metal: config.stocks?.metal ?? STARTING_STATE.stocks.metal,
    mineral: config.stocks?.mineral ?? STARTING_STATE.stocks.mineral,
    food: config.stocks?.food ?? STARTING_STATE.stocks.food,
    energy: config.stocks?.energy ?? STARTING_STATE.stocks.energy,
  };

  const abundance = {
    metal: config.abundance?.metal ?? STARTING_STATE.abundance.metal,
    mineral: config.abundance?.mineral ?? STARTING_STATE.abundance.mineral,
    food: config.abundance?.food ?? STARTING_STATE.abundance.food,
    energy: config.abundance?.energy ?? STARTING_STATE.abundance.energy,
  };

  const workersTotal = config.population?.workersTotal ?? STARTING_STATE.population.workersTotal;
  const soldiers = config.population?.soldiers ?? STARTING_STATE.population.soldiers;
  const scientists = config.population?.scientists ?? STARTING_STATE.population.scientists;

  // Calculate starting structures and their effects
  const structures = config.structures || {
    outpost: 1,
    metal_mine: 3,
    mineral_extractor: 3,
    farm: 1,
    solar_generator: 1,
  };

  const completedCounts: Record<string, number> = {};
  let housingWorkerCap = 0;
  let housingSoldierCap = 0;
  let housingScientistCap = 0;
  let spaceGroundCap = config.space?.groundCap ?? STARTING_STATE.space.groundCap;
  let spaceOrbitalCap = config.space?.orbitalCap ?? STARTING_STATE.space.orbitalCap;
  let groundUsed = 0;

  // Process starting structures
  for (const [structureId, count] of Object.entries(structures)) {
    const def = defs[structureId];
    if (!def) {
      console.warn(`Starting structure not found in definitions: ${structureId}`);
      continue;
    }

    completedCounts[structureId] = count;

    // Calculate space used
    const spacePerUnit = def.costsPerUnit.space || 0;
    groundUsed += spacePerUnit * count;

    // Apply housing effects
    const effects = def.effectsOnComplete;
    if (effects) {
      housingWorkerCap += (effects.housing_worker_cap || 0) * count;
      housingSoldierCap += (effects.housing_soldier_cap || 0) * count;
      housingScientistCap += (effects.housing_scientist_cap || 0) * count;
      spaceGroundCap += (effects.space_ground_cap || 0) * count;
      spaceOrbitalCap += (effects.space_orbital_cap || 0) * count;
    }
  }

  // Create initial state
  const initialState: PlanetState = {
    currentTurn: 0,
    stocks,
    abundance,
    population: {
      workersTotal,
      workersIdle: workersTotal, // All workers start idle
      soldiers,
      scientists,
      busyByLane: {
        building: 0,
        ship: 0,
        colonist: 0,
      },
    },
    space: {
      groundUsed,
      groundCap: spaceGroundCap,
      orbitalUsed: 0,
      orbitalCap: spaceOrbitalCap,
    },
    housing: {
      workerCap: housingWorkerCap,
      soldierCap: housingSoldierCap,
      scientistCap: housingScientistCap,
    },
    lanes: {
      building: {
        pending: null,
        active: null,
      },
      ship: {
        pending: null,
        active: null,
      },
      colonist: {
        pending: null,
        active: null,
      },
    },
    completedCounts,
    pendingColonistConversions: [],
    defs,
  };

  return initialState;
}

/**
 * Create standard starting scenario
 */
export function createStandardStart(defs: Record<string, ItemDefinition>): PlanetState {
  return createInitialState(defs, {
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
      soldiers: 0,
      scientists: 0,
    },
    structures: {
      outpost: 1,
      metal_mine: 3,
      mineral_extractor: 3,
      farm: 1,
      solar_generator: 1,
    },
    space: {
      groundCap: 60,
      orbitalCap: 40,
    },
  });
}

/**
 * Create minimal test scenario (just outpost)
 */
export function createMinimalStart(defs: Record<string, ItemDefinition>): PlanetState {
  return createInitialState(defs, {
    stocks: {
      metal: 10000,
      mineral: 10000,
      food: 500,
      energy: 0,
    },
    abundance: {
      metal: 1.0,
      mineral: 1.0,
      food: 1.0,
      energy: 1.0,
    },
    population: {
      workersTotal: 10000,
      soldiers: 0,
      scientists: 0,
    },
    structures: {
      outpost: 1,
    },
    space: {
      groundCap: 60,
      orbitalCap: 40,
    },
  });
}
