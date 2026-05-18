/**
 * Multi-planet game state management
 */

import { PlanetState, LaneState, ItemDefinition, LaneId, WorkItem } from '../sim/engine/types';
import { createStandardStart, createInitialState } from '../sim/defs/seed';
import { loadGameData } from '../sim/defs/adapter.client';
import gameDataJson from './game_data.json';
import { Timeline } from './state';
import { getPlanetLimitAtTurn, getResearchCompletionTurns } from './globalResearch';
import { tryActivateNext } from '../sim/engine/lanes';
import {
  STARTER_PACKAGE,
  STARTING_STRUCTURE_IDS,
  type PlanetStartingSettings,
  normalizePlanetStarting,
} from '../constants/planet';
import {
  DEFAULT_EXPANSION_TRAVEL_CHOICE,
  type ExpansionTravelChoice,
  getExpansionTravelTime,
} from '../constants/travel';

// ============================================================================
// Types
// ============================================================================

export interface PlanetExpansionConfig {
  travelChoice: ExpansionTravelChoice;
  sourcePlanetIndex?: number;
  departureTurn?: number;
}

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
  expansion?: PlanetExpansionConfig;
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
  expansion?: PlanetExpansionConfig;
  timeline?: Timeline;  // Each planet has its own timeline
}

// Load definitions once
const itemDefinitions: Record<string, ItemDefinition> = loadGameData(gameDataJson as any);
const PLANET_LANES: LaneId[] = ['building', 'ship', 'colonist', 'research'];
const BASE_PLANET_LIMIT = 4;
const OUTPOST_SHIP_ID = 'outpost_ship';
const RESERVED_OUTPOST_SHIPS = 1; // HW keeps 1 reserved; non-HW planets reserve 0

function getReservedOutpostShipCount(planet: ExtendedPlanetState): number {
  return planet.id === 'planet-1' ? RESERVED_OUTPOST_SHIPS : 0;
}

export interface LocalResearchGateOptions {
  completedResearch: string[];
  scheduledResearch: string[];
  blockedResearch: string[];
  minStartTurn?: number;
}

export function createInitialGlobalResearchState(): GameState['globalResearch'] {
  return {
    stock: 0,
    lane: {
      pendingQueue: [],
      active: null,
      completionHistory: [],
      maxQueueDepth: 9999,
    },
    completed: [],
  };
}

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

function getCompletedResearchAtTurnFromPlan(
  gameState: GameState,
  completionTurns: Map<string, number>,
  turn: number
): string[] {
  return Array.from(new Set([
    ...(gameState.globalResearch.completed || []),
    ...Array.from(completionTurns.entries())
      .filter(([, completionTurn]) => completionTurn <= turn)
      .map(([id]) => id),
  ]));
}

function getResearchPrereqs(
  def: ItemDefinition | undefined,
  defs: Record<string, ItemDefinition>
): string[] {
  return (def?.prerequisites || []).filter((id) => defs[id]?.lane === 'research');
}

function getLocalResearchGateForItemWithPlan(
  gameState: GameState,
  itemId: string,
  atTurn: number,
  defs: Record<string, ItemDefinition>,
  completionTurns: Map<string, number>
): LocalResearchGateOptions {
  const completedResearch = getCompletedResearchAtTurnFromPlan(gameState, completionTurns, atTurn);
  const completedSet = new Set(completedResearch);
  const researchPrereqs = getResearchPrereqs(defs[itemId], defs);
  const scheduledResearch: string[] = [];
  const blockedResearch: string[] = [];
  let minStartTurn: number | undefined;

  for (const prereqId of researchPrereqs) {
    if (completedSet.has(prereqId)) continue;

    const completionTurn = completionTurns.get(prereqId);
    if (completionTurn !== undefined) {
      scheduledResearch.push(prereqId);
      minStartTurn = Math.max(minStartTurn ?? atTurn, completionTurn);
    } else {
      blockedResearch.push(prereqId);
    }
  }

  return {
    completedResearch,
    scheduledResearch,
    blockedResearch,
    minStartTurn,
  };
}

export function getLocalResearchGateForItem(
  gameState: GameState,
  itemId: string,
  atTurn: number,
  defs: Record<string, ItemDefinition> = itemDefinitions,
  completionTurns: Map<string, number> = getResearchCompletionTurns(gameState)
): LocalResearchGateOptions {
  return getLocalResearchGateForItemWithPlan(
    gameState,
    itemId,
    atTurn,
    defs,
    completionTurns
  );
}

