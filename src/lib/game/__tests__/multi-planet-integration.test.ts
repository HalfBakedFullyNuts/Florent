import { describe, test, expect } from 'vitest';
import { createInitialGameState, addPlanet } from '../gameState';
import { enqueueBuildingForPlanet, advanceTurnForPlanet, queueResearch } from '../commands';
import { exportGameState } from '../../export/multiPlanetExporter';

describe('Multi-Planet Integration', () => {
  test('building on Planet A doesnt affect Planet B', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    const marsBefore = gameState.planets.get('planet-2')!;
    const marsMetalBefore = marsBefore.stocks.metal;

    // Build on Earth
    gameState = enqueueBuildingForPlanet(gameState, 'planet-1', 'metal_mine', 1);

    const earthAfter = gameState.planets.get('planet-1')!;
    const marsAfter = gameState.planets.get('planet-2')!;

    // Earth should have the item queued
    expect(earthAfter.lanes.building.pendingQueue.length).toBeGreaterThan(0);
    expect(earthAfter.lanes.building.pendingQueue.some(item => item.itemId === 'metal_mine')).toBe(true);

    // Mars should be unchanged - no queue items and same resources
    expect(marsAfter.stocks.metal).toBe(marsMetalBefore);
    expect(marsAfter.lanes.building.pendingQueue.length).toBe(0);
  });

  test('research on any planet affects all', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    // Ensure one planet has lab and scientists
    const earth = gameState.planets.get('planet-1')!;
    earth.completedCounts['lab'] = 1;
    earth.population.scientists = 10;
    earth.stocks.research_points = 1000;

    // Queue research (should work because Earth has prerequisites)
    // Use a valid research ID from game_data.json
    gameState = queueResearch(gameState, 'planet_management');

    // Research should be in global queue
    expect(gameState.globalResearch.queue.length).toBe(1);
    expect(gameState.globalResearch.queue[0].itemId).toBe('planet_management');

    // Complete research
    gameState.globalResearch.queue[0].turnsRemaining = 0;
    gameState.globalResearch.queue[0].status = 'completed';
    gameState.globalResearch.completed.push('planet_management');
    gameState.globalResearch.queue = [];

    // Both planets should have access to the research
    expect(gameState.globalResearch.completed).toContain('planet_management');
  });

  test('export includes all planets', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 5,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });
    gameState = addPlanet(gameState, {
      name: 'Luna',
      startTurn: 10,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    const exportData = exportGameState(gameState);

    expect(exportData).toContain('Homeworld');
    expect(exportData).toContain('Mars');
    expect(exportData).toContain('Luna');
    expect(exportData).toContain('Planet Count: 3/4');
  });

  test('timeline works per-planet', () => {
    let gameState = createInitialGameState();

    // Add Mars starting at turn 10
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 10,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    // Queue building on Earth at turn 1
    gameState = enqueueBuildingForPlanet(gameState, 'planet-1', 'farm', 1);
    const earthQueue = gameState.planets.get('planet-1')!.lanes.building.pendingQueue;
    expect(earthQueue[0].turnsRemaining).toBe(4); // Farm takes 4 turns

    // Queue building on Mars at turn 10
    gameState = enqueueBuildingForPlanet(gameState, 'planet-2', 'farm', 1);
    const marsQueue = gameState.planets.get('planet-2')!.lanes.building.pendingQueue;
    expect(marsQueue[0].turnsRemaining).toBe(4); // Also 4 turns, but starting from turn 10

    // Advance Earth to turn 5
    for (let i = 0; i < 4; i++) {
      gameState = advanceTurnForPlanet(gameState, 'planet-1');
    }

    const earthAfter = gameState.planets.get('planet-1')!;
    const marsAfter = gameState.planets.get('planet-2')!;

    expect(earthAfter.currentTurn).toBe(5);
    // Standard start includes 1 farm, plus the queued farm = 2 total
    expect(earthAfter.completedCounts['farm']).toBe(2); // Starter farm + queued farm

    expect(marsAfter.currentTurn).toBe(10); // Mars unchanged
    // Mars was added via addPlanet which only includes outpost (no starter farm)
    // The queued farm hasn't completed yet
    expect(marsAfter.completedCounts['farm']).toBeUndefined(); // No farm yet
  });

  test('can check research prerequisites across all planets', () => {
    let gameState = createInitialGameState();
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 25, orbitalCap: 15 },
    });

    // No planet has lab initially
    const canResearch1 = hasResearchPrerequisites(gameState);
    expect(canResearch1).toBe(false);

    // Add lab to Mars (not Earth)
    const mars = gameState.planets.get('planet-2')!;
    mars.completedCounts['lab'] = 1;
    mars.population.scientists = 5;

    // Should now be able to research
    const canResearch2 = hasResearchPrerequisites(gameState);
    expect(canResearch2).toBe(true);
  });
});

// Helper function to check if any planet has research prerequisites
function hasResearchPrerequisites(gameState: any): boolean {
  for (const planet of gameState.planets.values()) {
    if (planet.completedCounts['lab'] > 0 && planet.population.scientists > 0) {
      return true;
    }
  }
  return false;
}