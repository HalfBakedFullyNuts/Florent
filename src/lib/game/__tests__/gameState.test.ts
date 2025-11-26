import { describe, test, expect } from 'vitest';
import { createInitialGameState, addPlanet, switchPlanet } from '../gameState';

describe('Multi-Planet State Management', () => {
  test('creates game with initial planet', () => {
    const gameState = createInitialGameState();

    expect(gameState.planets.size).toBe(1);
    expect(gameState.currentPlanetId).toBe('planet-1');
    expect(gameState.globalResearch.queue).toEqual([]);
    expect(gameState.globalResearch.completed).toEqual([]);
    expect(gameState.nextPlanetId).toBe(2);
    expect(gameState.maxPlanets).toBe(4);

    const firstPlanet = gameState.planets.get('planet-1');
    expect(firstPlanet).toBeDefined();
    expect(firstPlanet!.id).toBe('planet-1');
    expect(firstPlanet!.name).toBe('Homeworld');
    expect(firstPlanet!.startTurn).toBe(1);
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
    expect(gameState.globalResearch.queue).toEqual([]);
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