function refreshWorkItemResearchGate(
  gameState: GameState,
  item: WorkItem,
  startTurn: number,
  defs: Record<string, ItemDefinition>,
  completionTurns: Map<string, number>
): WorkItem {
  if (item.isWait || item.itemId === '__wait__') {
    return {
      ...item,
      minStartTurn: undefined,
      scheduledResearch: undefined,
      blockedResearch: undefined,
    };
  }

  if (getResearchPrereqs(defs[item.itemId], defs).length === 0) {
    return {
      ...item,
      minStartTurn: undefined,
      scheduledResearch: undefined,
      blockedResearch: undefined,
    };
  }

  const gate = getLocalResearchGateForItemWithPlan(
    gameState,
    item.itemId,
    startTurn,
    defs,
    completionTurns
  );

  return {
    ...item,
    minStartTurn: gate.scheduledResearch.length > 0 ? gate.minStartTurn : undefined,
    scheduledResearch: gate.scheduledResearch.length > 0 ? gate.scheduledResearch : undefined,
    blockedResearch: gate.blockedResearch.length > 0 ? gate.blockedResearch : undefined,
  };
}

function refreshLanePlansResearchGates(
  gameState: GameState,
  lanePlans: Record<LaneId, WorkItem[]>,
  startTurn: number,
  defs: Record<string, ItemDefinition>,
  completionTurns: Map<string, number>
): Record<LaneId, WorkItem[]> {
  return PLANET_LANES.reduce((plans, laneId) => {
    plans[laneId] = lanePlans[laneId].map((item) =>
      refreshWorkItemResearchGate(gameState, item, startTurn, defs, completionTurns)
    );
    return plans;
  }, {} as Record<LaneId, WorkItem[]>);
}

function getPlanetConfigFromInitialState(planet: ExtendedPlanetState): PlanetConfig {
  const initialState = planet.timeline?.getStateAtTurn(planet.startTurn) ?? planet;
  return {
    name: planet.name,
    startTurn: planet.startTurn,
    abundance: {
      metal: initialState.abundance.metal,
      mineral: initialState.abundance.mineral,
      food: initialState.abundance.food,
      energy: initialState.abundance.energy,
      research_points: initialState.abundance.research_points,
    },
    space: {
      groundCap: initialState.space.groundCap,
      orbitalCap: initialState.space.orbitalCap,
    },
    starting: {
      workersTotal: initialState.population.workersTotal,
      structures: STARTING_STRUCTURE_IDS.reduce((structures, structureId) => {
        structures[structureId] = initialState.completedCounts[structureId] ?? 0;
        return structures;
      }, {} as PlanetStartingSettings['structures']),
    },
    expansion: planet.expansion,
  };
}

function createCleanPlanetBase(planet: ExtendedPlanetState): ExtendedPlanetState {
  const defs = planet.defs || itemDefinitions;
  const base = planet.id === 'planet-1'
    ? createStandardStart(defs)
    : createInitialState(defs, createStarterConfig(getPlanetConfigFromInitialState(planet)));

  const extended = base as ExtendedPlanetState;
  extended.id = planet.id;
  extended.name = planet.name;
  extended.startTurn = planet.startTurn;
  extended.currentTurn = planet.startTurn;
  extended.expansion = planet.expansion;
  return extended;
}

function withPlanetMetadata(
  snapshot: PlanetState,
  existing: ExtendedPlanetState
): ExtendedPlanetState {
  return {
    ...snapshot,
    id: existing.id,
    name: existing.name,
    startTurn: existing.startTurn,
    currentTurn: snapshot.currentTurn ?? existing.currentTurn,
    expansion: existing.expansion,
    timeline: existing.timeline,
  } as ExtendedPlanetState;
}

function getPlanetIdByIndex(
  gameState: GameState,
  planetIndex: number
): string | undefined {
  return Array.from(gameState.planets.keys())[planetIndex];
}

function getPlanetIndexById(gameState: GameState, planetId: string): number {
  return Array.from(gameState.planets.keys()).indexOf(planetId);
}

function getPlanetTimelineEndTurn(planet: ExtendedPlanetState): number {
  const totalTurns = planet.timeline?.getTotalTurns() ?? 200;
  return planet.startTurn + totalTurns - 1;
}

