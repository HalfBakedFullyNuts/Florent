/**
 * Auto-Advance and Queue Validation Tests
 *
 * Tests for CRITICAL-1 and CRITICAL-2 issues:
 * - Scientists not queueable after building auto-advance
 * - Ships throwing "invalid turn" errors
 */

import { describe, it, expect } from 'vitest';
import { GameController } from '../commands';
import { getPlanetSummary, getLaneView, canQueueItem } from '../selectors';
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

/**
 * Helper: Build structures to unlock scientists
 */
function buildScientistPrereqs(controller: GameController): number {
  // Queue and complete 4 mines (metal_mine duration = 4)
  // Queue at T, activates at T+1 with turnsRemaining=4, completes at T+5
  for (let i = 0; i < 4; i++) {
    controller.queueItem(controller.getCurrentTurn(), 'metal_mine', 1);
    controller.simulateTurns(5); // Activation + 4 turns
  }

  // Queue and complete Army Barracks (duration = 8)
  // Queue at T, activates at T+1 with turnsRemaining=8, completes at T+9
  controller.queueItem(controller.getCurrentTurn(), 'army_barracks', 1);
  controller.simulateTurns(9);

  // Queue and complete Research Lab (duration = 14)
  // Queue at T, activates at T+1 with turnsRemaining=14, completes at T+15
  controller.queueItem(controller.getCurrentTurn(), 'research_lab', 1);
  controller.simulateTurns(15);

  return controller.getCurrentTurn();
}

