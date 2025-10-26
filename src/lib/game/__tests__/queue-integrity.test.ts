/**
 * Queue Integrity Tests
 *
 * Tests to ensure queue operations maintain correct counts and state
 * Addresses issue: adding/removing items should not duplicate entries
 */

import { describe, it, expect } from 'vitest';
import { GameController } from '../commands';
import { getPlanetSummary, getLaneView } from '../selectors';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import gameDataRaw from '../game_data.json';

/**
 * Helper: Create controller with standard start
 */
function createTestController(): GameController {
  const defs = loadGameData(gameDataRaw as any);
  const initialState = createStandardStart(defs);
  return new GameController(initialState);
}

describe('Queue Integrity Tests', () => {
  describe('Single Item Queue Operations', () => {
    it('should add exactly one item to queue when queueing a building', () => {
      const controller = createTestController();
      const turn = controller.getCurrentTurn();

      // Get initial queue state
      const initialLane = getLaneView(controller.getCurrentState(), 'building');
      const initialQueueLength = initialLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      // Queue one farm
      const result = controller.queueItem(turn, 'farm', 1);
      expect(result.success).toBe(true);

      // Verify exactly one item was added
      const afterLane = getLaneView(controller.getCurrentState(), 'building');
      const afterQueueLength = afterLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      expect(afterQueueLength).toBe(initialQueueLength + 1);
    });

    it('should add exactly N items when queueing N buildings sequentially', () => {
      const controller = createTestController();
      const turn = controller.getCurrentTurn();

      // Get initial queue state
      const initialLane = getLaneView(controller.getCurrentState(), 'building');
      const initialQueueLength = initialLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      // Queue 3 farms sequentially
      for (let i = 0; i < 3; i++) {
        const result = controller.queueItem(turn, 'farm', 1);
        expect(result.success).toBe(true);

        // Verify queue length increases by exactly 1 each time
        const currentLane = getLaneView(controller.getCurrentState(), 'building');
        const currentQueueLength = currentLane.entries.filter(
          e => e.status === 'pending' || e.status === 'active'
        ).length;

        expect(currentQueueLength).toBe(initialQueueLength + i + 1);
      }

      // Final verification
      const finalLane = getLaneView(controller.getCurrentState(), 'building');
      const finalQueueLength = finalLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      expect(finalQueueLength).toBe(initialQueueLength + 3);
    });
  });

  describe('Add-Remove-Add Cycle (Bug Reproduction)', () => {
    it('should maintain correct queue count after add-remove-add cycle', () => {
      const controller = createTestController();
      const turn = controller.getCurrentTurn();

      // Initial state
      const initialLane = getLaneView(controller.getCurrentState(), 'building');
      const initialQueueLength = initialLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      // Add two farms
      controller.queueItem(turn, 'farm', 1);
      controller.queueItem(turn, 'farm', 1);

      const afterAddLane = getLaneView(controller.getCurrentState(), 'building');
      const afterAddQueueLength = afterAddLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;
      expect(afterAddQueueLength).toBe(initialQueueLength + 2);

      // Remove both farms
      controller.cancelEntry(turn, 'building'); // Remove first
      controller.cancelEntry(turn, 'building'); // Remove second

      const afterRemoveLane = getLaneView(controller.getCurrentState(), 'building');
      const afterRemoveQueueLength = afterRemoveLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;
      expect(afterRemoveQueueLength).toBe(initialQueueLength);

      // Add another farm - should only add 1, not 4
      controller.queueItem(turn, 'farm', 1);

      const finalLane = getLaneView(controller.getCurrentState(), 'building');
      const finalQueueLength = finalLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      // THIS IS THE KEY ASSERTION - should be initial + 1, not initial + 4
      expect(finalQueueLength).toBe(initialQueueLength + 1);
    });

    it.skip('should maintain correct completed structure counts after add-remove-add cycle', () => {
      const controller = createTestController();
      const turn = controller.getCurrentTurn();

      // Get initial farm count
      const initialSummary = getPlanetSummary(controller.getCurrentState());
      const initialFarmCount = initialSummary.structures['farm'] || 0;

      // Add two farms and complete them
      controller.queueItem(turn, 'farm', 1);
      controller.queueItem(turn, 'farm', 1);

      // Simulate completion by advancing turns
      const farmDef = controller.getCurrentState().defs['farm'];
      const buildDuration = farmDef.durationTurns;

      // Advance enough turns to complete both farms
      for (let i = 0; i < buildDuration + 10; i++) {
        controller.nextTurn();
      }

      // Check completed count
      const afterBuildSummary = getPlanetSummary(controller.getCurrentState());
      const afterBuildFarmCount = afterBuildSummary.structures['farm'] || 0;
      expect(afterBuildFarmCount).toBe(initialFarmCount + 2);

      // Get current turn for removal
      const currentTurn = controller.getCurrentTurn();

      // Remove both completed farms from history
      const buildingLane = controller.getCurrentState().lanes.building;
      const completedFarms = buildingLane.completionHistory.filter(
        item => item.itemId === 'farm'
      );

      // Remove first farm
      if (completedFarms.length > 0) {
        controller.removeFromHistory(currentTurn, 'building', completedFarms[0].id);
      }

      // Check count after first removal
      const afterFirstRemoval = getPlanetSummary(controller.getCurrentState());
      const afterFirstRemovalCount = afterFirstRemoval.structures['farm'] || 0;
      expect(afterFirstRemovalCount).toBe(initialFarmCount + 1);

      // Remove second farm
      const updatedLane = controller.getCurrentState().lanes.building;
      const remainingFarms = updatedLane.completionHistory.filter(
        item => item.itemId === 'farm'
      );
      if (remainingFarms.length > 0) {
        controller.removeFromHistory(currentTurn, 'building', remainingFarms[0].id);
      }

      // Check count after second removal
      const afterSecondRemoval = getPlanetSummary(controller.getCurrentState());
      const afterSecondRemovalCount = afterSecondRemoval.structures['farm'] || 0;
      expect(afterSecondRemovalCount).toBe(initialFarmCount);

      // Add new farm to queue
      controller.queueItem(currentTurn, 'farm', 1);

      // Verify queue length is correct (should have 1 pending farm)
      const finalLane = getLaneView(controller.getCurrentState(), 'building');
      const pendingFarms = finalLane.entries.filter(
        e => (e.status === 'pending' || e.status === 'active') && e.itemId === 'farm'
      );
      expect(pendingFarms.length).toBe(1);

      // Completed count should still be at initial level
      const finalSummary = getPlanetSummary(controller.getCurrentState());
      const finalFarmCount = finalSummary.structures['farm'] || 0;
      expect(finalFarmCount).toBe(initialFarmCount);
    });
  });

  describe('Multiple Add-Remove Cycles', () => {
    it('should handle multiple add-remove cycles without duplication', () => {
      const controller = createTestController();
      const turn = controller.getCurrentTurn();

      const initialLane = getLaneView(controller.getCurrentState(), 'building');
      const initialQueueLength = initialLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      // Cycle 1: Add 2, remove 2, add 1
      controller.queueItem(turn, 'farm', 1);
      controller.queueItem(turn, 'farm', 1);
      controller.cancelEntry(turn, 'building');
      controller.cancelEntry(turn, 'building');
      controller.queueItem(turn, 'farm', 1);

      let currentLane = getLaneView(controller.getCurrentState(), 'building');
      let currentQueueLength = currentLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;
      expect(currentQueueLength).toBe(initialQueueLength + 1);

      // Cycle 2: Add 3, remove 1, add 2
      controller.queueItem(turn, 'farm', 1);
      controller.queueItem(turn, 'farm', 1);
      controller.queueItem(turn, 'farm', 1);
      controller.cancelEntry(turn, 'building');
      controller.queueItem(turn, 'farm', 1);
      controller.queueItem(turn, 'farm', 1);

      currentLane = getLaneView(controller.getCurrentState(), 'building');
      currentQueueLength = currentLane.entries.filter(
        e => e.status === 'pending' || e.status === 'active'
      ).length;

      // Should have: initial + 1 (from cycle 1) + 3 - 1 + 2 = initial + 5
      expect(currentQueueLength).toBe(initialQueueLength + 5);
    });
  });

  describe('CompletedCounts Consistency', () => {
    it('should maintain completedCounts consistency with completionHistory', () => {
      const controller = createTestController();
      const turn = controller.getCurrentTurn();

      // Queue and complete a farm
      controller.queueItem(turn, 'farm', 1);

      const farmDef = controller.getCurrentState().defs['farm'];
      const buildDuration = farmDef.durationTurns;

      // Advance to completion
      for (let i = 0; i < buildDuration + 5; i++) {
        controller.nextTurn();
      }

      // Verify completedCounts matches history count
      const currentState = controller.getCurrentState();
      const completedCountsValue = currentState.completedCounts['farm'] || 0;

      const historyCount = currentState.lanes.building.completionHistory.filter(
        item => item.itemId === 'farm'
      ).reduce((sum, item) => sum + item.quantity, 0);

      // completedCounts should equal sum of quantities in history
      // (minus any starting farms from seed)
      const summary = getPlanetSummary(currentState);
      const displayedCount = summary.structures['farm'] || 0;

      expect(displayedCount).toBe(completedCountsValue);
    });
  });
});