export function getFirstUsableOutpostShipTurn(
  gameState: GameState,
  sourcePlanetId: string,
  fromTurn: number = 1
): number | null {
  const sourcePlanet = gameState.planets.get(sourcePlanetId);
  if (!sourcePlanet) return null;

  const startTurn = Math.max(sourcePlanet.startTurn, Math.floor(fromTurn));
  const endTurn = getPlanetTimelineEndTurn(sourcePlanet);

  const reserved = getReservedOutpostShipCount(sourcePlanet);
  for (let turn = startTurn; turn <= endTurn; turn++) {
    const state = sourcePlanet.timeline?.getStateAtTurn(turn) ?? sourcePlanet;
    const outpostShips = state.completedCounts?.[OUTPOST_SHIP_ID] ?? 0;
    if (outpostShips > reserved) {
      return turn;
    }
  }

  return null;
}

export interface PlanetExpansionPlan {
  config: PlanetConfig;
  sourcePlanetId: string;
  departureTurn: number;
  arrivalTurn: number;
  travelTime: number;
}

export function planPlanetExpansion(
  gameState: GameState,
  config: PlanetConfig,
  sourcePlanetId: string = gameState.currentPlanetId
): PlanetExpansionPlan {
  const expansion = config.expansion;
  if (!expansion) {
    throw new Error('Expansion travel choice is required');
  }

  const travelChoice =
    expansion.travelChoice ?? DEFAULT_EXPANSION_TRAVEL_CHOICE;
  const travelTime = getExpansionTravelTime(travelChoice);
  const resolvedSourcePlanetId =
    expansion.sourcePlanetIndex !== undefined
      ? getPlanetIdByIndex(gameState, expansion.sourcePlanetIndex)
      : sourcePlanetId;

  if (!resolvedSourcePlanetId || !gameState.planets.has(resolvedSourcePlanetId)) {
    throw new Error('Expansion source planet is unavailable');
  }

  const sourcePlanetIndex = getPlanetIndexById(gameState, resolvedSourcePlanetId);
  const desiredDepartureTurn = Math.max(1, config.startTurn - travelTime);
  const departureTurn =
    expansion.departureTurn ??
    getFirstUsableOutpostShipTurn(
      gameState,
      resolvedSourcePlanetId,
      desiredDepartureTurn
    );

  if (departureTurn === null) {
    throw new Error(
      'No usable outpost ship is available. Build an Outpost Ship first; the starter ship is reserved.'
    );
  }

  const sourceState =
    gameState.planets
      .get(resolvedSourcePlanetId)
      ?.timeline?.getStateAtTurn(departureTurn) ??
    gameState.planets.get(resolvedSourcePlanetId);
  const sourcePlanetForReserved = gameState.planets.get(resolvedSourcePlanetId);
  const reserved = sourcePlanetForReserved
    ? getReservedOutpostShipCount(sourcePlanetForReserved)
    : RESERVED_OUTPOST_SHIPS;
  const outpostShips = sourceState?.completedCounts?.[OUTPOST_SHIP_ID] ?? 0;
  if (outpostShips <= reserved) {
    throw new Error(
      `No usable outpost ship is available on turn ${departureTurn}.`
    );
  }

  const arrivalTurn = Math.max(config.startTurn, departureTurn + travelTime);

  return {
    config: {
      ...config,
      startTurn: arrivalTurn,
      expansion: {
        travelChoice,
        sourcePlanetIndex,
        departureTurn,
      },
    },
    sourcePlanetId: resolvedSourcePlanetId,
    departureTurn,
    arrivalTurn,
    travelTime,
  };
}

