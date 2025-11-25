/**
 * Multi-planet game state management
 */

import { PlanetState, WorkItem, LaneId, ItemDefinition } from '../sim/engine/types';
import { createStandardStart, createInitialState } from '../sim/defs/seed';
import { loadGameData } from '../sim/defs/adapter.client';
import gameDataJson from './game_data.json';
import { Timeline } from './state';

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
}

export interface GameState {
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  globalResearch: {
    queue: WorkItem[];
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
      queue: [],
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
  if (gameState.planets.size >= gameState.maxPlanets) {
    throw new Error('Maximum planet limit reached');
  }

  const planetId = `planet-${gameState.nextPlanetId}`;

  // Create planet with starter configuration
  const starterConfig = {
    stocks: {
      metal: 6000,
      mineral: 4000,
      food: 2000,
      energy: 0,
    },
    abundance: config.abundance,
    population: {
      workersTotal: 5000,
      soldiers: 0,
      scientists: 0,
    },
    space: {
      groundCap: config.space.groundCap,
      orbitalCap: config.space.orbitalCap,
    },
    structures: {
      outpost: 1,
    },
  };

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
    if (planet.completedCounts['lab'] > 0 && planet.population.scientists > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get total research points across all planets
 */
export function getTotalResearchPoints(gameState: GameState): number {
  let total = 0;
  for (const planet of gameState.planets.values()) {
    total += planet.stocks.research_points || 0;
  }
  return total;
}