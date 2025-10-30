/**
 * Minimal test fixture - Just outpost for basic testing
 */

import type { ItemDefinition } from '../../lib/sim/engine/types';
import { createMinimalStart } from '../../lib/sim/defs/seed';

// Minimal set of definitions for testing
export const minimalDefs: Record<string, ItemDefinition> = {
  outpost: {
    id: 'outpost',
    name: 'Outpost',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 0,
    costsPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
      workers: 0,
      space: 0,
    },
    effectsOnComplete: {
      production_metal: 300,
      production_mineral: 200,
      production_food: 100,
      production_energy: 100,
      housing_worker_cap: 50000,
      housing_soldier_cap: 100000,
    },
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
    },
    isAbundanceScaled: true,
    prerequisites: [],
  },
  metal_mine: {
    id: 'metal_mine',
    name: 'Metal Mine',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 4,
    costsPerUnit: {
      metal: 1500,
      mineral: 1000,
      food: 0,
      energy: 0,
      workers: 5000,
      space: 1,
    },
    effectsOnComplete: {
      production_metal: 300,
    },
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 10,
    },
    isAbundanceScaled: true,
    prerequisites: ['outpost'],
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 4,
    costsPerUnit: {
      metal: 1500,
      mineral: 1000,
      food: 0,
      energy: 0,
      workers: 5000,
      space: 1,
    },
    effectsOnComplete: {
      production_food: 100,
    },
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 10,
    },
    isAbundanceScaled: true,
    prerequisites: ['outpost'],
  },
  worker: {
    id: 'worker',
    name: 'Worker',
    lane: 'colonist',
    type: 'soldier', // Note: worker is technically a colonist type, but we model it separately
    tier: 1,
    durationTurns: 1,
    costsPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
      workers: 0,
      space: 0,
    },
    effectsOnComplete: {},
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
    },
    isAbundanceScaled: false,
    prerequisites: [],
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    lane: 'colonist',
    type: 'soldier',
    tier: 1,
    durationTurns: 4,
    costsPerUnit: {
      metal: 12,
      mineral: 8,
      food: 20,
      energy: 0,
      workers: 10, // Reserves 10 workers during training
      space: 0,
    },
    effectsOnComplete: {},
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
    },
    colonistKind: 'soldier',
    isAbundanceScaled: false,
    prerequisites: ['barracks'],
  },
};

// Create minimal initial state
export const minimalState = createMinimalStart(minimalDefs);