function consumeOutpostShip(
  gameState: GameState,
  sourcePlanetId: string,
  departureTurn: number
): GameState {
  const sourcePlanet = gameState.planets.get(sourcePlanetId);
  if (!sourcePlanet?.timeline) {
    throw new Error('Expansion source planet timeline is unavailable');
  }

  const reserved = getReservedOutpostShipCount(sourcePlanet);
  const departureState = sourcePlanet.timeline.getStateAtTurn(departureTurn);
  const outpostShips = departureState?.completedCounts?.[OUTPOST_SHIP_ID] ?? 0;
  if (outpostShips <= reserved) {
    throw new Error(
      `No usable outpost ship is available on turn ${departureTurn}.`
    );
  }

  const consumed = sourcePlanet.timeline.mutateAtTurn(departureTurn, (state) => {
    const current = state.completedCounts[OUTPOST_SHIP_ID] ?? 0;
    state.completedCounts[OUTPOST_SHIP_ID] = Math.max(0, current - 1);
    if (state.completedCounts[OUTPOST_SHIP_ID] === 0) {
      delete state.completedCounts[OUTPOST_SHIP_ID];
    }
  });

  if (!consumed) {
    throw new Error(`Unable to consume outpost ship on turn ${departureTurn}`);
  }

  const currentTurn = sourcePlanet.currentTurn ?? sourcePlanet.startTurn;
  const currentSnapshot =
    sourcePlanet.timeline.getStateAtTurn(currentTurn) ?? sourcePlanet;
  const refreshedSource = withPlanetMetadata(currentSnapshot, sourcePlanet);
  const planets = new Map(gameState.planets);
  planets.set(sourcePlanetId, refreshedSource);

  return {
    ...gameState,
    planets,
  };
}

function reapplyExpansionConsumptions(gameState: GameState): GameState {
  let nextState = gameState;

  for (const planet of gameState.planets.values()) {
    const expansion = planet.expansion;
    if (
      expansion?.sourcePlanetIndex === undefined ||
      expansion.departureTurn === undefined
    ) {
      continue;
    }

    const sourcePlanetId = getPlanetIdByIndex(
      nextState,
      expansion.sourcePlanetIndex
    );
    if (!sourcePlanetId) continue;
    nextState = consumeOutpostShip(
      nextState,
      sourcePlanetId,
      expansion.departureTurn
    );
  }

  return nextState;
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
    globalResearch: createInitialGlobalResearchState(),
    nextPlanetId: 2,
    maxPlanets: 4,
  };
}

/**
 * Add a new planet to the game
 */
