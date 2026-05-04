import { describe, expect, test } from 'vitest';
import { createInitialGameState, addPlanet } from '../gameState';
import {
  getGlobalResearchAtTurn,
  getGlobalResearchLaneView,
  getEarliestPlanetStartTurn,
  getPlanetLimitAtTurn,
  getResearchCompletionTurns,
  cancelGlobalResearch,
  queueGlobalResearch,
  queueGlobalResearchWait,
  reorderGlobalResearch,
} from '../globalResearch';
import { Timeline } from '../state';
import { CommandHistory, replayCommands } from '../urlState';

function refreshTimeline(gameState: ReturnType<typeof createInitialGameState>, planetId: string) {
  const planet = gameState.planets.get(planetId)!;
  planet.timeline = new Timeline(planet);
}

describe('global research', () => {
  test('banks RP globally from scientists without changing local planet RP', () => {
    const gameState = createInitialGameState();
    const planet = gameState.planets.get('planet-1')!;
    planet.population.scientists = 10;
    refreshTimeline(gameState, 'planet-1');

    const localBefore = planet.stocks.research_points;
    const global = getGlobalResearchAtTurn(gameState, 5);

    expect(global.stock).toBe(50);
    expect(planet.stocks.research_points).toBe(localBefore);
  });

  test('ignores scientists on planets before their start turn', () => {
    let gameState = createInitialGameState();
    const homeworld = gameState.planets.get('planet-1')!;
    homeworld.population.scientists = 10;
    refreshTimeline(gameState, 'planet-1');

    gameState = addPlanet(gameState, {
      name: 'Late Colony',
      startTurn: 10,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    });
    const colony = gameState.planets.get('planet-2')!;
    colony.population.scientists = 5;
    refreshTimeline(gameState, 'planet-2');

    expect(getGlobalResearchAtTurn(gameState, 9).stock).toBe(90);
    expect(getGlobalResearchAtTurn(gameState, 10).stock).toBe(105);
  });

  test('research lane view is independent of active planet', () => {
    let gameState = createInitialGameState();
    gameState.globalResearch.stock = 1000;
    gameState = addPlanet(gameState, {
      name: 'Mars',
      startTurn: 1,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    });
    gameState = queueGlobalResearch(gameState, 'planet_management');

    const earthView = getGlobalResearchLaneView({ ...gameState, currentPlanetId: 'planet-1' }, 1);
    const marsView = getGlobalResearchLaneView({ ...gameState, currentPlanetId: 'planet-2' }, 1);

    expect(marsView).toEqual(earthView);
  });

  test('research lane view uses actual RP-gated start turns before navigation catches up', () => {
    let gameState = createInitialGameState();
    const planet = gameState.planets.get('planet-1')!;
    planet.population.scientists = 1;
    refreshTimeline(gameState, 'planet-1');

    gameState = queueGlobalResearch(gameState, 'planet_management');

    const earlyEntry = getGlobalResearchLaneView(gameState, 1).entries.find(
      (entry) => entry.itemId === 'planet_management'
    )!;
    const laterEntry = getGlobalResearchLaneView(gameState, 50).entries.find(
      (entry) => entry.itemId === 'planet_management'
    )!;
    const clickedEntry = getGlobalResearchLaneView(gameState, earlyEntry.completionTurn!).entries.find(
      (entry) => entry.itemId === 'planet_management'
    )!;

    expect(earlyEntry.startTurn).toBe(101);
    expect(earlyEntry.completionTurn).toBe(124);
    expect(laterEntry.startTurn).toBe(earlyEntry.startTurn);
    expect(laterEntry.completionTurn).toBe(earlyEntry.completionTurn);
    expect(clickedEntry.startTurn).toBe(earlyEntry.startTurn);
    expect(clickedEntry.completionTurn).toBe(earlyEntry.completionTurn);
  });

  test('research completion planning can project beyond the visible simulator limit', () => {
    let gameState = createInitialGameState();
    const planet = gameState.planets.get('planet-1')!;
    planet.population.scientists = 1;
    refreshTimeline(gameState, 'planet-1');
    gameState.globalResearch.completed = ['fleet_technology'];

    gameState = queueGlobalResearch(gameState, 'merchant_research');

    const entry = getGlobalResearchLaneView(gameState, 1).entries.find(
      (item) => item.itemId === 'merchant_research'
    )!;
    const completions = getResearchCompletionTurns(gameState);

    expect(entry.startTurn).toBe(10001);
    expect(entry.completionTurn).toBe(10048);
    expect(entry.completionTurn).toBeGreaterThan(200);
    expect(completions.get('merchant_research')).toBe(10048);
  });

  test('PL research raises the planet limit on its completion turn', () => {
    let gameState = createInitialGameState();
    for (let i = 0; i < 3; i++) {
      gameState = addPlanet(gameState, {
        name: `Colony ${i + 1}`,
        startTurn: 1,
        abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
        space: { groundCap: 60, orbitalCap: 40 },
      });
    }

    gameState.globalResearch.completed = ['planet_management'];
    gameState.globalResearch.stock = 1000;
    gameState = queueGlobalResearch(gameState, 'pl_6');

    expect(getPlanetLimitAtTurn(gameState, 23)).toBe(4);
    expect(() => addPlanet(gameState, {
      name: 'Too Early',
      startTurn: 23,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    })).toThrow('Maximum planet limit reached');

    expect(getPlanetLimitAtTurn(gameState, 24)).toBe(6);
    const expanded = addPlanet(gameState, {
      name: 'Allowed',
      startTurn: 24,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    });
    expect(expanded.planets.size).toBe(5);
  });

  test('planet start lookup returns null when no PL unlock is scheduled', () => {
    let gameState = createInitialGameState();
    gameState.globalResearch.stock = 1000;
    gameState = queueGlobalResearch(gameState, 'fleet_technology');

    expect(getEarliestPlanetStartTurn(gameState, 5, 1)).toBeNull();
  });

  test('research reorder rejects moving dependencies before prerequisites', () => {
    let gameState = createInitialGameState();
    gameState.globalResearch.completed = ['planet_management'];
    gameState.globalResearch.stock = 1000;
    gameState = queueGlobalResearch(gameState, 'pl_6');
    gameState = queueGlobalResearch(gameState, 'pl_8');

    const originalOrder = gameState.globalResearch.lane.pendingQueue.map((item) => item.itemId);
    const pl8 = gameState.globalResearch.lane.pendingQueue[1];
    const reordered = reorderGlobalResearch(gameState, pl8.id, 0);

    expect(reordered).toBe(gameState);
    expect(reordered.globalResearch.lane.pendingQueue.map((item) => item.itemId)).toEqual(originalOrder);
  });

  test('invalid research order fails fast without projecting an unlock', () => {
    let gameState = createInitialGameState();
    gameState.globalResearch.stock = 1000;
    gameState = queueGlobalResearch(gameState, 'planet_management');
    gameState = queueGlobalResearch(gameState, 'pl_6');
    gameState.globalResearch.lane.pendingQueue.reverse();

    expect(getEarliestPlanetStartTurn(gameState, 5, 1)).toBeNull();
    const laneView = getGlobalResearchLaneView(gameState, 1);
    expect(laneView.entries.find((entry) => entry.itemId === 'pl_6')?.startTurn).toBeUndefined();
  });

  test('URL replay restores global research queue, wait, cancel, and reorder commands', () => {
    let gameState = createInitialGameState();
    const commandHistory = new CommandHistory();

    gameState = queueGlobalResearch(gameState, 'planet_management');
    const planetManagement = gameState.globalResearch.lane.pendingQueue[0];
    commandHistory.recordQueueResearch('planet_management', planetManagement.id);

    gameState = queueGlobalResearchWait(gameState, 3);
    const wait = gameState.globalResearch.lane.pendingQueue[1];
    commandHistory.recordQueueResearchWait(3, wait.id);

    gameState = queueGlobalResearch(gameState, 'resource_collection');
    const resourceCollection = gameState.globalResearch.lane.pendingQueue[2];
    commandHistory.recordQueueResearch('resource_collection', resourceCollection.id);

    gameState = reorderGlobalResearch(gameState, resourceCollection.id, 0);
    commandHistory.recordReorder(0, 'research', resourceCollection.id, 0);

    gameState = cancelGlobalResearch(gameState, planetManagement.id);
    commandHistory.recordCancel(0, 'research', planetManagement.id);

    const replayed = replayCommands(createInitialGameState(), commandHistory.getCommands());
    expect(replayed.globalResearch.lane.pendingQueue.map((item) => item.itemId)).toEqual([
      'resource_collection',
      '__wait__',
    ]);
    expect(replayed.globalResearch.lane.pendingQueue[1].turnsRemaining).toBe(3);
  });

  test('URL replay restores edited planet configuration', () => {
    const commandHistory = new CommandHistory();

    const initialConfig = {
      name: 'Mars',
      startTurn: 5,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
    };
    commandHistory.recordAddPlanet(initialConfig);

    const editedConfig = {
      name: 'Mars Prime',
      startTurn: 12,
      abundance: { metal: 1.2, mineral: 0.8, food: 1, energy: 1.1, research_points: 1 },
      space: { groundCap: 70, orbitalCap: 50 },
    };
    commandHistory.recordEditPlanet(1, editedConfig);

    const replayed = replayCommands(createInitialGameState(), commandHistory.getCommands());
    const edited = replayed.planets.get('planet-2')!;

    expect(edited.name).toBe('Mars Prime');
    expect(edited.startTurn).toBe(12);
    expect(edited.abundance.metal).toBe(1.2);
    expect(edited.space.groundCap).toBe(70);
  });
});
