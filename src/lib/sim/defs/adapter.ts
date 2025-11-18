/**
 * Data adapter - Converts game_data.json format to engine ItemDefinition format
 * Maintains game_data.json as authoritative source without modification
 */

import type { ItemDefinition, Costs, Upkeep, Effects, LaneId, UnitType } from '../engine/types';

// Raw game data types (from game_data.json)
interface RawCost {
  type: 'resource' | 'unit';
  id: string;
  amount: number;
  is_consumed?: boolean;
}

interface RawRequirement {
  type: 'structure' | 'unit';
  id: string;
}

interface RawProduction {
  type: string;
  base_amount: number;
  is_abundance_scaled: boolean;
}

interface RawConsumption {
  type: 'resource' | 'housing';
  id?: string;
  category?: string;
  amount?: number;
  amount_per_100_pop?: number;
}

interface RawEffect {
  type: string;
  category?: string;
  amount?: number;
}

interface RawUnit {
  id: string;
  name: string;
  category: 'colonist' | 'ship';
  tier: number;
  build_time_turns: number;
  cost: RawCost[];
  build_requirements: {
    workers_occupied?: number;
  };
  requirements: RawRequirement[];
}

interface RawStructure {
  id: string;
  name: string;
  tier: number;
  build_time_turns: number;
  cost: RawCost[];
  build_requirements: {
    workers_occupied?: number;
    space_cost?: Array<{ type: string; amount: number }>;
  };
  requirements: RawRequirement[];
  operations?: {
    production?: RawProduction[];
    consumption?: RawConsumption[];
    effects?: RawEffect[];
  };
}

interface RawResearch {
  id: string;
  name: string;
  category: string;
  tier: number;
  build_time_turns: number;
  cost: RawCost[];
  build_requirements: {
    workers_occupied?: number;
  };
  requirements: string[];
  operations?: any[];
  score_value?: number;
}

interface RawGameData {
  meta: any;
  resources: any[];
  units: RawUnit[];
  structures: RawStructure[];
  research?: RawResearch[];
}

/**
 * Convert raw unit to ItemDefinition
 */
function convertUnit(raw: RawUnit): ItemDefinition {
  // Determine lane and colonist kind
  let lane: LaneId;
  let colonistKind: 'soldier' | 'scientist' | undefined;
  let type: UnitType;

  if (raw.category === 'colonist') {
    lane = 'colonist';
    type = raw.id === 'soldier' ? 'soldier' : raw.id === 'scientist' ? 'scientist' : 'soldier';
    colonistKind = type as 'soldier' | 'scientist';
  } else {
    lane = 'ship';
    type = 'ship';
  }

  // Extract costs
  const costs: Costs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
    workers: raw.build_requirements.workers_occupied || 0,
    space: 0, // Ships don't have space cost in the data
  };

  for (const cost of raw.cost) {
    if (cost.type === 'resource') {
      if (cost.id in costs) {
        costs[cost.id as keyof Costs] = cost.amount;
      }
    }
  }

  // Extract prerequisites
  const prerequisites: string[] = raw.requirements.map((req) => req.id);

  // Convert to ItemDefinition
  const def: ItemDefinition = {
    id: raw.id,
    name: raw.name,
    lane,
    type,
    tier: raw.tier,
    durationTurns: raw.build_time_turns,
    costsPerUnit: costs,
    effectsOnComplete: {}, // Units don't have effects in the data
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
    }, // Units don't have upkeep
    colonistKind,
    isAbundanceScaled: false, // Units don't have abundance-scaled production
    prerequisites,
  };

  return def;
}

/**
 * Convert raw structure to ItemDefinition
 */
