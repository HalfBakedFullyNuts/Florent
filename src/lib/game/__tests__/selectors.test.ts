/**
 * Tests for Selectors - Read-only projections
 * Ticket 10: Public read selectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPlanetSummary,
  getLaneView,
  getWarnings,
  getAvailableItems,
  canQueueItem,
} from '../selectors';
import type { PlanetState } from '../../sim/engine/types';
import { minimalState } from '../../../test/fixtures/minimal';
import { cloneState } from '../../sim/engine/helpers';

describe('Selectors', () => {
  let state: PlanetState;

  beforeEach(() => {
    state = cloneState(minimalState);
  });

  describe('getPlanetSummary', () => {
    it('should return complete planet summary', () => {
      const summary = getPlanetSummary(state);

      expect(summary.turn).toBe(0);
      expect(summary.stocks).toEqual(state.stocks);
      expect(summary.space).toEqual(state.space);
      expect(summary.housing).toEqual(state.housing);
    });

    it('should calculate net outputs per turn', () => {
      const summary = getPlanetSummary(state);

      // Outpost produces 300 metal, 200 mineral, 100 food, 100 energy
      expect(summary.outputsPerTurn.metal).toBe(300);
      expect(summary.outputsPerTurn.mineral).toBe(200);
      expect(summary.outputsPerTurn.food).toBe(100);
      expect(summary.outputsPerTurn.energy).toBe(100);
    });

    it('should calculate busy workers from all lanes', () => {
      state.population.busyByLane.building = 5000;
      state.population.busyByLane.ship = 3000;
      state.population.busyByLane.colonist = 2000;

      const summary = getPlanetSummary(state);

      expect(summary.population.workersBusy).toBe(10000);
    });

    it('should provide growth hint when food > 0', () => {
      state.stocks.food = 1000;
      const summary = getPlanetSummary(state);

      // 10000 workers * 1% base growth = 100 workers
      expect(summary.growthHint).toContain('+100 workers');
    });

    it('should show no growth hint when food <= 0', () => {
      state.stocks.food = 0;
      const summary = getPlanetSummary(state);

      expect(summary.growthHint).toBe('No growth (need food > 0)');
    });

    it('should calculate food upkeep', () => {
      state.population.workersTotal = 10000;
      const summary = getPlanetSummary(state);

      // 10000 workers * 0.002 = 20 food per turn
      expect(summary.foodUpkeep).toBe(20);
    });

    it('should include population stats', () => {
      state.population.soldiers = 500;
      state.population.scientists = 250;
      const summary = getPlanetSummary(state);

      expect(summary.population.workersTotal).toBe(10000);
      expect(summary.population.soldiers).toBe(500);
      expect(summary.population.scientists).toBe(250);
    });
  });

  describe('getLaneView', () => {
    it('should return empty entries when lane is idle', () => {
      const view = getLaneView(state, 'building');

      expect(view.laneId).toBe('building');
      expect(view.entries).toHaveLength(0);
    });

    it('should include pending entry with no ETA', () => {
      state.lanes.building.pendingQueue = [{
        id: 'pending_1',
        itemId: 'metal_mine',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 4,
      }];

      const view = getLaneView(state, 'building');

      expect(view.entries).toHaveLength(1);
      expect(view.entries[0].status).toBe('pending');
      expect(view.entries[0].itemName).toBe('Metal Mine');
      expect(view.entries[0].eta).toBeNull();
      expect(view.entries[0].turnsRemaining).toBe(4);
    });

    it('should include active entry with calculated ETA', () => {
      state.currentTurn = 5;
      state.lanes.building.active = {
        id: 'active_1',
        itemId: 'metal_mine',
        status: 'active',
        quantity: 1,
        turnsRemaining: 3,
      };

      const view = getLaneView(state, 'building');

      expect(view.entries).toHaveLength(1);
      expect(view.entries[0].status).toBe('active');
      expect(view.entries[0].eta).toBe(8); // Turn 5 + 3 remaining
      expect(view.entries[0].turnsRemaining).toBe(3);
    });

    it('should include both pending and active entries', () => {
      state.lanes.building.pendingQueue = [{
        id: 'pending_1',
        itemId: 'farm',
        status: 'pending',
        quantity: 1,
        turnsRemaining: 4,
      }];

      state.lanes.building.active = {
        id: 'active_1',
        itemId: 'metal_mine',
        status: 'active',
        quantity: 1,
        turnsRemaining: 2,
      };

      const view = getLaneView(state, 'building');

      expect(view.entries).toHaveLength(2);
      expect(view.entries[0].status).toBe('pending');
      expect(view.entries[1].status).toBe('active');
    });

    it('should work for all lane types', () => {
      const buildingView = getLaneView(state, 'building');
      const shipView = getLaneView(state, 'ship');
      const colonistView = getLaneView(state, 'colonist');

      expect(buildingView.laneId).toBe('building');
      expect(shipView.laneId).toBe('ship');
      expect(colonistView.laneId).toBe('colonist');
    });
  });

  describe('getWarnings', () => {
    it('should return no warnings for healthy state', () => {
      state.stocks.energy = 100;
      state.stocks.food = 500;
      const warnings = getWarnings(state);

      expect(warnings).toHaveLength(0); // No warnings for healthy state (idle lane warnings removed)
    });

    it('should warn when energy is negative', () => {
      state.stocks.energy = -10;
      const warnings = getWarnings(state);

      const energyWarning = warnings.find((w) => w.type === 'NEGATIVE_ENERGY');
      expect(energyWarning).toBeDefined();
      expect(energyWarning?.severity).toBe('error');
      expect(energyWarning?.message).toContain('Energy is negative');
    });

    it('should warn when food is zero or negative', () => {
      state.stocks.food = 0;
      const warnings = getWarnings(state);

      const foodWarning = warnings.find((w) => w.type === 'NO_FOOD');
      expect(foodWarning).toBeDefined();
      expect(foodWarning?.severity).toBe('warning');
      expect(foodWarning?.message).toContain('No food available');
    });

    it('should warn when worker housing is near capacity', () => {
      state.population.workersTotal = 47500; // 95% of 50000
      const warnings = getWarnings(state);

      const housingWarning = warnings.find((w) => w.type === 'HOUSING_FULL');
      expect(housingWarning).toBeDefined();
      expect(housingWarning?.message).toContain('Worker housing near capacity');
    });

    it('should warn when soldier housing is near capacity', () => {
      state.population.soldiers = 95000; // 95% of 100000
      const warnings = getWarnings(state);

      const housingWarning = warnings.find(
        (w) => w.type === 'HOUSING_FULL' && w.message.includes('Soldier')
      );
      expect(housingWarning).toBeDefined();
    });

    it('should warn when ground space is near capacity', () => {
      state.space.groundUsed = 57; // 95% of 60
      const warnings = getWarnings(state);

      const spaceWarning = warnings.find(
        (w) => w.type === 'SPACE_FULL' && w.message.includes('Ground')
      );
      expect(spaceWarning).toBeDefined();
      expect(spaceWarning?.severity).toBe('warning');
    });

    it('should warn when orbital space is near capacity', () => {
      state.space.orbitalUsed = 38; // 95% of 40
      const warnings = getWarnings(state);

      const spaceWarning = warnings.find(
        (w) => w.type === 'SPACE_FULL' && w.message.includes('Orbital')
      );
      expect(spaceWarning).toBeDefined();
    });

    it('should not generate warnings for idle lanes', () => {
      const warnings = getWarnings(state);

      // Idle lane warnings have been removed - check that they don't exist
      const idleWarnings = warnings.filter((w) => w.type === 'IDLE_LANE');
      expect(idleWarnings).toHaveLength(0);
    });

    it('should combine multiple warnings', () => {
      state.stocks.energy = -5;
      state.stocks.food = 0;
      state.space.groundUsed = 57;

      const warnings = getWarnings(state);

      expect(warnings.some((w) => w.type === 'NEGATIVE_ENERGY')).toBe(true);
      expect(warnings.some((w) => w.type === 'NO_FOOD')).toBe(true);
      expect(warnings.some((w) => w.type === 'SPACE_FULL')).toBe(true);
      expect(warnings.length).toBeGreaterThanOrEqual(3); // At least 3 warnings (no idle warnings)
    });
  });

  describe('getAvailableItems', () => {
    it('should return all item definitions', () => {
      const items = getAvailableItems(state);

      expect(items).toBeDefined();
      expect(items.outpost).toBeDefined();
      expect(items.metal_mine).toBeDefined();
      expect(items.farm).toBeDefined();
    });

    it('should include item names and properties', () => {
      const items = getAvailableItems(state);

      expect(items.metal_mine.name).toBe('Metal Mine');
      expect(items.metal_mine.lane).toBe('building');
      expect(items.metal_mine.durationTurns).toBe(4);
    });
  });

  describe('canQueueItem', () => {
    it('should return false for non-existent item', () => {
      const result = canQueueItem(state, 'nonexistent_item', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Item not found');
    });

    it('should return false when queue is full', () => {
      // Fill queue to max depth
      state.lanes.building.pendingQueue = Array(10).fill(null).map((_, i) => ({
        id: `pending_${i}`,
        itemId: 'farm',
        status: 'pending' as const,
        quantity: 1,
        turnsRemaining: 4,
      }));

      const result = canQueueItem(state, 'metal_mine', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Queue is full');
    });

    it('should return false when lane is busy with active item', () => {
      state.lanes.building.active = {
        id: 'active_1',
        itemId: 'farm',
        status: 'active',
        quantity: 1,
        turnsRemaining: 2,
      };

      const result = canQueueItem(state, 'metal_mine', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Lane is busy');
    });

    it('should return true when lane is available', () => {
      const result = canQueueItem(state, 'metal_mine', 1);

      expect(result.allowed).toBe(true);
    });

    it('should check correct lane for each item type', () => {
      // Building lane is free, so metal_mine (building) should be allowed
      const buildingResult = canQueueItem(state, 'metal_mine', 1);
      expect(buildingResult.allowed).toBe(true);

      // Colonist lane is free, but soldier needs barracks (prerequisite missing)
      const colonistResult = canQueueItem(state, 'soldier', 1);
      expect(colonistResult.allowed).toBe(false);
      expect(colonistResult.reason).toBe('REQ_MISSING');

      // Add barracks to meet prerequisites
      state.completedCounts.barracks = 1;
      const colonistResultAfterBarracks = canQueueItem(state, 'soldier', 1);
      expect(colonistResultAfterBarracks.allowed).toBe(true);
    });
  });
});
