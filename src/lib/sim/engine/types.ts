/**
 * Core domain types for the turn-based simulation engine
 * All types are framework-free and designed for deterministic simulation
 */

// ============================================================================
// Resource & Lane Types
// ============================================================================

export type ResourceId = 'metal' | 'mineral' | 'food' | 'energy';
export type LaneId = 'building' | 'ship' | 'colonist';
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
  workers: number; // Workers to reserve during construction
  space: number; // Ground or orbital space (determined by type)
}

export interface Effects {
  // Production per turn
  production_metal?: number;
  production_mineral?: number;
  production_food?: number;
  production_energy?: number;

  // Housing capacity deltas
  housing_worker_cap?: number;
  housing_soldier_cap?: number;
  housing_scientist_cap?: number;

  // Space capacity deltas
  space_ground_cap?: number;
  space_orbital_cap?: number;
}

export interface Upkeep {
  metal: number;
  mineral: number;
  food: number;
  energy: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  lane: LaneId;
  type: UnitType;
  durationTurns: number;
  costsPerUnit: Costs;
  effectsOnComplete: Effects;
  upkeepPerUnit: Upkeep;
  colonistKind?: 'soldier' | 'scientist';
  isAbundanceScaled?: boolean;
  prerequisites: string[]; // structure IDs required
}

// ============================================================================
// Work Items (Queue Entries)
// ============================================================================

export interface WorkItem {
  id: string; // unique identifier
  itemId: string; // references ItemDefinition
  status: Status;
  quantity: number; // final quantity after clamping
  turnsRemaining: number;
}

// ============================================================================
// Lane State
// ============================================================================

export interface LaneState {
  pending: WorkItem | null;
  active: WorkItem | null;
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
  | 'ENERGY_INSUFFICIENT';

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
}

export interface GrowthCalculation {
  baseRate: number;
  bonusRate: number;
  totalRate: number;
  growthAmount: number;
}
