/**
 * Tests for Initial State Seed
 * Ticket 12: Seed - Create initial PlanetState
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  createStandardStart,
  createMinimalStart,
} from '../seed';
import { loadGameData } from '../adapter';
import { computeNetOutputsPerTurn } from '../../engine/outputs';
import { setDefsCatalog } from '../../engine/defsRegistry';
import { computeItemAssetScore } from '../../../game/scoring';
import gameDataJson from '../../../game/game_data.json';

describe('Seed Functions', () => {
  let defs: Record<string, any>;

  beforeEach(() => {
    defs = loadGameData(gameDataJson as any);
  });

  describe('createInitialState', () => {
    it('should create valid initial state with defaults', () => {
      const state = createInitialState(defs);

      expect(state).toBeDefined();
      expect(state.currentTurn).toBe(1); // Initial state starts at turn 1
    });

    it('should use default starting resources', () => {
      const state = createInitialState(defs);

      expect(state.stocks.metal).toBeDefined();
      expect(state.stocks.mineral).toBeDefined();
      expect(state.stocks.food).toBeDefined();
      expect(state.stocks.energy).toBeDefined();
    });

    it('should use default abundance values', () => {
      const state = createInitialState(defs);

      expect(state.abundance.metal).toBeDefined();
      expect(state.abundance.mineral).toBeDefined();
      expect(state.abundance.food).toBeDefined();
      expect(state.abundance.energy).toBeDefined();
    });

    it('should initialize population with defaults', () => {
      const state = createInitialState(defs);

      expect(state.population.workersTotal).toBeGreaterThan(0);
      expect(state.population.workersIdle).toBe(state.population.workersTotal);
      expect(state.population.soldiers).toBe(0);
      expect(state.population.scientists).toBe(0);
      expect(state.population.busyByLane).toEqual({
        building: 0,
        ship: 0,
        colonist: 0,
        research: 0,
      });
    });

    it('should initialize all lanes as idle', () => {
      const state = createInitialState(defs);

      expect(state.lanes.building.pendingQueue).toEqual([]);
      expect(state.lanes.building.active).toBeNull();
      expect(state.lanes.ship.pendingQueue).toEqual([]);
      expect(state.lanes.ship.active).toBeNull();
      expect(state.lanes.colonist.pendingQueue).toEqual([]);
      expect(state.lanes.colonist.active).toBeNull();
    });

    it('should initialize empty colonist conversions', () => {
      const state = createInitialState(defs);

      expect(state.pendingColonistConversions).toEqual([]);
    });
  });

  describe('createInitialState with custom config', () => {
    it('should override stocks when provided', () => {
      const state = createInitialState(defs, {
        stocks: {
          metal: 999999,
          mineral: 888888,
          food: 777777,
          energy: 666666,
        },
      });

      expect(state.stocks.metal).toBe(999999);
      expect(state.stocks.mineral).toBe(888888);
      expect(state.stocks.food).toBe(777777);
      expect(state.stocks.energy).toBe(666666);
    });

    it('should override abundance when provided', () => {
      const state = createInitialState(defs, {
        abundance: {
          metal: 1.5,
          mineral: 1.2,
          food: 0.8,
          energy: 2.0,
        },
      });

      expect(state.abundance.metal).toBe(1.5);
      expect(state.abundance.mineral).toBe(1.2);
      expect(state.abundance.food).toBe(0.8);
      expect(state.abundance.energy).toBe(2.0);
    });

    it('should override population when provided', () => {
      const state = createInitialState(defs, {
        population: {
          workersTotal: 50000,
          soldiers: 1000,
          scientists: 500,
        },
      });

      expect(state.population.workersTotal).toBe(50000);
      expect(state.population.workersIdle).toBe(50000);
      expect(state.population.soldiers).toBe(1000);
      expect(state.population.scientists).toBe(500);
    });

    it('should override space limits when provided', () => {
      const state = createInitialState(defs, {
        space: {
          groundCap: 100,
          orbitalCap: 80,
        },
      });

      expect(state.space.groundCap).toBeGreaterThanOrEqual(100);
      expect(state.space.orbitalCap).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Starting structures', () => {
    it('should apply default starting structures', () => {
      const state = createInitialState(defs);

      expect(state.completedCounts).toBeDefined();
      expect(Object.keys(state.completedCounts).length).toBeGreaterThan(0);
    });

    it('should apply custom starting structures', () => {
      const state = createInitialState(defs, {
        structures: {
          outpost: 1,
          metal_mine: 5,
        },
      });

      expect(state.completedCounts.outpost).toBe(1);
      expect(state.completedCounts.metal_mine).toBe(5);
    });

    it('should calculate space used from starting structures', () => {
      const state = createInitialState(defs, {
        structures: {
          outpost: 1,
          farm: 2, // Each farm takes 1 ground space
        },
      });

      expect(state.space.groundUsed).toBe(2); // 2 farms
    });

    it('should calculate housing from starting structures', () => {
      const state = createInitialState(defs, {
        structures: {
          outpost: 1, // Provides 50000 worker housing
        },
      });

      expect(state.housing.workerCap).toBe(50000);
      expect(state.housing.soldierCap).toBe(100000);
    });

    it('should sum housing from multiple structures', () => {
      const state = createInitialState(defs, {
        structures: {
          outpost: 1, // 50000 workers, 100000 soldiers
          living_quarters: 1, // 50000 workers
        },
      });

      expect(state.housing.workerCap).toBe(100000); // 50000 + 50000
    });

    it('should calculate space capacity from effects', () => {
      const state = createInitialState(defs, {
        structures: {
          outpost: 1,
          land_reclamation: 5, // Each adds 1 ground space
        },
        space: {
          groundCap: 60,
          orbitalCap: 40,
        },
      });

      expect(state.space.groundCap).toBe(65); // 60 + 5
    });
  });

  describe('createStandardStart', () => {
    it('should create standard starting scenario', () => {
      const state = createStandardStart(defs);

      expect(state).toBeDefined();
      expect(state.currentTurn).toBe(1); // Initial state starts at turn 1
    });

    it('should have standard starting resources', () => {
      const state = createStandardStart(defs);

      expect(state.stocks.metal).toBe(30000);
      expect(state.stocks.mineral).toBe(20000);
      expect(state.stocks.food).toBe(1000);
      expect(state.stocks.energy).toBe(20000);
    });

    it('should have standard abundance', () => {
      const state = createStandardStart(defs);

      expect(state.abundance.metal).toBe(1.0);
      expect(state.abundance.mineral).toBe(1.0);
      expect(state.abundance.food).toBe(1.0);
      expect(state.abundance.energy).toBe(1.0);
    });

    it('should have standard starting population', () => {
      const state = createStandardStart(defs);

      expect(state.population.workersTotal).toBe(30000);
      expect(state.population.soldiers).toBe(0);
      expect(state.population.scientists).toBe(250);
    });

    it('should have standard starting structures', () => {
      const state = createStandardStart(defs);

      expect(state.completedCounts.outpost).toBe(1);
      expect(state.completedCounts.metal_mine).toBe(3);
      expect(state.completedCounts.mineral_extractor).toBe(3);
      expect(state.completedCounts.farm).toBe(1);
      expect(state.completedCounts.solar_generator).toBe(1);
      expect(state.completedCounts.research_lab).toBe(1);
      expect(state.completedCounts.spy_centre).toBe(1);
      expect(state.housing.workerCap).toBe(50000);
      expect(state.housing.scientistCap).toBe(5000);
    });

    it('should start with the ships of the three starting fleets (cargo is not simulated yet)', () => {
      const state = createStandardStart(defs);

      expect(state.completedCounts.outpost_ship).toBe(1);
      expect(state.completedCounts.scout).toBe(1);
      expect(state.completedCounts.freighter).toBe(1);
      expect(state.completedCounts.invasion_ship).toBe(1);
      // Fleet cargo (1000 soldiers, 5000 workers) stays out of the planet population
      expect(state.population.soldiers).toBe(0);
    });

    it('should leave 52 ground and 40 orbital space free like the in-game homeworld', () => {
      const state = createStandardStart(defs);

      expect(state.space.groundCap - state.space.groundUsed).toBe(52);
      expect(state.space.orbitalCap - state.space.orbitalUsed).toBe(40);
    });

    it('should have standard space limits', () => {
      const state = createStandardStart(defs);

      expect(state.space.groundCap).toBeGreaterThanOrEqual(60);
      expect(state.space.orbitalCap).toBeGreaterThanOrEqual(40);
    });

    // Mirrors the in-game homeworld output line exactly: +1,200 / +800 / +140 / +70
    it('should produce the in-game homeworld outputs per turn', () => {
      setDefsCatalog(defs); // outputs resolve item defs through the registry
      const outputs = computeNetOutputsPerTurn(createStandardStart(defs));

      expect(outputs.metal).toBe(1200);
      expect(outputs.mineral).toBe(800);
      expect(outputs.food).toBe(140); // 200 - 30,000 workers * 0.002; scientists eat nothing
      expect(outputs.energy).toBe(70); // 100 solar + 150 outpost - 180 upkeep (incl. Spy Centre 100)
    });
  });

  describe('game data updates (new game version)', () => {
    it('defines the Spy Centre as a 16-turn, buildable-many structure that needs an Outpost', () => {
      const spy = defs.spy_centre;

      expect(spy.name).toBe('Spy Centre');
      expect(spy.lane).toBe('building');
      expect(spy.durationTurns).toBe(16);
      expect(spy.costsPerUnit).toMatchObject({ metal: 6000, mineral: 4000, workers: 3000, space: 2 });
      expect(spy.upkeepPerUnit.energy).toBe(100);
      expect(spy.prerequisites).toContain('outpost');
      expect(spy.unique).toBe(false);
    });

    it('defines the Scout as a 2-turn ship that needs a Shipyard', () => {
      const scout = defs.scout;

      expect(scout.name).toBe('Scout');
      expect(scout.lane).toBe('ship');
      expect(scout.durationTurns).toBe(2);
      expect(scout.costsPerUnit).toMatchObject({ metal: 300, mineral: 200, workers: 250 });
      expect(scout.prerequisites).toContain('shipyard');
    });

    it('defines the Colonization Ship as a 24-turn ship gated by Space Dock and Fast Expansion', () => {
      const ship = defs.colonization_ship;

      expect(ship.name).toBe('Colonization Ship');
      expect(ship.lane).toBe('ship');
      expect(ship.durationTurns).toBe(24);
      expect(ship.costsPerUnit).toMatchObject({ metal: 180000, mineral: 120000, workers: 200000 });
      expect(ship.prerequisites).toEqual(expect.arrayContaining(['space_dock', 'fast_expansion']));
      expect(ship.prerequisites).not.toContain('shipyard');
      expect(computeItemAssetScore(ship)).toBe(3240);
    });

    it('defines Fast Expansion as 96k RP / 14-turn research after Trader Research', () => {
      const research = defs.fast_expansion;

      expect(research.name).toBe('Fast Expansion');
      expect(research.lane).toBe('research');
      expect(research.durationTurns).toBe(14);
      expect(research.costsPerUnit.research_points).toBe(96000);
      expect(research.prerequisites).toEqual(['trader_research']);
    });

    it('defines the Queue Length chain QL5–QL10 (14 turns each) raising the queue length', () => {
      const expected: Array<[string, number, string[]]> = [
        ['ql_5', 10000, []],
        ['ql_6', 20000, ['ql_5']],
        ['ql_7', 50000, ['ql_6']],
        ['ql_8', 100000, ['ql_7']],
        ['ql_9', 250000, ['ql_8']],
        ['ql_10', 1000000, ['ql_9']],
      ];
      for (const [id, rp, prereqs] of expected) {
        const research = defs[id];
        expect(research.lane).toBe('research');
        expect(research.durationTurns).toBe(14);
        expect(research.costsPerUnit.research_points).toBe(rp);
        expect(research.prerequisites).toEqual(prereqs);
        expect(research.effectsOnComplete.queue_length).toBe(Number(id.slice(3)));
      }
    });

    it('grants PL6 at the start: no pl_6 research, pl_8 follows Planet Management', () => {
      expect(defs.pl_6).toBeUndefined();
      expect(defs.pl_8.prerequisites).toEqual(['planet_management']);
      expect(defs.planet_management.effectsOnComplete.unlocks_research).toEqual(['pl_8']);
    });

    it('charges the Space Dock 10 energy upkeep', () => {
      expect(defs.space_dock.upkeepPerUnit.energy).toBe(10);
    });

    it('houses 5,000 scientists per Research Lab', () => {
      expect(defs.research_lab.effectsOnComplete.housing_scientist_cap).toBe(5000);
    });

    it('gives the Outpost +150 energy', () => {
      expect(defs.outpost.effectsOnComplete.production_energy).toBe(150);
    });
  });

  describe('createMinimalStart', () => {
    it('should create minimal test scenario', () => {
      const state = createMinimalStart(defs);

      expect(state).toBeDefined();
      expect(state.currentTurn).toBe(1); // Initial state starts at turn 1
    });

    it('should have minimal starting resources', () => {
      const state = createMinimalStart(defs);

      expect(state.stocks.metal).toBe(10000);
      expect(state.stocks.mineral).toBe(10000);
      expect(state.stocks.food).toBe(500);
      expect(state.stocks.energy).toBe(0);
    });

    it('should have minimal starting population', () => {
      const state = createMinimalStart(defs);

      expect(state.population.workersTotal).toBe(10000);
      expect(state.population.soldiers).toBe(0);
      expect(state.population.scientists).toBe(0);
    });

    it('should have only outpost structure', () => {
      const state = createMinimalStart(defs);

      expect(state.completedCounts.outpost).toBe(1);
      expect(Object.keys(state.completedCounts)).toHaveLength(1);
    });

    it('should have housing from outpost only', () => {
      const state = createMinimalStart(defs);

      expect(state.housing.workerCap).toBe(50000);
      expect(state.housing.soldierCap).toBe(100000);
      expect(state.housing.scientistCap).toBe(0);
    });

    it('should have no space used (outpost has no space cost)', () => {
      const state = createMinimalStart(defs);

      expect(state.space.groundUsed).toBe(0);
      expect(state.space.orbitalUsed).toBe(0);
    });
  });

  describe('outpost ship in seed', () => {
    it('createStandardStart includes outpost_ship = 1', () => {
      const state = createStandardStart(defs);
      expect(state.completedCounts.outpost_ship).toBe(1);
    });
  });

  describe('State validity', () => {
    it('should produce valid PlanetState for standard start', () => {
      const state = createStandardStart(defs);

      // Validate all required fields
      expect(state.currentTurn).toBeDefined();
      expect(state.stocks).toBeDefined();
      expect(state.abundance).toBeDefined();
      expect(state.population).toBeDefined();
      expect(state.space).toBeDefined();
      expect(state.housing).toBeDefined();
      expect(state.lanes).toBeDefined();
      expect(state.completedCounts).toBeDefined();
      expect(state.pendingColonistConversions).toBeDefined();
    });

    it('should have consistent worker count (total = idle + busy)', () => {
      const state = createStandardStart(defs);

      const busyTotal = Object.values(state.population.busyByLane).reduce(
        (sum, count) => sum + count,
        0
      );

      expect(state.population.workersTotal).toBe(
        state.population.workersIdle + busyTotal
      );
    });

    it('should have housing capacity >= current population', () => {
      const state = createStandardStart(defs);

      expect(state.housing.workerCap).toBeGreaterThanOrEqual(
        state.population.workersTotal
      );
      expect(state.housing.soldierCap).toBeGreaterThanOrEqual(
        state.population.soldiers
      );
      expect(state.housing.scientistCap).toBeGreaterThanOrEqual(
        state.population.scientists
      );
    });

    it('should have space capacity >= current space used', () => {
      const state = createStandardStart(defs);

      expect(state.space.groundCap).toBeGreaterThanOrEqual(
        state.space.groundUsed
      );
      expect(state.space.orbitalCap).toBeGreaterThanOrEqual(
        state.space.orbitalUsed
      );
    });
  });
});
