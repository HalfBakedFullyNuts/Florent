/**
 * Multi-planet game state management
 */

import { PlanetState, LaneState, ItemDefinition, LaneId, WorkItem } from '../sim/engine/types';
import { createStandardStart, createInitialState } from '../sim/defs/seed';
import { loadGameData } from '../sim/defs/adapter.client';
import gameDataJson from './game_data.json';
import { Timeline } from './state';
import { getPlanetLimitAtTurn } from './globalResearch';
import { tryActivateNext } from '../sim/engine/lanes';
import {
  STARTER_PACKAGE,
  STARTING_STRUCTURE_IDS,
  type PlanetStartingSettings,
  normalizePlanetStarting,
} from '../constants/planet';

// ============================================================================
// Types
// ============================================================================

export interface PlanetConfig {
  name: string;
  startTurn: number;
  abundance: {
    metal: number;
    mineral: number;
    food: number;
    energy: number;
    research_points: number;
  };
  space: {
    groundCap: number;
    orbitalCap: number;
  };
  starting?: PlanetStartingSettings;
}

export interface GameState {
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  globalResearch: {
    stock: number;
    lane: LaneState;
    completed: string[];
  };
  nextPlanetId: number;
  maxPlanets: number;
}

// Extended PlanetState with additional fields
export interface ExtendedPlanetState extends PlanetState {
  id: string;
  name: string;
  startTurn: number;
  timeline?: Timeline;  // Each planet has its own timeline
}

// Load definitions once
const itemDefinitions: Record<string, ItemDefinition> = loadGameData(gameDataJson as any);
const PLANET_LANES: LaneId[] = ['building', 'ship', 'colonist', 'research'];

function createStarterConfig(config: PlanetConfig) {
  const starting = normalizePlanetStarting(config.starting);
  const structures: Record<string, number> = { outpost: 1 };

  for (const structureId of STARTING_STRUCTURE_IDS) {
    const count = starting.structures[structureId];
    if (count > 0) {
      structures[structureId] = count;
    }
  }

  return {
    stocks: {
      metal: STARTER_PACKAGE.METAL,
      mineral: STARTER_PACKAGE.MINERAL,
      food: STARTER_PACKAGE.FOOD,
      energy: STARTER_PACKAGE.ENERGY,
    },
    abundance: {
      metal: config.abundance.metal,
      mineral: config.abundance.mineral,
      food: config.abundance.food,
      energy: config.abundance.energy,
    },
    population: {
      workersTotal: starting.workersTotal,
      soldiers: 0,
      scientists: 0,
    },
    space: {
      groundCap: config.space.groundCap,
      orbitalCap: config.space.orbitalCap,
    },
    structures,
  };
}

function resetWorkItemForStart(
  item: WorkItem,
  startTurn: number,
  defs: Record<string, ItemDefinition>
): WorkItem {
  const def = defs[item.itemId];
  return {
    ...item,
    status: 'pending',
    turnsRemaining: item.isWait ? item.turnsRemaining : def?.durationTurns ?? item.turnsRemaining,
    queuedTurn: startTurn,
    startTurn: undefined,
    completionTurn: undefined,
  };
}

function getInitialLanePlans(planet: ExtendedPlanetState): Record<LaneId, WorkItem[]> {
  const initialState = planet.timeline?.getStateAtTurn(planet.startTurn) ?? planet;
  return PLANET_LANES.reduce((plans, laneId) => {
    const lane = initialState.lanes[laneId];
    plans[laneId] = [
      ...(lane.active ? [lane.active] : []),
      ...lane.pendingQueue,
    ];
    return plans;
  }, {} as Record<LaneId, WorkItem[]>);
}

