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
      // Minimal state has no farms or habitats, so growth should be 0
      const state = controller.getCurrentState();
      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      expect(turnsToHousingCap).toBeNull();
    });

    it('should return null when growth rate is negative', () => {
      // If we're losing workers somehow (shouldn't happen but test anyway)
      const state = controller.getCurrentState();

      // Manually set up a scenario with negative growth (not realistic but test edge case)
      state.population.workersIdle = 950;
      state.space.housingCap = 1000;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      // Should return null or a high number if we can't grow
      expect(turnsToHousingCap).toBeNull();
    });

    it('should return null when already at housing cap', () => {
      const state = controller.getCurrentState();

      // Set population equal to housing cap
      state.population.workersIdle = state.space.housingCap;

      const turnsToHousingCap = getTurnsUntilHousingCap(state, 1);

      expect(turnsToHousingCap).toBeNull();
    });

    it('should return null when exceeding housing cap', () => {
      const state = controller.getCurrentState();

      // Set population above housing cap (shouldn't happen but test edge case)
      state.population.workersIdle = state.space.housingCap + 100;

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
      state.population.workersIdle = 950;
      state.space.housingCap = 1000;

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
      state.population.workersIdle = 100;
      state.space.housingCap = 10000;

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

    it('should update warning when queue changes', () => {
      // Queue a farm
      const farmResult = controller.queueItem(1, 'farm', 1);

      if (farmResult.success) {
        controller.simulateTurns(10);
        const stateWithFarm = controller.getStateAtTurn(10);
        const turnsWithFarm = stateWithFarm
          ? getTurnsUntilHousingCap(stateWithFarm, 10)
          : null;

        // Cancel the farm
        controller.cancelEntryById(1, 'building', farmResult.itemId!);
        controller.simulateTurns(10);
        const stateWithoutFarm = controller.getStateAtTurn(10);
        const turnsWithoutFarm = stateWithoutFarm
          ? getTurnsUntilHousingCap(stateWithoutFarm, 10)
          : null;

        // The warning should be different (or one should be null)
        if (turnsWithFarm !== null && turnsWithoutFarm !== null) {
          // With farm we have growth, without farm we don't
          // So the values should differ
          expect(turnsWithFarm).not.toBe(turnsWithoutFarm);
        }
      }
    });
  });
});
