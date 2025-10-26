/**
 * Tests for Data Adapter
 * Ticket 11: Adapter - Convert game_data.json to engine format
 */

import { describe, it, expect } from 'vitest';
import { loadGameData } from '../adapter';
import gameDataJson from '../../../game/game_data.json';

describe('Data Adapter', () => {
  describe('loadGameData', () => {
    it('should load and convert all game data', () => {
      const defs = loadGameData(gameDataJson as any);

      expect(defs).toBeDefined();
      expect(Object.keys(defs).length).toBeGreaterThan(0);
    });

    it('should convert all units from game data', () => {
      const defs = loadGameData(gameDataJson as any);

      // Check for specific units
      expect(defs.worker).toBeDefined();
      expect(defs.soldier).toBeDefined();
      expect(defs.scientist).toBeDefined();
      expect(defs.fighter).toBeDefined();
      expect(defs.bomber).toBeDefined();
    });

    it('should convert all structures from game data', () => {
      const defs = loadGameData(gameDataJson as any);

      // Check for specific structures
      expect(defs.outpost).toBeDefined();
      expect(defs.farm).toBeDefined();
      expect(defs.metal_mine).toBeDefined();
      expect(defs.army_barracks).toBeDefined();
      expect(defs.shipyard).toBeDefined();
    });
  });

  describe('Unit Conversion', () => {
    let defs: Record<string, any>;

    beforeEach(() => {
      defs = loadGameData(gameDataJson as any);
    });

    describe('Colonist conversion', () => {
      it('should convert worker correctly', () => {
        const worker = defs.worker;

        expect(worker.id).toBe('worker');
        expect(worker.name).toBe('Worker');
        expect(worker.lane).toBe('colonist');
        expect(worker.type).toBe('soldier'); // Workers use soldier type
        expect(worker.durationTurns).toBe(1);
        expect(worker.costsPerUnit.workers).toBe(0);
        expect(worker.prerequisites).toEqual([]);
      });

      it('should convert soldier correctly', () => {
        const soldier = defs.soldier;

        expect(soldier.id).toBe('soldier');
        expect(soldier.name).toBe('Soldier');
        expect(soldier.lane).toBe('colonist');
        expect(soldier.type).toBe('soldier');
        expect(soldier.colonistKind).toBe('soldier');
        expect(soldier.durationTurns).toBe(4);

        // Check costs
        expect(soldier.costsPerUnit.metal).toBe(12);
        expect(soldier.costsPerUnit.mineral).toBe(8);
        expect(soldier.costsPerUnit.food).toBe(20);
        expect(soldier.costsPerUnit.workers).toBe(10); // Reserved during training

        // Check prerequisites
        expect(soldier.prerequisites).toContain('army_barracks');
      });

      it('should convert scientist correctly', () => {
        const scientist = defs.scientist;

        expect(scientist.id).toBe('scientist');
        expect(scientist.name).toBe('Scientist');
        expect(scientist.lane).toBe('colonist');
        expect(scientist.type).toBe('scientist');
        expect(scientist.colonistKind).toBe('scientist');
        expect(scientist.durationTurns).toBe(8);

        // Check costs
        expect(scientist.costsPerUnit.metal).toBe(5);
        expect(scientist.costsPerUnit.mineral).toBe(20);
        expect(scientist.costsPerUnit.food).toBe(25);
        expect(scientist.costsPerUnit.workers).toBe(25); // Reserved during training

        // Check prerequisites
        expect(scientist.prerequisites).toContain('research_lab');
      });
    });

    describe('Ship conversion', () => {
      it('should convert fighter correctly', () => {
        const fighter = defs.fighter;

        expect(fighter.id).toBe('fighter');
        expect(fighter.name).toBe('Fighter');
        expect(fighter.lane).toBe('ship');
        expect(fighter.type).toBe('ship');
        expect(fighter.durationTurns).toBe(4);

        // Check costs
        expect(fighter.costsPerUnit.metal).toBe(1500);
        expect(fighter.costsPerUnit.mineral).toBe(350);
        expect(fighter.costsPerUnit.workers).toBe(500);

        // Check prerequisites
        expect(fighter.prerequisites).toContain('shipyard');
        expect(fighter.prerequisites).toContain('light_weapons_factory');
      });

      it('should convert bomber correctly', () => {
        const bomber = defs.bomber;

        expect(bomber.id).toBe('bomber');
        expect(bomber.name).toBe('Bomber');
        expect(bomber.lane).toBe('ship');
        expect(bomber.type).toBe('ship');
        expect(bomber.durationTurns).toBe(6);

        // Check costs
        expect(bomber.costsPerUnit.metal).toBe(1500);
        expect(bomber.costsPerUnit.mineral).toBe(3000);
        expect(bomber.costsPerUnit.workers).toBe(1500);
      });

      it('should convert large ships correctly', () => {
        const battleship = defs.battleship;

        expect(battleship.id).toBe('battleship');
        expect(battleship.name).toBe('Battleship');
        expect(battleship.lane).toBe('ship');
        expect(battleship.durationTurns).toBe(26);

        // Large costs
        expect(battleship.costsPerUnit.metal).toBe(30000);
        expect(battleship.costsPerUnit.mineral).toBe(600000);
        expect(battleship.costsPerUnit.workers).toBe(300000);
      });
    });

    describe('Unit upkeep', () => {
      it('should set zero upkeep for all units', () => {
        const soldier = defs.soldier;
        const fighter = defs.fighter;

        expect(soldier.upkeepPerUnit).toEqual({
          metal: 0,
          mineral: 0,
          food: 0,
          energy: 0,
        });

        expect(fighter.upkeepPerUnit).toEqual({
          metal: 0,
          mineral: 0,
          food: 0,
          energy: 0,
        });
      });
    });

    describe('Unit effects', () => {
      it('should set empty effects for all units', () => {
        const soldier = defs.soldier;
        const fighter = defs.fighter;

        expect(soldier.effectsOnComplete).toEqual({});
        expect(fighter.effectsOnComplete).toEqual({});
      });
    });

    describe('Unit abundance scaling', () => {
      it('should set isAbundanceScaled to false for all units', () => {
        const soldier = defs.soldier;
        const fighter = defs.fighter;

        expect(soldier.isAbundanceScaled).toBe(false);
        expect(fighter.isAbundanceScaled).toBe(false);
      });
    });
  });

  describe('Structure Conversion', () => {
    let defs: Record<string, any>;

    beforeEach(() => {
      defs = loadGameData(gameDataJson as any);
    });

    describe('Basic structure', () => {
      it('should convert outpost correctly', () => {
        const outpost = defs.outpost;

        expect(outpost.id).toBe('outpost');
        expect(outpost.name).toBe('Outpost');
        expect(outpost.lane).toBe('building');
        expect(outpost.type).toBe('structure');
        expect(outpost.durationTurns).toBe(0); // Instant build

        // No costs for outpost
        expect(outpost.costsPerUnit.metal).toBe(0);
        expect(outpost.costsPerUnit.mineral).toBe(0);
        expect(outpost.costsPerUnit.workers).toBe(0);
        expect(outpost.costsPerUnit.space).toBe(0);

        // No prerequisites
        expect(outpost.prerequisites).toEqual([]);
      });

      it('should convert farm correctly', () => {
        const farm = defs.farm;

        expect(farm.id).toBe('farm');
        expect(farm.name).toBe('Farm');
        expect(farm.lane).toBe('building');
        expect(farm.type).toBe('structure');
        expect(farm.durationTurns).toBe(4);

        // Check costs
        expect(farm.costsPerUnit.metal).toBe(1500);
        expect(farm.costsPerUnit.mineral).toBe(1000);
        expect(farm.costsPerUnit.workers).toBe(5000);
        expect(farm.costsPerUnit.space).toBe(1);

        // Check prerequisites
        expect(farm.prerequisites).toContain('outpost');
      });
    });

    describe('Production', () => {
      it('should extract production for outpost', () => {
        const outpost = defs.outpost;

        expect(outpost.effectsOnComplete.production_metal).toBe(300);
        expect(outpost.effectsOnComplete.production_mineral).toBe(200);
        expect(outpost.effectsOnComplete.production_food).toBe(100);
        expect(outpost.effectsOnComplete.production_energy).toBe(100);
      });

      it('should extract production for farm', () => {
        const farm = defs.farm;

        expect(farm.effectsOnComplete.production_food).toBe(100);
      });

      it('should extract production for metal mine', () => {
        const metalMine = defs.metal_mine;

        expect(metalMine.effectsOnComplete.production_metal).toBe(300);
      });
    });

    describe('Abundance scaling', () => {
      it('should set isAbundanceScaled for structures with scaled production', () => {
        const outpost = defs.outpost;
        const farm = defs.farm;

        expect(outpost.isAbundanceScaled).toBe(true); // Has abundance-scaled production
        expect(farm.isAbundanceScaled).toBe(true); // Food is abundance-scaled
      });

      it('should not set isAbundanceScaled for non-production structures', () => {
        const armyBarracks = defs.army_barracks;

        // Army barracks has no production, should not be abundance scaled
        expect(armyBarracks.isAbundanceScaled).toBe(false);
      });
    });

    describe('Upkeep/Consumption', () => {
      it('should extract energy upkeep for farm', () => {
        const farm = defs.farm;

        expect(farm.upkeepPerUnit.energy).toBe(10);
        expect(farm.upkeepPerUnit.metal).toBe(0);
        expect(farm.upkeepPerUnit.mineral).toBe(0);
        expect(farm.upkeepPerUnit.food).toBe(0);
      });

      it('should handle structures with no upkeep', () => {
        const outpost = defs.outpost;

        expect(outpost.upkeepPerUnit).toEqual({
          metal: 0,
          mineral: 0,
          food: 0,
          energy: 0,
        });
      });
    });

    describe('Housing effects', () => {
      it('should extract worker housing from outpost', () => {
        const outpost = defs.outpost;

        expect(outpost.effectsOnComplete.housing_worker_cap).toBe(50000);
      });

      it('should extract soldier housing from outpost', () => {
        const outpost = defs.outpost;

        expect(outpost.effectsOnComplete.housing_soldier_cap).toBe(100000);
      });

      it('should extract worker housing from living quarters', () => {
        const livingQuarters = defs.living_quarters;

        expect(livingQuarters.effectsOnComplete.housing_worker_cap).toBe(50000);
      });
    });

    describe('Space effects', () => {
      it('should extract ground space capacity', () => {
        const landReclamation = defs.land_reclamation;

        expect(landReclamation.effectsOnComplete.space_ground_cap).toBe(1);
      });
    });

    describe('Prerequisites', () => {
      it('should extract structure prerequisites', () => {
        const metalMine = defs.metal_mine;

        expect(metalMine.prerequisites).toContain('outpost');
      });

      it('should extract multiple prerequisites', () => {
        const fighter = defs.fighter;

        expect(fighter.prerequisites).toContain('shipyard');
        expect(fighter.prerequisites).toContain('light_weapons_factory');
      });
    });
  });

  describe('Data Completeness', () => {
    it('should convert expected number of units (15 total)', () => {
      const defs = loadGameData(gameDataJson as any);

      const units = Object.values(defs).filter((def: any) =>
        def.lane === 'colonist' || def.lane === 'ship'
      );

      expect(units.length).toBe(15);
    });

    it('should convert all colonist types (3 total)', () => {
      const defs = loadGameData(gameDataJson as any);

      const colonists = Object.values(defs).filter((def: any) =>
        def.lane === 'colonist'
      );

      expect(colonists.length).toBe(3);
      expect(defs.worker).toBeDefined();
      expect(defs.soldier).toBeDefined();
      expect(defs.scientist).toBeDefined();
    });

    it('should convert all ship types (12 total)', () => {
      const defs = loadGameData(gameDataJson as any);

      const ships = Object.values(defs).filter((def: any) =>
        def.lane === 'ship'
      );

      expect(ships.length).toBe(12);
    });

    it('should convert all structures', () => {
      const defs = loadGameData(gameDataJson as any);

      const structures = Object.values(defs).filter((def: any) =>
        def.lane === 'building'
      );

      // Should have many structures (exact count from game data)
      expect(structures.length).toBeGreaterThan(30);
    });
  });

  describe('Type Safety', () => {
    it('should produce valid ItemDefinition with all required fields', () => {
      const defs = loadGameData(gameDataJson as any);
      const metalMine = defs.metal_mine;

      // Check all required fields exist
      expect(metalMine.id).toBeDefined();
      expect(metalMine.name).toBeDefined();
      expect(metalMine.lane).toBeDefined();
      expect(metalMine.type).toBeDefined();
      expect(metalMine.durationTurns).toBeDefined();
      expect(metalMine.costsPerUnit).toBeDefined();
      expect(metalMine.effectsOnComplete).toBeDefined();
      expect(metalMine.upkeepPerUnit).toBeDefined();
      expect(metalMine.isAbundanceScaled).toBeDefined();
      expect(metalMine.prerequisites).toBeDefined();
    });

    it('should produce valid Costs with all resource fields', () => {
      const defs = loadGameData(gameDataJson as any);
      const metalMine = defs.metal_mine;

      expect(metalMine.costsPerUnit).toHaveProperty('metal');
      expect(metalMine.costsPerUnit).toHaveProperty('mineral');
      expect(metalMine.costsPerUnit).toHaveProperty('food');
      expect(metalMine.costsPerUnit).toHaveProperty('energy');
      expect(metalMine.costsPerUnit).toHaveProperty('workers');
      expect(metalMine.costsPerUnit).toHaveProperty('space');
    });

    it('should produce valid Upkeep with all resource fields', () => {
      const defs = loadGameData(gameDataJson as any);
      const metalMine = defs.metal_mine;

      expect(metalMine.upkeepPerUnit).toHaveProperty('metal');
      expect(metalMine.upkeepPerUnit).toHaveProperty('mineral');
      expect(metalMine.upkeepPerUnit).toHaveProperty('food');
      expect(metalMine.upkeepPerUnit).toHaveProperty('energy');
    });
  });
});