function applyLanePlans(
  planet: ExtendedPlanetState,
  lanePlans: Record<LaneId, WorkItem[]>,
  startTurn: number
): void {
  for (const laneId of PLANET_LANES) {
    const lane = planet.lanes[laneId];
    lane.pendingQueue = [];
    lane.active = null;
    lane.completionHistory = [];

    for (const item of lanePlans[laneId]) {
      lane.pendingQueue.push(resetWorkItemForStart(item, startTurn, planet.defs));
      tryActivateNext(planet, laneId);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create initial game state with homeworld
 */
export function createInitialGameState(): GameState {
  const homeworld = createStandardStart(itemDefinitions) as ExtendedPlanetState;

  // Add extended fields
  homeworld.id = 'planet-1';
  homeworld.name = 'Homeworld';
  homeworld.startTurn = 1;

  // Keep research lane but empty (for compatibility with turn engine)
  // Research is handled globally but we need the lane structure

  // Create timeline for homeworld (completely lazy - computes on-demand)
  homeworld.timeline = new Timeline(homeworld);

  const planets = new Map<string, ExtendedPlanetState>();
  planets.set('planet-1', homeworld);

  return {
    planets,
    currentPlanetId: 'planet-1',
    globalResearch: {
      stock: 0,
      lane: {
        pendingQueue: [],
        active: null,
        completionHistory: [],
        maxQueueDepth: 9999,
      },
      completed: [],
    },
    nextPlanetId: 2,
    maxPlanets: 4,
  };
}

/**
 * Add a new planet to the game
 */
export function addPlanet(gameState: GameState, config: PlanetConfig): GameState {
  const requestedPlanetNumber = gameState.planets.size + 1;
  const effectiveLimit = getPlanetLimitAtTurn(gameState, config.startTurn);
  if (requestedPlanetNumber > effectiveLimit) {
    throw new Error(`Maximum planet limit reached for turn ${config.startTurn}`);
  }

  const planetId = `planet-${gameState.nextPlanetId}`;

  // Create planet with starter configuration
  const starterConfig = createStarterConfig(config);

  const newPlanet = createInitialState(itemDefinitions, starterConfig) as ExtendedPlanetState;

  // Set extended fields
  newPlanet.id = planetId;
  newPlanet.name = config.name;
  newPlanet.startTurn = config.startTurn;
  newPlanet.currentTurn = config.startTurn;

  // Keep research lane but empty (for compatibility with turn engine)
  // Research is handled globally but we need the lane structure

  // Create timeline for new planet (completely lazy - computes on-demand)
  newPlanet.timeline = new Timeline(newPlanet);

  // Create new game state with added planet
  const newPlanets = new Map(gameState.planets);
  newPlanets.set(planetId, newPlanet);

  return {
    ...gameState,
    planets: newPlanets,
    nextPlanetId: gameState.nextPlanetId + 1,
  };
}

/**
 * Switch to a different planet
 */
export function switchPlanet(gameState: GameState, planetId: string): GameState {
  if (!gameState.planets.has(planetId)) {
    throw new Error(`Planet ${planetId} does not exist`);
  }

  return {
    ...gameState,
    currentPlanetId: planetId,
  };
}

/**
 * Get the current planet state
 */
export function getCurrentPlanet(gameState: GameState): ExtendedPlanetState {
  const planet = gameState.planets.get(gameState.currentPlanetId);
  if (!planet) {
    throw new Error(`Current planet ${gameState.currentPlanetId} not found`);
  }
  return planet;
}

/**
 * Check if any planet has research prerequisites (lab + scientists)
 */
export function hasResearchPrerequisites(gameState: GameState): boolean {
  for (const planet of gameState.planets.values()) {
    if (planet.completedCounts['research_lab'] > 0 && planet.population.scientists > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get total research points across all planets
 */
export function getTotalResearchPoints(gameState: GameState): number {
  return gameState.globalResearch.stock || 0;
}

export function updatePlanetConfig(
  gameState: GameState,
  planetId: string,
  config: PlanetConfig
): GameState {
  const planet = gameState.planets.get(planetId);
  if (!planet) {
    throw new Error(`Planet ${planetId} does not exist`);
  }
  if (planetId === 'planet-1') {
    throw new Error('Homeworld cannot be edited');
  }
  const planetNumber = Array.from(gameState.planets.keys()).indexOf(planetId) + 1;
  const effectiveLimit = getPlanetLimitAtTurn(gameState, config.startTurn);
  if (planetNumber > effectiveLimit) {
    throw new Error(`Maximum planet limit reached for turn ${config.startTurn}`);
  }

  const lanePlans = getInitialLanePlans(planet);
  const updatedPlanet = createInitialState(itemDefinitions, createStarterConfig(config)) as ExtendedPlanetState;
  updatedPlanet.id = planet.id;
  updatedPlanet.name = config.name;
  updatedPlanet.startTurn = config.startTurn;
  updatedPlanet.currentTurn = config.startTurn;
  applyLanePlans(updatedPlanet, lanePlans, config.startTurn);
  updatedPlanet.timeline = new Timeline(updatedPlanet);

  const newPlanets = new Map(gameState.planets);
  newPlanets.set(planetId, updatedPlanet);
  return {
    ...gameState,
    planets: newPlanets,
    currentPlanetId: planetId,
  };
}

export function resetToHomeworld(gameState: GameState): GameState {
  const homeworld = createStandardStart(itemDefinitions) as ExtendedPlanetState;
  homeworld.id = 'planet-1';
  homeworld.name = 'Homeworld';
  homeworld.startTurn = 1;
  homeworld.currentTurn = 1;
  homeworld.timeline = new Timeline(homeworld);

  return {
    ...gameState,
    planets: new Map([['planet-1', homeworld]]),
    currentPlanetId: 'planet-1',
    nextPlanetId: 2,
  };
}