describe('Auto-Advance Queue Validation Tests', () => {
  describe('CRITICAL-1: Scientists After Building Auto-Advance', () => {
    it('should allow queueing scientists when housing exists at viewed turn', () => {
      const controller = createTestController();

      // Build prerequisites for scientists
      const turnAfterResearchLab = buildScientistPrereqs(controller);

      // Verify research lab is completed
      const state = controller.getCurrentState();
      expect(state.completedCounts['research_lab']).toBe(1);
      expect(state.housing.scientistCap).toBeGreaterThan(0);

      // Check if scientists can be queued at current turn
      const canQueue = canQueueItem(state, 'scientist', 1);
      expect(canQueue.allowed).toBe(true);
    });

    it('should handle lane-specific validation at different turns', () => {
      const controller = createTestController();

      // Queue a building (4 turns)
      const t1 = controller.getCurrentTurn();
      controller.queueItem(t1, 'metal_mine', 1);

      // Simulate to T5 where building completes
      controller.simulateTurns(4);
      const t5 = controller.getCurrentTurn();

      // At T5, building lane should be idle
      const t5State = controller.getStateAtTurn(t5);
      const buildingLane = t5State.lanes.building;
      expect(buildingLane.active).toBeNull();

      // Should be able to queue another building at T5
      const canQueueBuilding = canQueueItem(t5State, 'farm', 1);
      expect(canQueueBuilding.allowed).toBe(true);

      // Colonist lane should also be idle at T5
      const colonistLane = t5State.lanes.colonist;
      expect(colonistLane.active).toBeNull();
    });

    it('should maintain queue integrity when queueing at past turns', () => {
      const controller = createTestController();

      // Simulate some turns
      controller.simulateTurns(10);

      // Go back to turn 5
      const t5State = controller.getStateAtTurn(5);

      // Queue at turn 5
      const result = controller.queueItem(5, 'metal_mine', 1);
      expect(result.success).toBe(true);

      // Verify the queue was modified at turn 5
      const updatedT5State = controller.getStateAtTurn(5);
      const lane = updatedT5State.lanes.building;
      expect(lane.pendingQueue.length + (lane.active ? 1 : 0)).toBeGreaterThan(0);
    });
  });

  describe('CRITICAL-2: Ships Invalid Turn Error', () => {
    it('should simulate required turns when queueing long-duration items', () => {
      const controller = createTestController();

      // Build shipyard to unlock ships
      controller.queueItem(controller.getCurrentTurn(), 'shipyard', 1);
      controller.simulateTurns(20);

      const turnBeforeShip = controller.getCurrentTurn();

      // Queue a ship (67 turns duration)
      const result = controller.queueItem(turnBeforeShip, 'outpost_ship', 1);
      expect(result.success).toBe(true);

      // With fixed 200-turn timeline, all turns 1-200 are pre-computed
      // getTotalTurns() always returns 200
      expect(controller.getTotalTurns()).toBe(200);

      const shipDuration = 67;
      const expectedCompletionTurn = turnBeforeShip + shipDuration;

      // Verify we can access the completion turn without error
      // (should work as long as expectedCompletionTurn <= 200)
      const completionState = controller.getStateAtTurn(expectedCompletionTurn);
      expect(completionState).toBeTruthy();
    });

    it('should handle mixed lane queueing without turn errors', () => {
      const controller = createTestController();

      // Queue buildings
      controller.queueItem(controller.getCurrentTurn(), 'metal_mine', 1);
      controller.simulateTurns(4);

      const turnAfterMine = controller.getCurrentTurn();

      // Build shipyard
      controller.queueItem(turnAfterMine, 'shipyard', 1);
      controller.simulateTurns(20);

      const turnAfterShipyard = controller.getCurrentTurn();

      // Queue ship (should not throw invalid turn error)
      const shipResult = controller.queueItem(turnAfterShipyard, 'freighter', 1);
      expect(shipResult.success).toBe(true);

      // Queue colonist prerequisites
      controller.queueItem(turnAfterShipyard, 'army_barracks', 1);
      controller.simulateTurns(8);
      controller.queueItem(controller.getCurrentTurn(), 'research_lab', 1);
      controller.simulateTurns(12);

      // Queue scientist (should not throw error)
      const scientistResult = controller.queueItem(controller.getCurrentTurn(), 'scientist', 1);
      expect(scientistResult.success).toBe(true);
    });

    it('should validate turn existence before queueing', () => {
      const controller = createTestController();

      // Try to queue at a turn beyond 200 (fixed timeline limit)
      const invalidTurn = 250;
      const state = controller.getStateAtTurn(invalidTurn);
      expect(state).toBeUndefined(); // Beyond 200-turn limit returns undefined

      // Should fail to queue at invalid turn
      const result = controller.queueItem(invalidTurn, 'metal_mine', 1);
      expect(result.success).toBe(false);
    });
  });

  describe('Integration: Auto-Advance with Multiple Lanes', () => {
    it('should handle complex queue sequences with auto-advance', () => {
      const controller = createTestController();

      // Build initial structures
      controller.queueItem(controller.getCurrentTurn(), 'metal_mine', 1);
      controller.simulateTurns(4);
      controller.queueItem(controller.getCurrentTurn(), 'metal_mine', 1);
      controller.simulateTurns(4);
      controller.queueItem(controller.getCurrentTurn(), 'metal_mine', 1);
      controller.simulateTurns(4);
      controller.queueItem(controller.getCurrentTurn(), 'metal_mine', 1);
      controller.simulateTurns(4);

      // Queue army barracks
      controller.queueItem(controller.getCurrentTurn(), 'army_barracks', 1);
      controller.simulateTurns(8);

      // Queue research lab
      controller.queueItem(controller.getCurrentTurn(), 'research_lab', 1);
      controller.simulateTurns(12);

      const turnAfterResearch = controller.getCurrentTurn();

      // Build shipyard
      controller.queueItem(turnAfterResearch, 'shipyard', 1);
      controller.simulateTurns(20);

      const finalTurn = controller.getCurrentTurn();
      const finalState = controller.getCurrentState();

      // Verify all structures are built
      expect(finalState.completedCounts['metal_mine']).toBe(4);
      expect(finalState.completedCounts['army_barracks']).toBe(1);
      expect(finalState.completedCounts['research_lab']).toBe(1);
      expect(finalState.completedCounts['shipyard']).toBe(1);

      // Verify we can queue all unit types
      const canQueueShip = canQueueItem(finalState, 'freighter', 1);
      expect(canQueueShip.allowed).toBe(true);

      const canQueueScientist = canQueueItem(finalState, 'scientist', 1);
      expect(canQueueScientist.allowed).toBe(true);

      const canQueueBuilding = canQueueItem(finalState, 'farm', 1);
      expect(canQueueBuilding.allowed).toBe(true);
    });
  });

  describe('CRITICAL-3: Smart Cancellation', () => {
    it('should remove ship from pending queue using smart cancellation', () => {
      const controller = createTestController();

      // Build shipyard to unlock ships
      controller.queueItem(controller.getCurrentTurn(), 'shipyard', 1);
      controller.simulateTurns(20);

      const queueTurn = controller.getCurrentTurn();

      // Queue a freighter ship (only requires shipyard)
      const result = controller.queueItem(queueTurn, 'freighter', 1);
      expect(result.success).toBe(true);
      const freighterId = result.itemId;

      // Verify ship is in pending queue
      const state = controller.getStateAtTurn(queueTurn);
      const shipLane = state.lanes.ship;
      expect(shipLane.pendingQueue.some(item => item.id === freighterId)).toBe(true);

      // Cancel ship using smart method
      const cancelResult = controller.cancelEntryByIdSmart(queueTurn, 'ship', freighterId);
      expect(cancelResult.success).toBe(true);

      // Verify ship is removed from queue
      const updatedState = controller.getStateAtTurn(queueTurn);
      const updatedLane = updatedState.lanes.ship;
      expect(updatedLane.pendingQueue.some(item => item.id === freighterId)).toBe(false);
    });

    it('should remove active ship when building has started', () => {
      const controller = createTestController();

      // Build shipyard
      controller.queueItem(controller.getCurrentTurn(), 'shipyard', 1);
      controller.simulateTurns(20);

      const queueTurn = controller.getCurrentTurn();

      // Queue a freighter ship (15 turns)
      const result = controller.queueItem(queueTurn, 'freighter', 1);
      expect(result.success).toBe(true);
      const freighterId = result.itemId;

      // Advance several turns so ship becomes active
      controller.simulateTurns(5);
      const laterTurn = controller.getCurrentTurn();

      // Verify ship is now active
      const laterState = controller.getStateAtTurn(laterTurn);
      const shipLane = laterState.lanes.ship;
      expect(shipLane.active?.id).toBe(freighterId);

      // Cancel ship using smart method from original queue turn
      // The smart method should search forward and find it active
      const cancelResult = controller.cancelEntryByIdSmart(queueTurn, 'ship', freighterId);
      expect(cancelResult.success).toBe(true);

      // Verify ship is removed and resources refunded
      const finalState = controller.getStateAtTurn(laterTurn);
      const finalLane = finalState.lanes.ship;
      expect(finalLane.active).toBeNull();
    });

    it('should prevent removal of completed items', () => {
      const controller = createTestController();

      // Build army barracks for soldiers
      controller.queueItem(controller.getCurrentTurn(), 'army_barracks', 1);
      controller.simulateTurns(8);

      const queueTurn = controller.getCurrentTurn();

      // Queue a soldier (4 turns)
      const result = controller.queueItem(queueTurn, 'soldier', 1);
      expect(result.success).toBe(true);
      const soldierId = result.itemId;

      // Simulate enough turns for soldier to complete
      controller.simulateTurns(10);

      // Verify soldier is completed
      const completedState = controller.getCurrentState();
      expect(completedState.completedCounts['soldier']).toBeGreaterThan(0);

      // Try to cancel completed soldier - should fail
      const cancelResult = controller.cancelEntryByIdSmart(queueTurn, 'colonist', soldierId);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.reason).toBe('NOT_FOUND');
    });

    it('should handle cancellation when item is queued but lane is busy', () => {
      const controller = createTestController();

      // Build shipyard
      controller.queueItem(controller.getCurrentTurn(), 'shipyard', 1);
      controller.simulateTurns(20);

      const queueTurn = controller.getCurrentTurn();

      // Queue first freighter (15 turns)
      const firstResult = controller.queueItem(queueTurn, 'freighter', 1);
      expect(firstResult.success).toBe(true);

      // Immediately queue second freighter (will be pending)
      const secondResult = controller.queueItem(queueTurn, 'freighter', 1);
      expect(secondResult.success).toBe(true);
      const secondFreighterId = secondResult.itemId;

      // Verify second freighter is in pending queue at queue turn
      const state = controller.getStateAtTurn(queueTurn);
      const shipLane = state.lanes.ship;
      const inPending = shipLane.pendingQueue.some(item => item.id === secondFreighterId);
      const isActive = shipLane.active?.id === secondFreighterId;
      expect(inPending || isActive).toBe(true);

      // Cancel second freighter using smart method
      const cancelResult = controller.cancelEntryByIdSmart(queueTurn, 'ship', secondFreighterId);
      expect(cancelResult.success).toBe(true);
    });

    it('should work for colonists as well as ships', () => {
      const controller = createTestController();

      // Build prerequisites for scientists
      buildScientistPrereqs(controller);

      const queueTurn = controller.getCurrentTurn();

      // Queue a scientist (30 turns)
      const result = controller.queueItem(queueTurn, 'scientist', 1);
      expect(result.success).toBe(true);
      const scientistId = result.itemId;

      // Advance a few turns
      controller.simulateTurns(5);

      // Cancel scientist using smart method
      const cancelResult = controller.cancelEntryByIdSmart(queueTurn, 'colonist', scientistId);
      expect(cancelResult.success).toBe(true);

      // Verify scientist is removed
      const finalState = controller.getCurrentState();
      const colonistLane = finalState.lanes.colonist;
      expect(colonistLane.active?.id).not.toBe(scientistId);
      expect(colonistLane.pendingQueue.some(item => item.id === scientistId)).toBe(false);
    });
  });
});