function convertStructure(raw: RawStructure): ItemDefinition {
  const lane: LaneId = 'building';
  const type: UnitType = 'structure';

  // Extract costs
  const costs: Costs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
    workers: raw.build_requirements.workers_occupied || 0,
    space: 0,
  };

  for (const cost of raw.cost) {
    if (cost.type === 'resource') {
      if (cost.id in costs) {
        costs[cost.id as keyof Costs] = cost.amount;
      }
    }
  }

  // Extract space cost
  if (raw.build_requirements.space_cost) {
    for (const spaceCost of raw.build_requirements.space_cost) {
      if (spaceCost.type === 'ground_space') {
        costs.space = spaceCost.amount;
      } else if (spaceCost.type === 'orbital_space') {
        costs.space = spaceCost.amount; // Note: we don't differentiate in engine yet
      }
    }
  }

  // Extract effects (housing, space caps)
  const effects: Effects = {};

  if (raw.operations?.effects) {
    for (const effect of raw.operations.effects) {
      if (effect.type === 'PROVIDE_HOUSING') {
        if (effect.category === 'worker') {
          effects.housing_worker_cap = effect.amount || 0;
        } else if (effect.category === 'soldier') {
          effects.housing_soldier_cap = effect.amount || 0;
        } else if (effect.category === 'scientist') {
          effects.housing_scientist_cap = effect.amount || 0;
        }
      } else if (effect.type === 'PROVIDE_SPACE') {
        const spaceType = (effect as any).space_type; // Game data uses space_type, not category
        if (spaceType === 'ground') {
          effects.space_ground_cap = effect.amount || 0;
        } else if (spaceType === 'orbital') {
          effects.space_orbital_cap = effect.amount || 0;
        }
      }
    }
  }

  // Extract production
  let hasAbundanceScaledProduction = false;

  if (raw.operations?.production) {
    for (const prod of raw.operations.production) {
      const key = `production_${prod.type}` as keyof Effects;
      effects[key] = prod.base_amount;
      if (prod.is_abundance_scaled) {
        hasAbundanceScaledProduction = true;
      }
    }
  }

  // Extract upkeep (consumption)
  const upkeep: Upkeep = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
  };

  if (raw.operations?.consumption) {
    for (const cons of raw.operations.consumption) {
      if (cons.type === 'resource' && cons.id) {
        if (cons.id in upkeep) {
          upkeep[cons.id as keyof Upkeep] = cons.amount || 0;
        }
      }
    }
  }

  // Extract prerequisites
  const prerequisites: string[] = raw.requirements.map((req) => req.id);

  // Convert to ItemDefinition
  const def: ItemDefinition = {
    id: raw.id,
    name: raw.name,
    lane,
    type,
    tier: raw.tier,
    durationTurns: raw.build_time_turns,
    costsPerUnit: costs,
    effectsOnComplete: effects,
    upkeepPerUnit: upkeep,
    isAbundanceScaled: hasAbundanceScaledProduction,
    prerequisites,
  };

  return def;
}

/**
 * Convert raw research to ItemDefinition
 */
function convertResearch(raw: RawResearch): ItemDefinition {
  const lane: LaneId = 'research';
  const type: UnitType = 'structure'; // Research is treated as a special structure type

  // Extract costs - research only costs RP
  const costs: Costs = {
    metal: 0,
    mineral: 0,
    food: 0,
    energy: 0,
    research_points: 0,
    workers: 0, // Research doesn't require workers
    space: 0, // Research doesn't use space
  };

  // Extract RP cost from the cost array
  for (const cost of raw.cost) {
    if (cost.type === 'resource' && cost.id === 'research_points') {
      costs.research_points = cost.amount;
    }
  }

  // Extract effects from operations
  const effects: Effects = {};
  if (raw.operations) {
    for (const op of raw.operations) {
      if (op.type === 'on_complete') {
        if (op.effect === 'set_planet_limit') {
          effects.planet_limit = op.value;
        } else if (op.effect === 'unlock_research') {
          effects.unlocks_research = op.items;
        } else if (op.effect === 'unlock_structure') {
          effects.unlocks_structure = op.item;
        } else if (op.effect === 'unlock_unit') {
          effects.unlocks_unit = op.item;
        }
      }
    }
  }

  // Use requirements as prerequisites
  const prerequisites: string[] = raw.requirements || [];

  const def: ItemDefinition = {
    id: raw.id,
    name: raw.name,
    lane,
    type,
    tier: raw.tier,
    durationTurns: raw.build_time_turns,
    costsPerUnit: costs,
    effectsOnComplete: effects,
    upkeepPerUnit: {
      metal: 0,
      mineral: 0,
      food: 0,
      energy: 0,
    }, // Research has no upkeep
    isAbundanceScaled: false,
    prerequisites,
  };

  return def;
}

/**
 * Load and convert game data JSON to ItemDefinition map
 */
export function loadGameData(gameData: RawGameData): Record<string, ItemDefinition> {
  const defs: Record<string, ItemDefinition> = {};

  // Convert units
  for (const unit of gameData.units) {
    const def = convertUnit(unit);
    defs[def.id] = def;
  }

  // Convert structures
  for (const structure of gameData.structures) {
    const def = convertStructure(structure);
    defs[def.id] = def;
  }

  // Convert research (if present)
  if (gameData.research) {
    for (const research of gameData.research) {
      const def = convertResearch(research);
      defs[def.id] = def;
    }
  }

  return defs;
}

/**
 * Load game data from JSON file path (for Node.js environments)
 */
export async function loadGameDataFromFile(filePath: string): Promise<Record<string, ItemDefinition>> {
  const fs = await import('fs/promises');
  const rawData = await fs.readFile(filePath, 'utf-8');
  const gameData: RawGameData = JSON.parse(rawData);
  return loadGameData(gameData);
}