export function addPlanet(gameState: GameState, config: PlanetConfig): GameState {
  let workingGameState = gameState;
  let effectiveConfig = config;
  let expansionPlan: PlanetExpansionPlan | null = null;

  if (config.expansion) {
    expansionPlan = planPlanetExpansion(
      workingGameState,
      config,
      workingGameState.currentPlanetId
    );
    effectiveConfig = expansionPlan.config;
  }

  const requestedPlanetNumber = workingGameState.planets.size + 1;
  if (requestedPlanetNumber > BASE_PLANET_LIMIT) {
    const effectiveLimit = getPlanetLimitAtTurn(
      workingGameState,
      effectiveConfig.startTurn
    );
    if (requestedPlanetNumber > effectiveLimit) {
      throw new Error(`Maximum planet limit reached for turn ${effectiveConfig.startTurn}`);
    }
  }

  if (expansionPlan) {
    workingGameState = consumeOutpostShip(
      workingGameState,
      expansionPlan.sourcePlanetId,
      expansionPlan.departureTurn
    );
  }

  const planetId = `planet-${workingGameState.nextPlanetId}`;

  // Create planet with starter configuration
  const starterConfig = createStarterConfig(effectiveConfig);

  const newPlanet = createInitialState(itemDefinitions, starterConfig) as ExtendedPlanetState;

  // Set extended fields
  newPlanet.id = planetId;
  newPlanet.name = effectiveConfig.name;
  newPlanet.startTurn = effectiveConfig.startTurn;
  newPlanet.currentTurn = effectiveConfig.startTurn;
  newPlanet.expansion = effectiveConfig.expansion;
  newPlanet.completedResearch = getCompletedResearchAtTurnFromPlan(
    workingGameState,
    getResearchCompletionTurns(workingGameState),
    effectiveConfig.startTurn
  );

  // Keep research lane but empty (for compatibility with turn engine)
  // Research is handled globally but we need the lane structure

  // Create timeline for new planet (completely lazy - computes on-demand)
  newPlanet.timeline = new Timeline(newPlanet);

  // Create new game state with added planet
  const newPlanets = new Map(workingGameState.planets);
  newPlanets.set(planetId, newPlanet);

  return {
    ...workingGameState,
    planets: newPlanets,
    nextPlanetId: workingGameState.nextPlanetId + 1,
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
  if (planetNumber > BASE_PLANET_LIMIT) {
    const effectiveLimit = getPlanetLimitAtTurn(gameState, config.startTurn);
    if (planetNumber > effectiveLimit) {
      throw new Error(`Maximum planet limit reached for turn ${config.startTurn}`);
    }
  }

  const lanePlans = getInitialLanePlans(planet);
  const updatedPlanet = createInitialState(itemDefinitions, createStarterConfig(config)) as ExtendedPlanetState;
  const completionTurns = getResearchCompletionTurns(gameState);
  updatedPlanet.id = planet.id;
  updatedPlanet.name = config.name;
  updatedPlanet.startTurn = config.startTurn;
  updatedPlanet.currentTurn = config.startTurn;
  updatedPlanet.expansion = config.expansion ?? planet.expansion;
  updatedPlanet.completedResearch = getCompletedResearchAtTurnFromPlan(gameState, completionTurns, config.startTurn);
  applyLanePlans(
    updatedPlanet,
    refreshLanePlansResearchGates(gameState, lanePlans, config.startTurn, updatedPlanet.defs, completionTurns),
    config.startTurn
  );
  updatedPlanet.timeline = new Timeline(updatedPlanet);

  const newPlanets = new Map(gameState.planets);
  newPlanets.set(planetId, updatedPlanet);
  return {
    ...gameState,
    planets: newPlanets,
    currentPlanetId: planetId,
  };
}

export function refreshLocalResearchGates(gameState: GameState): GameState {
  const completionTurns = getResearchCompletionTurns(gameState);
  const newPlanets = new Map<string, ExtendedPlanetState>();

  for (const [planetId, planet] of gameState.planets.entries()) {
    const lanePlans = getInitialLanePlans(planet);
    const refreshedStart = createCleanPlanetBase(planet);
    refreshedStart.completedResearch = getCompletedResearchAtTurnFromPlan(
      gameState,
      completionTurns,
      planet.startTurn
    );

    applyLanePlans(
      refreshedStart,
      refreshLanePlansResearchGates(
        gameState,
        lanePlans,
        planet.startTurn,
        refreshedStart.defs,
        completionTurns
      ),
      planet.startTurn
    );

    const timeline = new Timeline(refreshedStart);
    const currentTurn = planet.currentTurn ?? planet.startTurn;
    const currentSnapshot = timeline.getStateAtTurn(currentTurn) ?? refreshedStart;
    const refreshedPlanet = {
      ...currentSnapshot,
      id: planet.id,
      name: planet.name,
      startTurn: planet.startTurn,
      currentTurn,
      expansion: planet.expansion,
      timeline,
    } as ExtendedPlanetState;

    newPlanets.set(planetId, refreshedPlanet);
  }

  return reapplyExpansionConsumptions({
    ...gameState,
    planets: newPlanets,
  });
}

/**
 * Returns a reason string if the planet cannot be removed, or null if it can.
 */
export function canRemovePlanet(gameState: GameState, planetId: string): string | null {
  if (planetId === 'planet-1') return 'The homeworld cannot be removed.';
  if (!gameState.planets.has(planetId)) return 'Planet not found.';

  const planetKeys = Array.from(gameState.planets.keys());
  const planetIdx = planetKeys.indexOf(planetId);

  for (const [otherId, other] of gameState.planets.entries()) {
    if (otherId === planetId) continue;
    if (other.expansion?.sourcePlanetIndex === planetIdx) {
      return `Cannot remove: ${other.name} was colonised from this planet.`;
    }
  }
  return null;
}

/**
 * Remove a planet from the game. Automatically returns the outpost ship used
 * to colonise it by rebuilding timelines without that expansion.
 */
export function removePlanet(gameState: GameState, planetId: string): GameState {
  const blockReason = canRemovePlanet(gameState, planetId);
  if (blockReason) throw new Error(blockReason);

  const newPlanets = new Map(gameState.planets);
  newPlanets.delete(planetId);

  const currentPlanetId = gameState.currentPlanetId === planetId
    ? 'planet-1'
    : gameState.currentPlanetId;

  // refreshLocalResearchGates rebuilds timelines and re-applies reapplyExpansionConsumptions
  // only for surviving planets, which automatically returns the outpost ship.
  return refreshLocalResearchGates({
    ...gameState,
    planets: newPlanets,
    currentPlanetId,
  });
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
    globalResearch: createInitialGlobalResearchState(),
    nextPlanetId: 2,
  };
}
