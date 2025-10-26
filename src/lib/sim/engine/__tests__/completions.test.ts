/**
 * Tests for completion handling
 * Ticket 5: Completions & colonist conversion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyStructureCompletion,
  applyColonistConversion,
  applyColonistConversions,
  processCompletions,
} from '../completions';
import type { PlanetState, WorkItem, ItemDefinition } from '../types';

function createTestState(): PlanetState {
  return {
    currentTurn: 1,
    stocks: {
      metal: 10000,
      mineral: 5000,
      food: 1000,
      energy: 500,
    },
    abundance: {
      metal: 1.0,
      mineral: 1.0,
      food: 1.0,
      energy: 1.0,
    },
    population: {
      workersTotal: 10000,
      workersIdle: 5000,
      soldiers: 0,
      scientists: 0,
      busyByLane: {
        building: 0,
        ship: 0,
        colonist: 0,
      },
    },
    space: {
      groundUsed: 10,
      groundCap: 50,
      orbitalUsed: 5,
      orbitalCap: 30,
    },
    housing: {
      workerCap: 20000,
      soldierCap: 100,
      scientistCap: 50,
    },
    lanes: {
      building: { pendingQueue: [], active: null, maxQueueDepth: 10 },
      ship: { pendingQueue: [], active: null, maxQueueDepth: 10 },
      colonist: { pendingQueue: [], active: null, maxQueueDepth: 10 },
    },
    completedCounts: {},
    pendingColonistConversions: [],
    defs: {},
  };
}

describe('Structure Completion', () => {
  let state: PlanetState;

  beforeEach(() => {
    state = createTestState();

    // Add metal mine definition
    state.defs['metal_mine'] = {
      id: 'metal_mine',
      name: 'Metal Mine',
      lane: 'building',
      type: 'structure',
      durationTurns: 5,
      costsPerUnit: {
        metal: 300,
        mineral: 100,
        food: 0,
        energy: 0,
        workers: 500,
        space: 1,
      },
      effectsOnComplete: {
        production_metal: 300,
      },
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 10,
      },
      prerequisites: [],
    };

    // Add barracks definition with housing effect
    state.defs['army_barracks'] = {
      id: 'army_barracks',
      name: 'Army Barracks',
      lane: 'building',
      type: 'structure',
      durationTurns: 10,
      costsPerUnit: {
        metal: 500,
        mineral: 200,
        food: 0,
        energy: 0,
        workers: 1000,
        space: 2,
      },
      effectsOnComplete: {
        housing_soldier_cap: 50,
      },
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 5,
      },
      prerequisites: [],
    };
  });

  it('should increment completed counts', () => {
    const item: WorkItem = {
      id: 'item1',
      itemId: 'metal_mine',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    applyStructureCompletion(state, item);

    expect(state.completedCounts['metal_mine']).toBe(1);
  });

  it('should apply housing capacity effects', () => {
    const item: WorkItem = {
      id: 'item1',
      itemId: 'army_barracks',
      status: 'completed',
      quantity: 2,
      turnsRemaining: 0,
    };

    const initialSoldierCap = state.housing.soldierCap;
    applyStructureCompletion(state, item);

    expect(state.housing.soldierCap).toBe(initialSoldierCap + 100); // 50 * 2
  });

  it('should apply space capacity effects', () => {
    const spaceDef: ItemDefinition = {
      id: 'orbital_platform',
      name: 'Orbital Platform',
      lane: 'building',
      type: 'structure',
      durationTurns: 15,
      costsPerUnit: {
        metal: 1000,
        mineral: 500,
        food: 0,
        energy: 0,
        workers: 2000,
        space: 3,
      },
      effectsOnComplete: {
        space_orbital_cap: 20,
      },
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 15,
      },
      prerequisites: [],
    };

    state.defs['orbital_platform'] = spaceDef;

    const item: WorkItem = {
      id: 'item1',
      itemId: 'orbital_platform',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    const initialOrbitalCap = state.space.orbitalCap;
    applyStructureCompletion(state, item);

    expect(state.space.orbitalCap).toBe(initialOrbitalCap + 20);
  });

  it('should handle multiple quantity', () => {
    const item: WorkItem = {
      id: 'item1',
      itemId: 'metal_mine',
      status: 'completed',
      quantity: 3,
      turnsRemaining: 0,
    };

    applyStructureCompletion(state, item);

    expect(state.completedCounts['metal_mine']).toBe(3);
  });

  it('should handle definition not found gracefully', () => {
    const item: WorkItem = {
      id: 'item1',
      itemId: 'nonexistent',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    // Should not throw
    expect(() => applyStructureCompletion(state, item)).not.toThrow();
  });
});

describe('Colonist Conversion', () => {
  let state: PlanetState;

  beforeEach(() => {
    state = createTestState();

    // Add soldier definition
    state.defs['soldier'] = {
      id: 'soldier',
      name: 'Soldier',
      lane: 'colonist',
      type: 'soldier',
      durationTurns: 3,
      costsPerUnit: {
        metal: 50,
        mineral: 0,
        food: 100,
        energy: 0,
        workers: 10, // Reserves 10 workers during training
        space: 0,
      },
      effectsOnComplete: {},
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 0,
      },
      colonistKind: 'soldier',
      prerequisites: ['army_barracks'],
    };

    // Add scientist definition
    state.defs['scientist'] = {
      id: 'scientist',
      name: 'Scientist',
      lane: 'colonist',
      type: 'scientist',
      durationTurns: 5,
      costsPerUnit: {
        metal: 0,
        mineral: 100,
        food: 150,
        energy: 0,
        workers: 25, // Reserves 25 workers during training
        space: 0,
      },
      effectsOnComplete: {},
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 0,
      },
      colonistKind: 'scientist',
      prerequisites: ['research_lab'],
    };
  });

  describe('Soldier Conversion', () => {
    it('should convert 1 worker to soldier and refund 9 workers (n-1 pattern)', () => {
      const item: WorkItem = {
        id: 'item1',
        itemId: 'soldier',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      const initialWorkers = state.population.workersTotal;
      const initialIdle = state.population.workersIdle;

      applyColonistConversion(state, item);

      // 10 workers reserved, 9 refunded to idle, 1 converted
      expect(state.population.workersIdle).toBe(initialIdle + 9);
      expect(state.population.workersTotal).toBe(initialWorkers - 1);
      expect(state.population.soldiers).toBe(1);
    });

    it('should handle multiple soldiers', () => {
      const item: WorkItem = {
        id: 'item1',
        itemId: 'soldier',
        status: 'completed',
        quantity: 5,
        turnsRemaining: 0,
      };

      const initialWorkers = state.population.workersTotal;
      const initialIdle = state.population.workersIdle;

      applyColonistConversion(state, item);

      // 5 units × 10 workers = 50 reserved
      // Refund: 5 × 9 = 45 workers
      // Convert: 5 workers → 5 soldiers
      expect(state.population.workersIdle).toBe(initialIdle + 45);
      expect(state.population.workersTotal).toBe(initialWorkers - 5);
      expect(state.population.soldiers).toBe(5);
    });
  });

  describe('Scientist Conversion', () => {
    it('should convert 1 worker to scientist and refund 24 workers (n-1 pattern)', () => {
      const item: WorkItem = {
        id: 'item1',
        itemId: 'scientist',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      const initialWorkers = state.population.workersTotal;
      const initialIdle = state.population.workersIdle;

      applyColonistConversion(state, item);

      // 25 workers reserved, 24 refunded to idle, 1 converted
      expect(state.population.workersIdle).toBe(initialIdle + 24);
      expect(state.population.workersTotal).toBe(initialWorkers - 1);
      expect(state.population.scientists).toBe(1);
    });

    it('should handle multiple scientists', () => {
      const item: WorkItem = {
        id: 'item1',
        itemId: 'scientist',
        status: 'completed',
        quantity: 3,
        turnsRemaining: 0,
      };

      const initialWorkers = state.population.workersTotal;
      const initialIdle = state.population.workersIdle;

      applyColonistConversion(state, item);

      // 3 units × 25 workers = 75 reserved
      // Refund: 3 × 24 = 72 workers
      // Convert: 3 workers → 3 scientists
      expect(state.population.workersIdle).toBe(initialIdle + 72);
      expect(state.population.workersTotal).toBe(initialWorkers - 3);
      expect(state.population.scientists).toBe(3);
    });
  });

  it('should increment completed counts', () => {
    const item: WorkItem = {
      id: 'item1',
      itemId: 'soldier',
      status: 'completed',
      quantity: 2,
      turnsRemaining: 0,
    };

    applyColonistConversion(state, item);

    expect(state.completedCounts['soldier']).toBe(2);
  });

  it('should handle non-colonist item gracefully', () => {
    state.defs['metal_mine'] = {
      id: 'metal_mine',
      name: 'Metal Mine',
      lane: 'building',
      type: 'structure',
      durationTurns: 5,
      costsPerUnit: {
        metal: 300,
        mineral: 100,
        food: 0,
        energy: 0,
        workers: 500,
        space: 1,
      },
      effectsOnComplete: {},
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 0,
      },
      prerequisites: [],
    };

    const item: WorkItem = {
      id: 'item1',
      itemId: 'metal_mine',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    expect(() => applyColonistConversion(state, item)).not.toThrow();
  });
});

describe('Batch Colonist Conversions', () => {
  let state: PlanetState;

  beforeEach(() => {
    state = createTestState();

    state.defs['soldier'] = {
      id: 'soldier',
      name: 'Soldier',
      lane: 'colonist',
      type: 'soldier',
      durationTurns: 3,
      costsPerUnit: {
        metal: 50,
        mineral: 0,
        food: 100,
        energy: 0,
        workers: 10,
        space: 0,
      },
      effectsOnComplete: {},
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 0,
      },
      colonistKind: 'soldier',
      prerequisites: [],
    };

    state.defs['scientist'] = {
      id: 'scientist',
      name: 'Scientist',
      lane: 'colonist',
      type: 'scientist',
      durationTurns: 5,
      costsPerUnit: {
        metal: 0,
        mineral: 100,
        food: 150,
        energy: 0,
        workers: 25,
        space: 0,
      },
      effectsOnComplete: {},
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 0,
      },
      colonistKind: 'scientist',
      prerequisites: [],
    };
  });

  it('should process multiple pending conversions', () => {
    const soldier1: WorkItem = {
      id: 'soldier1',
      itemId: 'soldier',
      status: 'completed',
      quantity: 2,
      turnsRemaining: 0,
    };

    const scientist1: WorkItem = {
      id: 'scientist1',
      itemId: 'scientist',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    state.pendingColonistConversions = [soldier1, scientist1];

    const initialWorkers = state.population.workersTotal;
    const initialIdle = state.population.workersIdle;

    applyColonistConversions(state);

    // Soldiers: 2 × 10 = 20 workers reserved → 18 refunded, 2 converted
    // Scientists: 1 × 25 = 25 workers reserved → 24 refunded, 1 converted
    // Total: 42 refunded, 3 converted
    expect(state.population.workersIdle).toBe(initialIdle + 42);
    expect(state.population.workersTotal).toBe(initialWorkers - 3);
    expect(state.population.soldiers).toBe(2);
    expect(state.population.scientists).toBe(1);
  });

  it('should clear pending conversions after processing', () => {
    const item: WorkItem = {
      id: 'item1',
      itemId: 'soldier',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    state.pendingColonistConversions = [item];

    applyColonistConversions(state);

    expect(state.pendingColonistConversions).toHaveLength(0);
  });

  it('should handle empty pending conversions', () => {
    state.pendingColonistConversions = [];

    applyColonistConversions(state);

    expect(state.pendingColonistConversions).toHaveLength(0);
  });
});

describe('Process Completions', () => {
  let state: PlanetState;

  beforeEach(() => {
    state = createTestState();

    state.defs['metal_mine'] = {
      id: 'metal_mine',
      name: 'Metal Mine',
      lane: 'building',
      type: 'structure',
      durationTurns: 5,
      costsPerUnit: {
        metal: 300,
        mineral: 100,
        food: 0,
        energy: 0,
        workers: 500,
        space: 1,
      },
      effectsOnComplete: {
        production_metal: 300,
      },
      upkeepPerUnit: {
        metal: 0,
        mineral: 0,
        food: 0,
        energy: 10,
      },
      prerequisites: [],
    };
  });

  it('should process multiple completions', () => {
    const item1: WorkItem = {
      id: 'item1',
      itemId: 'metal_mine',
      status: 'completed',
      quantity: 1,
      turnsRemaining: 0,
    };

    const item2: WorkItem = {
      id: 'item2',
      itemId: 'metal_mine',
      status: 'completed',
      quantity: 2,
      turnsRemaining: 0,
    };

    processCompletions(state, [item1, item2]);

    expect(state.completedCounts['metal_mine']).toBe(3);
  });

  it('should handle empty completions list', () => {
    processCompletions(state, []);

    expect(Object.keys(state.completedCounts).length).toBe(0);
  });
});
