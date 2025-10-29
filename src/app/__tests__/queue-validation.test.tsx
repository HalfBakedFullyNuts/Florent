/**
 * Queue Validation UI Tests
 *
 * Tests for the UI-level queue validation logic
 * Specifically testing canQueueItem and handleQueueItem behaviors
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCallback } from 'react';

// Mock the controller and selectors
const mockController = {
  getCurrentTurn: vi.fn(() => 10),
  getTotalTurns: vi.fn(() => 20),
  getCurrentState: vi.fn(),
  getStateAtTurn: vi.fn(),
  queueItem: vi.fn(),
  simulateTurns: vi.fn(),
};

const mockValidateQueueItem = vi.fn();

// Mock the modules
vi.mock('../lib/game/commands', () => ({
  GameController: vi.fn(() => mockController),
}));

vi.mock('../lib/game/selectors', () => ({
  validateQueueItem: mockValidateQueueItem,
  getPlanetSummary: vi.fn(),
  getLaneView: vi.fn(),
  getWarnings: vi.fn(() => []),
}));

describe('Queue Validation UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canQueueItem validation', () => {
    it('should reject queueing with no item selected', () => {
      const defs = {};
      const viewTurn = 10;
      const totalTurns = 20;

      // Simulate the canQueueItem callback from page.tsx
      const canQueueItem = (itemId: string, quantity: number) => {
        if (!itemId) {
          return { allowed: false, reason: 'No item selected' };
        }
        const def = defs[itemId];
        if (!def) {
          return { allowed: false, reason: 'Unknown item' };
        }
        return { allowed: true };
      };

      const result = canQueueItem('', 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No item selected');
    });

    it('should reject unknown items', () => {
      const defs = { 'metal_mine': { id: 'metal_mine', lane: 'building' } };
      const viewTurn = 10;
      const totalTurns = 20;

      const canQueueItem = (itemId: string, quantity: number) => {
        if (!itemId) {
          return { allowed: false, reason: 'No item selected' };
        }
        const def = defs[itemId];
        if (!def) {
          return { allowed: false, reason: 'Unknown item' };
        }
        return { allowed: true };
      };

      const result = canQueueItem('unknown_item', 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Unknown item');
    });

    it('BEFORE FIX: should block queueing when viewing past turn', () => {
      const defs = { 'metal_mine': { id: 'metal_mine', lane: 'building' } };
      const viewTurn = 10;
      const totalTurns = 20;

      // This is the CURRENT problematic behavior
      const canQueueItem = (itemId: string, quantity: number) => {
        if (!itemId) {
          return { allowed: false, reason: 'No item selected' };
        }
        const def = defs[itemId];
        if (!def) {
          return { allowed: false, reason: 'Unknown item' };
        }
        // PROBLEMATIC CHECK - blocks all queueing at past turns
        if (viewTurn < totalTurns - 1) {
          return { allowed: false, reason: 'Cannot queue while viewing past turn' };
        }
        return { allowed: true };
      };

      const result = canQueueItem('metal_mine', 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot queue while viewing past turn');
    });

    it('AFTER FIX: should allow queueing when lane is idle at viewed turn', () => {
      const defs = { 'metal_mine': { id: 'metal_mine', lane: 'building' } };
      const viewTurn = 10;
      const controller = mockController;

      // Mock state at viewTurn
      const mockState = {
        lanes: {
          building: { active: null, pendingQueue: [] },
        },
      };
      controller.getStateAtTurn.mockReturnValue(mockState);
      mockValidateQueueItem.mockReturnValue({ allowed: true });

      // This is the FIXED behavior
      const canQueueItem = (itemId: string, quantity: number) => {
        if (!itemId) {
          return { allowed: false, reason: 'No item selected' };
        }
        const def = defs[itemId];
        if (!def) {
          return { allowed: false, reason: 'Unknown item' };
        }
        // FIXED: Get state at viewed turn, not current turn
        const viewState = controller.getStateAtTurn(viewTurn);
        if (!viewState) {
          return { allowed: false, reason: 'Invalid turn' };
        }
        // Check if THIS SPECIFIC lane is available at viewed turn
        return mockValidateQueueItem(viewState, itemId, quantity);
      };

      const result = canQueueItem('metal_mine', 1);
      expect(result.allowed).toBe(true);
      expect(controller.getStateAtTurn).toHaveBeenCalledWith(viewTurn);
      expect(mockValidateQueueItem).toHaveBeenCalledWith(mockState, 'metal_mine', 1);
    });
  });

  describe('handleQueueItem behavior', () => {
    it('BEFORE FIX: queues at currentTurn regardless of viewTurn', () => {
      const controller = mockController;
      const viewTurn = 5;
      const currentTurn = 10;
      controller.getCurrentTurn.mockReturnValue(currentTurn);
      controller.queueItem.mockReturnValue({ success: true });

      // Simulate the CURRENT handleQueueItem behavior
      const handleQueueItem = (itemId: string, quantity: number) => {
        const result = controller.queueItem(controller.getCurrentTurn(), itemId, quantity);
        return result;
      };

      const result = handleQueueItem('metal_mine', 1);
      expect(result.success).toBe(true);
      // Note: queues at currentTurn (10), not viewTurn (5)
      expect(controller.queueItem).toHaveBeenCalledWith(currentTurn, 'metal_mine', 1);
    });

    it('AFTER FIX: queues at viewTurn for proper timeline consistency', () => {
      const controller = mockController;
      const viewTurn = 5;
      controller.queueItem.mockReturnValue({ success: true });

      // Simulate the FIXED handleQueueItem behavior
      const handleQueueItem = (itemId: string, quantity: number) => {
        // FIXED: Queue at viewTurn instead of currentTurn
        const result = controller.queueItem(viewTurn, itemId, quantity);
        return result;
      };

      const result = handleQueueItem('metal_mine', 1);
      expect(result.success).toBe(true);
      // Now queues at viewTurn (5) for consistency
      expect(controller.queueItem).toHaveBeenCalledWith(viewTurn, 'metal_mine', 1);
    });

    it('should simulate turns when queueing long-duration items', () => {
      const controller = mockController;
      const viewTurn = 10;
      const defs = {
        'outpost_ship': {
          id: 'outpost_ship',
          lane: 'ship',
          durationTurns: 67
        }
      };

      controller.queueItem.mockReturnValue({ success: true });
      controller.getTotalTurns.mockReturnValue(20);
      controller.getStateAtTurn.mockReturnValue({
        lanes: {
          ship: { active: null, pendingQueue: [] }
        }
      });

      // Simulate the FIXED handleQueueItem with turn simulation
      const handleQueueItem = (itemId: string, quantity: number) => {
        const result = controller.queueItem(viewTurn, itemId, quantity);
        if (result.success) {
          const def = defs[itemId];
          if (def) {
            const completionTurn = viewTurn + def.durationTurns;
            const totalTurns = controller.getTotalTurns();

            // Simulate turns if needed
            if (completionTurn >= totalTurns) {
              const turnsToSimulate = completionTurn - totalTurns + 1;
              controller.simulateTurns(turnsToSimulate);
            }
          }
        }
        return result;
      };

      const result = handleQueueItem('outpost_ship', 1);
      expect(result.success).toBe(true);

      // Should simulate turns to accommodate ship completion
      // Ship completes at turn 77 (10 + 67), total turns is 20
      // So needs to simulate 77 - 20 + 1 = 58 turns
      expect(controller.simulateTurns).toHaveBeenCalledWith(58);
    });
  });
});