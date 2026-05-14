import { describe, test, expect } from 'vitest';
import {
  createInitialGameState,
  addPlanet,
  getFirstUsableOutpostShipTurn,
  planPlanetExpansion,
  resetToHomeworld,
  switchPlanet,
  updatePlanetConfig,
} from '../gameState';
import { CommandHistory, replayCommands } from '../urlState';
import { queueGlobalResearch } from '../globalResearch';

describe('Multi-Planet State Management', () => {
  test('creates game with initial planet', () => {
    const gameState = createInitialGameState();

    expect(gameState.planets.size).toBe(1);
    expect(gameState.currentPlanetId).toBe('planet-1');
    expect(gameState.globalResearch.stock).toBe(0);
    expect(gameState.globalResearch.lane.pendingQueue).toEqual([]);
    expect(gameState.globalResearch.completed).toEqual([]);
    expect(gameState.nextPlanetId).toBe(2);
    expect(gameState.maxPlanets).toBe(4);

    const firstPlanet = gameState.planets.get('planet-1');
    expect(firstPlanet).toBeDefined();
    expect(firstPlanet!.id).toBe('planet-1');
    expect(firstPlanet!.name).toBe('Homeworld');
    expect(firstPlanet!.startTurn).toBe(1);
    expect(firstPlanet!.completedCounts.outpost_ship).toBe(1);
    expect(getFirstUsableOutpostShipTurn(gameState, 'planet-1')).toBeNull();
  });

  test('plans expansion from the first usable outpost ship plus inside-galaxy travel time', () => {
    let gameState = createInitialGameState();
    const homeworld = gameState.planets.get('planet-1')!;
    homeworld.timeline!.mutateAtTurn(20, (state) => {
      state.completedCounts.outpost_ship = 2;
    });

    const planned = planPlanetExpansion(
      gameState,
      {
        name: 'Mars Colony',
        startTurn: 1,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 30, orbitalCap: 20 },
        expansion: { travelChoice: 'inside_galaxy' },
      },
      'planet-1'
    );

    expect(planned.departureTurn).toBe(20);
    expect(planned.arrivalTurn).toBe(36);

    gameState = addPlanet(gameState, planned.config);
    const colony = gameState.planets.get('planet-2')!;
    const sourceAtDeparture = gameState.planets
      .get('planet-1')!
      .timeline!.getStateAtTurn(20)!;

    expect(colony.startTurn).toBe(36);
    expect(colony.expansion).toEqual({
      travelChoice: 'inside_galaxy',
      sourcePlanetIndex: 0,
      departureTurn: 20,
    });
    expect(sourceAtDeparture.completedCounts.outpost_ship).toBe(1);
  });

  test('uses galaxy-to-galaxy travel time when selected', () => {
    let gameState = createInitialGameState();
    const homeworld = gameState.planets.get('planet-1')!;
    homeworld.timeline!.mutateAtTurn(10, (state) => {
      state.completedCounts.outpost_ship = 2;
    });

    gameState = addPlanet(gameState, {
      name: 'Distant Colony',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 30, orbitalCap: 20 },
      expansion: { travelChoice: 'galaxy_to_galaxy' },
    });

    expect(gameState.planets.get('planet-2')!.startTurn).toBe(36);
  });

  test('blocks expansion when only the reserved starter outpost ship exists', () => {
    const gameState = createInitialGameState();

    expect(() => addPlanet(gameState, {
      name: 'Blocked Colony',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 30, orbitalCap: 20 },
      expansion: { travelChoice: 'inside_galaxy' },
    })).toThrow('No usable outpost ship is available');
  });

  test('does not consume an outpost ship when expansion fails planet-limit validation', () => {
    let gameState = createInitialGameState();
    for (let i = 2; i <= 4; i++) {
      gameState = addPlanet(gameState, {
        name: `Planet ${i}`,
        startTurn: 1,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 30, orbitalCap: 20 },
      });
    }

    const homeworld = gameState.planets.get('planet-1')!;
    homeworld.timeline!.mutateAtTurn(10, (state) => {
      state.completedCounts.outpost_ship = 2;
    });

    expect(() => addPlanet(gameState, {
      name: 'Blocked Fifth Colony',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 30, orbitalCap: 20 },
      expansion: { travelChoice: 'inside_galaxy' },
    })).toThrow('Maximum planet limit reached');

    expect(
      gameState.planets
        .get('planet-1')!
        .timeline!.getStateAtTurn(10)!
        .completedCounts.outpost_ship
    ).toBe(2);
  });

  test('adds new planet with starter buildings', () => {
    let gameState = createInitialGameState();

    const newPlanetConfig = {
      name: 'Mars Colony',
      startTurn: 10,
      abundance: {
        metal: 1.5,
        mineral: 1.2,
        food: 0.8,
        energy: 1.0,
        research_points: 1.0,
      },
      space: {
        groundCap: 30,
        orbitalCap: 20,
      },
    };

    gameState = addPlanet(gameState, newPlanetConfig);

    expect(gameState.planets.size).toBe(2);
    expect(gameState.nextPlanetId).toBe(3);

    const mars = gameState.planets.get('planet-2');
    expect(mars).toBeDefined();
    expect(mars!.name).toBe('Mars Colony');
    expect(mars!.startTurn).toBe(10);
    expect(mars!.currentTurn).toBe(10);

    // Check starter buildings - addPlanet only includes outpost
    expect(mars!.completedCounts['outpost']).toBe(1);
    // Note: addPlanet doesn't include metal_mine, mineral_extractor, or solar_generator
    // Those are only in createStandardStart (homeworld)

    // Check starter population
    expect(mars!.population.workersTotal).toBe(5000);
    expect(mars!.population.workersIdle).toBe(5000);

    // Check abundances
    expect(mars!.abundance.metal).toBe(1.5);
    expect(mars!.abundance.mineral).toBe(1.2);
    expect(mars!.abundance.food).toBe(0.8);

    // Check space
    expect(mars!.space.groundCap).toBe(30);
    expect(mars!.space.orbitalCap).toBe(20);
  });

  test('adds new planet with custom starting population and structures', () => {
    let gameState = createInitialGameState();

    gameState = addPlanet(gameState, {
      name: 'Established Colony',
      startTurn: 12,
      abundance: {
        metal: 1,
        mineral: 1,
        food: 1,
        energy: 1,
        research_points: 1,
      },
      space: {
        groundCap: 60,
        orbitalCap: 40,
      },
      starting: {
        workersTotal: 20000,
        structures: {
          metal_mine: 3,
          mineral_extractor: 3,
          farm: 1,
          solar_generator: 1,
        },
      },
    });

    const colony = gameState.planets.get('planet-2')!;
    expect(colony.population.workersTotal).toBe(20000);
    expect(colony.population.workersIdle).toBe(20000);
    expect(colony.completedCounts.outpost).toBe(1);
    expect(colony.completedCounts.metal_mine).toBe(3);
    expect(colony.completedCounts.mineral_extractor).toBe(3);
    expect(colony.completedCounts.farm).toBe(1);
    expect(colony.completedCounts.solar_generator).toBe(1);
    expect(colony.space.groundUsed).toBe(8);
  });

  test('edits an added planet starting setup', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 5,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    });

    gameState = updatePlanetConfig(gameState, 'planet-2', {
      name: 'Mars Prime',
      startTurn: 8,
      abundance: { metal: 1.2, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 70, orbitalCap: 40 },
      starting: {
        workersTotal: 15000,
        structures: {
          metal_mine: 2,
          mineral_extractor: 1,
          farm: 1,
          solar_generator: 1,
        },
      },
    });

    const mars = gameState.planets.get('planet-2')!;
    expect(mars.name).toBe('Mars Prime');
    expect(mars.startTurn).toBe(8);
    expect(mars.population.workersTotal).toBe(15000);
    expect(mars.completedCounts.metal_mine).toBe(2);
    expect(mars.completedCounts.mineral_extractor).toBe(1);
    expect(mars.completedCounts.farm).toBe(1);
    expect(mars.completedCounts.solar_generator).toBe(1);
    expect(mars.space.groundUsed).toBe(5);
    expect(mars.space.groundCap).toBe(70);
  });

  test('replays custom starting setup from command history', () => {
    const commandHistory = new CommandHistory();
    commandHistory.recordAddPlanet({
      name: 'Replay Colony',
      startTurn: 3,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
      starting: {
        workersTotal: 18000,
        structures: {
          metal_mine: 2,
          mineral_extractor: 2,
          farm: 1,
          solar_generator: 1,
        },
      },
    });

    const replayed = replayCommands(createInitialGameState(), commandHistory.getCommands());
    const colony = replayed.planets.get('planet-2')!;
    expect(colony.population.workersTotal).toBe(18000);
    expect(colony.completedCounts.metal_mine).toBe(2);
    expect(colony.completedCounts.mineral_extractor).toBe(2);
    expect(colony.completedCounts.farm).toBe(1);
    expect(colony.completedCounts.solar_generator).toBe(1);
  });

  test('reset to homeworld removes added planets and resets home queue', () => {
    let gameState = createInitialGameState();
    const home = gameState.planets.get('planet-1')!;
    home.lanes.building.pendingQueue.push({
      id: 'queued-farm',
      itemId: 'farm',
      status: 'pending',
      quantity: 1,
      turnsRemaining: 4,
    });
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    });
    gameState = switchPlanet(gameState, 'planet-2');
    gameState.globalResearch.stock = 500;
    gameState.globalResearch.completed = ['planet_management'];
    gameState = queueGlobalResearch(gameState, 'pl_6');

    const reset = resetToHomeworld(gameState);

    expect(reset.planets.size).toBe(1);
    expect(reset.currentPlanetId).toBe('planet-1');
    expect(reset.nextPlanetId).toBe(2);
    expect(reset.planets.has('planet-2')).toBe(false);
    expect(reset.planets.get('planet-1')!.lanes.building.pendingQueue).toEqual([]);
    expect(reset.globalResearch.stock).toBe(0);
    expect(reset.globalResearch.completed).toEqual([]);
    expect(reset.globalResearch.lane.pendingQueue).toEqual([]);
    expect(reset.globalResearch.lane.completionHistory).toEqual([]);
  });

  test('replays reset-all command by removing added planets', () => {
    const commandHistory = new CommandHistory();
    commandHistory.recordQueueResearch('planet_management', 'queued-pm');
    commandHistory.recordAddPlanet({
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    });
    commandHistory.recordSwitchPlanet(1);
    commandHistory.recordResetAllPlanets();

    const replayed = replayCommands(createInitialGameState(), commandHistory.getCommands());

    expect(replayed.planets.size).toBe(1);
    expect(replayed.currentPlanetId).toBe('planet-1');
    expect(replayed.nextPlanetId).toBe(2);
    expect(replayed.globalResearch.lane.pendingQueue).toEqual([]);
    expect(replayed.globalResearch.completed).toEqual([]);
  });

  test('replays research queued after reset-all while dropping research queued before it', () => {
    const commandHistory = new CommandHistory();
    commandHistory.recordQueueResearch('planet_management', 'queued-before-reset');
    commandHistory.recordResetAllPlanets();
    commandHistory.recordQueueResearch('planet_management', 'queued-after-reset');

    const replayed = replayCommands(createInitialGameState(), commandHistory.getCommands());

    expect(replayed.globalResearch.lane.pendingQueue).toHaveLength(1);
    expect(replayed.globalResearch.lane.pendingQueue[0].itemId).toBe('planet_management');
  });

  test('switches between planets', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 5,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    expect(gameState.currentPlanetId).toBe('planet-1');

    gameState = switchPlanet(gameState, 'planet-2');
    expect(gameState.currentPlanetId).toBe('planet-2');

    gameState = switchPlanet(gameState, 'planet-1');
    expect(gameState.currentPlanetId).toBe('planet-1');
  });

  test('maintains independent queues per planet', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    // Add items to different planets' queues
    const earth = gameState.planets.get('planet-1')!;
    const mars = gameState.planets.get('planet-2')!;

    // Simulate adding to queues (would normally use commands)
    earth.lanes.building.pendingQueue = [{
      id: 'item-1',
      itemId: 'metal_mine',
      status: 'pending',
      quantity: 1,
      turnsRemaining: 4,
    }];

    mars.lanes.building.pendingQueue = [{
      id: 'item-2',
      itemId: 'mineral_mine',
      status: 'pending',
      quantity: 1,
      turnsRemaining: 4,
    }];

    // Verify queues are independent
    expect(earth.lanes.building.pendingQueue[0].itemId).toBe('metal_mine');
    expect(mars.lanes.building.pendingQueue[0].itemId).toBe('mineral_mine');
  });

  test('shares research queue globally', () => {
    const gameState = createInitialGameState();

    // Research should be in gameState, not per-planet
    expect(gameState.globalResearch).toBeDefined();
    expect(gameState.globalResearch.lane.pendingQueue).toEqual([]);
    expect(gameState.globalResearch.completed).toEqual([]);

    // Planets have research lanes for compatibility but they're not used
    // Global research queue is used instead
    const earth = gameState.planets.get('planet-1')!;
    expect(earth.lanes.research).toBeDefined();
    expect(earth.lanes.research.pendingQueue).toEqual([]);
  });

  test('respects 4-planet limit', () => {
    let gameState = createInitialGameState();

    // Add 3 more planets (total 4)
    for (let i = 0; i < 3; i++) {
      gameState = addPlanet(gameState, {
        name: `Colony ${i + 1}`,
        startTurn: 1,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 25, orbitalCap: 15 },
      });
    }

    expect(gameState.planets.size).toBe(4);

    // Try to add 5th planet - should fail
    expect(() => {
      addPlanet(gameState, {
        name: 'Colony 5',
        startTurn: 1,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 25, orbitalCap: 15 },
      });
    }).toThrow('Maximum planet limit reached');
  });

  test('allows the first three added planets to use arbitrary start turns without PL research', () => {
    let gameState = createInitialGameState();

    for (const [index, startTurn] of [46, 1, 175].entries()) {
      gameState = addPlanet(gameState, {
        name: `Base Colony ${index + 1}`,
        startTurn,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 25, orbitalCap: 15 },
      });
    }

    expect(gameState.planets.get('planet-2')?.startTurn).toBe(46);
    expect(gameState.planets.get('planet-3')?.startTurn).toBe(1);
    expect(gameState.planets.get('planet-4')?.startTurn).toBe(175);
  });

  describe('outpost ship seeding', () => {
    test('homeworld starts with exactly one outpost ship', () => {
      const state = createInitialGameState();
      const homeworld = state.planets.get('planet-1')!;
      expect(homeworld.completedCounts.outpost_ship).toBe(1);
    });

    test('added planets do NOT start with an outpost ship', () => {
      let state = createInitialGameState();
      state = addPlanet(state, {
        name: 'Colony',
        startTurn: 20,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 60, orbitalCap: 40 },
      });
      const colony = state.planets.get('planet-2')!;
      expect(colony.completedCounts.outpost_ship ?? 0).toBe(0);
    });
  });

  test('tracks per-planet turns correctly', () => {
    let gameState = createInitialGameState();

    // Add planet starting at turn 10
    gameState = addPlanet(gameState, {
      name: 'Late Colony',
      startTurn: 10,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    const earth = gameState.planets.get('planet-1')!;
    const colony = gameState.planets.get('planet-2')!;

    expect(earth.startTurn).toBe(1);
    expect(earth.currentTurn).toBe(1);

    expect(colony.startTurn).toBe(10);
    expect(colony.currentTurn).toBe(10);

    // Turns should advance independently
    earth.currentTurn = 15;
    colony.currentTurn = 12;

    expect(earth.currentTurn).toBe(15);
    expect(colony.currentTurn).toBe(12);
  });
});
