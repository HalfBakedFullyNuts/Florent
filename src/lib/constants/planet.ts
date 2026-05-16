/**
 * Planet configuration constants
 */

export const ABUNDANCE_LIMITS = {
  MIN: 50,
  MAX: 200,
  DEFAULT: 100,
} as const;

export const DEFAULT_SPACE = {
  GROUND: 60,
  ORBITAL: 40,
} as const;

export const PLANET_PRESETS = {
  HOMEWORLD: {
    abundance: {
      metal: 100,
      mineral: 100,
      food: 100,
      energy: 100,
      research_points: 100,
    },
    space: {
      groundCap: 60,
      orbitalCap: 40,
    },
  },
  HOME_GALAXY: {
    abundance: {
      metal: 60,
      mineral: 60,
      food: 60,
      energy: 60,
      research_points: 60,
    },
    space: {
      groundCap: 60,
      orbitalCap: 40,
    },
  },
  FREE_GALAXY: {
    abundance: {
      metal: 80,
      mineral: 80,
      food: 80,
      energy: 80,
      research_points: 80,
    },
    space: {
      groundCap: 75,
      orbitalCap: 55,
    },
  },
} as const;

export const STARTER_PACKAGE = {
  WORKERS: 5000,
  METAL: 6000,
  MINERAL: 4000,
  FOOD: 2000,
  ENERGY: 0,
  BUILDINGS: ['Outpost'],
} as const;

export const STARTING_STRUCTURE_IDS = [
  'metal_mine',
  'mineral_extractor',
  'farm',
  'solar_generator',
] as const;

export type StartingStructureId = typeof STARTING_STRUCTURE_IDS[number];

export interface PlanetStartingSettings {
  workersTotal: number;
  structures: Record<StartingStructureId, number>;
}

export const DEFAULT_ADDED_PLANET_STARTING: PlanetStartingSettings = {
  workersTotal: 12000,
  structures: {
    metal_mine: 0,
    mineral_extractor: 0,
    farm: 0,
    solar_generator: 0,
  },
};

export const HOMEWORLD_PLANET_STARTING: PlanetStartingSettings = {
  workersTotal: 20000,
  structures: {
    metal_mine: 3,
    mineral_extractor: 3,
    farm: 1,
    solar_generator: 1,
  },
};

/**
 * Resource types with their display colors
 */
export const RESOURCE_COLORS = {
  metal: 'text-gray-300',
  mineral: 'text-red-400',
  food: 'text-green-400',
  energy: 'text-blue-400',
  research_points: 'text-yellow-400',
} as const;

/**
 * Validate and clamp abundance value to valid range
 */
export function validateAbundance(value: number): number {
  return Math.max(
    ABUNDANCE_LIMITS.MIN,
    Math.min(ABUNDANCE_LIMITS.MAX, Math.round(value) || ABUNDANCE_LIMITS.DEFAULT)
  );
}

/**
 * Validate all abundance values in an object
 */
export function validateAllAbundances(abundance: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(abundance).map(([key, value]) => [key, validateAbundance(value)])
  );
}

export function normalizePlanetStarting(starting?: Partial<PlanetStartingSettings>): PlanetStartingSettings {
  return {
    workersTotal: Math.max(
      0,
      Math.floor(starting?.workersTotal ?? DEFAULT_ADDED_PLANET_STARTING.workersTotal)
    ),
    structures: {
      metal_mine: Math.max(
        0,
        Math.floor(starting?.structures?.metal_mine ?? DEFAULT_ADDED_PLANET_STARTING.structures.metal_mine)
      ),
      mineral_extractor: Math.max(
        0,
        Math.floor(starting?.structures?.mineral_extractor ?? DEFAULT_ADDED_PLANET_STARTING.structures.mineral_extractor)
      ),
      farm: Math.max(
        0,
        Math.floor(starting?.structures?.farm ?? DEFAULT_ADDED_PLANET_STARTING.structures.farm)
      ),
      solar_generator: Math.max(
        0,
        Math.floor(starting?.structures?.solar_generator ?? DEFAULT_ADDED_PLANET_STARTING.structures.solar_generator)
      ),
    },
  };
}
