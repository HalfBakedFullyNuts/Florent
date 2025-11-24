/**
 * Core domain types for the turn-based simulation engine
 * All types are framework-free and designed for deterministic simulation
 */

// ============================================================================
// Resource & Lane Types
// ============================================================================

export type ResourceId = 'metal' | 'mineral' | 'food' | 'energy' | 'research_points';
export type LaneId = 'building' | 'ship' | 'colonist' | 'research';
export type UnitType = 'structure' | 'ship' | 'soldier' | 'scientist';
export type Status = 'pending' | 'active' | 'completed';

// ============================================================================
// Item Definitions (from game_data.json)
// ============================================================================

export interface Costs {
  metal: number;
  mineral: number;
  food: number;
  energy: number;
  research_points: number; // Research points cost
  workers: number; // Workers to reserve during construction
  space: number; // Ground or orbital space (determined by type)
}

export interface Effects {
  // Production per turn
  production_metal?: number;
  production_mineral?: number;
  production_food?: number;
  production_energy?: number;
  production_research_points?: number;

  // Housing capacity deltas
  housing_worker_cap?: number;
  housing_soldier_cap?: number;
  housing_scientist_cap?: number;

  // Space capacity deltas
  space_ground_cap?: number;
  space_orbital_cap?: number;

  // Research effects
  planet_limit?: number; // Increases planet limit (for PL research)
  unlocks_research?: string[]; // Enables other research
  unlocks_structure?: string; // Enables a structure
  unlocks_unit?: string; // Enables a unit
}

export interface Upkeep {
  metal: number;
  mineral: number;
  food: number;
  energy: number;
  research_points: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  lane: LaneId;
  type: UnitType;
  tier: number;
  durationTurns: number;
  costsPerUnit: Costs;
  effectsOnComplete: Effects;
  upkeepPerUnit: Upkeep;
  colonistKind?: 'soldier' | 'scientist';
  isAbundanceScaled?: boolean;
  prerequisites: string[]; // structure IDs required
  maxPerPlanet?: number | null; // Maximum allowed per planet (1 = unique building)
}

// ============================================================================
// Work Items (Queue Entries)
// ============================================================================

export interface WorkItem {
  id: string; // unique identifier
  itemId: string; // references ItemDefinition (or '__wait__' for wait items)
  status: Status;
  quantity: number; // final quantity after clamping
  turnsRemaining: number;
  queuedTurn?: number; // Turn when item was queued
  startTurn?: number; // Turn when work started (set when activated)
  completionTurn?: number; // Turn when work completed (set when finished)
  isWait?: boolean; // True for wait items (pauses lane for N turns)
}

// ============================================================================
// Lane State
// ============================================================================

export interface LaneState {
  pendingQueue: WorkItem[]; // Queue of pending items (max 10)
  active: WorkItem | null;
  completionHistory: WorkItem[]; // Completed items for visual history
  maxQueueDepth: number; // Default: 10
}

// ============================================================================
// Planet State
// ============================================================================

export interface PlanetState {
  currentTurn: number;

  // Resources
  stocks: Record<ResourceId, number>;
  abundance: Record<ResourceId, number>; // 0.0 to 2.0 (0% to 200%)

  // Population
  population: {
    workersTotal: number;
    workersIdle: number;
    soldiers: number;
    scientists: number;
    busyByLane: Record<LaneId, number>;
  };

  // Space
  space: {
    groundUsed: number;
    groundCap: number;
    orbitalUsed: number;
    orbitalCap: number;
  };

  // Housing
  housing: {
    workerCap: number;
    soldierCap: number;
    scientistCap: number;
  };

  // Research & Limits
  planetLimit: number; // Maximum planets allowed (starts at 4, increased by research)
  completedResearch: string[]; // List of completed research IDs

  // Production queues
  lanes: Record<LaneId, LaneState>;

  // Completed structures/ships counts
  completedCounts: Record<string, number>; // defId -> count

  // Pending colonist conversions (handled in same turn)
  pendingColonistConversions: WorkItem[];

  // Item definitions catalog
  defs: Record<string, ItemDefinition>;
}

// ============================================================================
// Validation Results
// ============================================================================

export type CanQueueReason =
  | 'REQ_MISSING'
  | 'HOUSING_MISSING'
  | 'ENERGY_INSUFFICIENT'
  | 'PLANET_LIMIT_REACHED';

export interface CanQueueResult {
  allowed: boolean;
  reason?: CanQueueReason;
  message?: string;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface NetOutputs {
  metal: number;
  mineral: number;
  food: number;
  energy: number;
  research_points: number;
}

export interface GrowthCalculation {
  baseRate: number;
  bonusRate: number;
  totalRate: number;
  growthAmount: number;
}
