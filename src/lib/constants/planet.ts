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

/**
 * Resource types with their display colors
 */
export const RESOURCE_COLORS = {
  metal: 'text-gray-300',
  mineral: 'text-red-400',
  food: 'text-green-400',
  energy: 'text-blue-400',
  research_points: 'text-purple-400',
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
