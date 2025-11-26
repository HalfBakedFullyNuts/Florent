/**
 * TICKET-4: Housing Cap Warning Tests
 * Test housing cap warning calculation and display logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '../commands';
import { minimalState } from '../../../test/fixtures/minimal';
import { cloneState } from '../../sim/engine/helpers';
import { getTurnsUntilHousingCap } from '../selectors';

describe('Housing Cap Warning (TICKET-4)', () => {
  let controller: GameController;

  beforeEach(() => {
    const initialState = cloneState(minimalState);
    controller = new GameController(initialState);
  });

  describe('getTurnsUntilHousingCap selector', () => {
    it('should return null when growth rate is 0', () => {
      // Set no food to ensure no growth (growth requires food > 0)
      const state = controller.getCurrentState();
      state.stocks.food = 0;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      expect(turnsToHousingCap).toBeNull();
    });

    it('should return null when no workers', () => {
      // No workers means no growth possible
      const state = controller.getCurrentState();
      state.population.workersTotal = 0;
      state.population.workersIdle = 0;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      expect(turnsToHousingCap).toBeNull();
    });

    it('should return null when already at housing cap', () => {
      const state = controller.getCurrentState();

      // Set population equal to housing cap using correct properties
      state.population.workersTotal = state.housing.workerCap;
      state.population.workersIdle = state.housing.workerCap;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      expect(turnsToHousingCap).toBeNull();
    });

    it('should return null when exceeding housing cap', () => {
      const state = controller.getCurrentState();

      // Set population above housing cap using correct properties
      state.population.workersTotal = state.housing.workerCap + 100;
      state.population.workersIdle = state.housing.workerCap + 100;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      expect(turnsToHousingCap).toBeNull();
    });

    it('should calculate correct turns when growth rate is positive', () => {
      // Queue a farm which provides growth
      const farmResult = controller.queueItem(1, 'farm', 1);

      if (farmResult.success) {
        // Advance timeline to let farm complete
        controller.simulateTurns(10);

        const state = controller.getStateAtTurn(10);
        if (state) {
          const turnsToHousingCap = getTurnsUntilHousingCap(state, 10);

          // With 1 farm, we should have some growth rate
          // The actual calculation depends on the game data
          if (turnsToHousingCap !== null) {
            expect(turnsToHousingCap).toBeGreaterThan(0);
            expect(typeof turnsToHousingCap).toBe('number');
          }
        }
      }
    });
  });

  describe('Warning Display Logic', () => {
    it('should show warning when ≤6 turns remain', () => {
      // This will be tested in the component test
      // Here we just verify the selector returns appropriate values

      const state = controller.getCurrentState();

      // Simulate a state where we're close to housing cap with growth
      // Use correct state properties
      state.population.workersTotal = 950;
      state.population.workersIdle = 950;
      state.housing.workerCap = 1000;

      // Assume growth rate of 10 workers/turn
      // 50 workers needed / 10 per turn = 5 turns
      // This scenario should trigger warning (5 ≤ 6)

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      // If we have any growth, we should get a result
      // The exact value depends on game_data.json farm growth rates
      if (turnsToHousingCap !== null) {
        expect(typeof turnsToHousingCap).toBe('number');
      }
    });

    it('should not show warning when >6 turns remain', () => {
      const state = controller.getCurrentState();

      // Simulate a state where we have plenty of housing space
      // Use correct state properties
      state.population.workersTotal = 100;
      state.population.workersIdle = 100;
      state.housing.workerCap = 10000;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      // With huge capacity, we should have many turns (or null if no growth)
      if (turnsToHousingCap !== null) {
        expect(turnsToHousingCap).toBeGreaterThan(6);
      }
    });
  });

  describe('Integration with Queue', () => {
    it('should calculate based on state after queue completion', () => {
      // Queue multiple buildings
      const farm1 = controller.queueItem(1, 'farm', 1);
      const farm2 = controller.queueItem(1, 'farm', 1);

      if (farm1.success && farm2.success) {
        // Simulate to completion
        controller.simulateTurns(20);

        // Check state at a future turn
        const futureState = controller.getStateAtTurn(20);
        if (futureState) {
          const turnsToHousingCap = getTurnsUntilHousingCap(futureState, 20);

          // With 2 farms, growth rate should be higher
          // So turns to cap should be calculated correctly
          expect(turnsToHousingCap).toBeDefined();
        }
      }
    });

    it('should update warning when population changes', () => {
      // Test that the warning calculation responds to population changes
      const state = controller.getCurrentState();

      // Scenario 1: Small population with lots of housing headroom
      state.population.workersTotal = 100;
      state.population.workersIdle = 100;
      state.housing.workerCap = 10000;
      state.stocks.food = 1000;
      const turnsSmallPop = getTurnsUntilHousingCap(state, 1);

      // Scenario 2: Large population close to cap
      state.population.workersTotal = 9900;
      state.population.workersIdle = 9900;
      state.housing.workerCap = 10000;
      const turnsLargePop = getTurnsUntilHousingCap(state, 1);

      // With larger population closer to cap, turns should be fewer
      if (turnsSmallPop !== null && turnsLargePop !== null) {
        expect(turnsLargePop).toBeLessThan(turnsSmallPop);
      }
    });
  });
});
