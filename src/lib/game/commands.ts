/**
 * Commands API - Public mutation interface for the app
 * All UI actions should go through these commands
 */

import type { PlanetState, LaneId, ItemDefinition } from '../sim/engine/types';
import { canQueue } from '../sim/engine/validation';
import { generateWorkItemId } from '../sim/engine/helpers';
import { Timeline } from './state';
import { getLogger } from './logger';

export interface QueueResult {
  success: boolean;
  reason?: 'REQ_MISSING' | 'HOUSING_MISSING' | 'ENERGY_INSUFFICIENT' | 'PLANET_LIMIT_REACHED' | 'INVALID_LANE';
  itemId?: string;
}

export interface CancelResult {
  success: boolean;
  reason?: 'NOT_FOUND' | 'INVALID_TURN';
}

export interface ReorderResult {
  success: boolean;
  reason?: 'NOT_FOUND' | 'INVALID_TURN' | 'INVALID_LANE' | 'INVALID_INDEX';
}

/**
 * Game controller - manages timeline and exposes commands
 */
export class GameController {
  private timeline: Timeline;

  constructor(initialState: PlanetState) {
    this.timeline = new Timeline(initialState);
  }

  /**
   * Queue an item in a lane at specific turn
   * Validates prerequisites and energy forward-check before queueing
   */
  queueItem(turn: number, itemId: string, requestedQty: number): QueueResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    const def = state.defs[itemId];
    if (!def) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Determine lane from definition
    const laneId = def.lane;
    const lane = state.lanes[laneId];

    // Check if lane is busy with active work
    if (lane.active) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Check if queue is full (max 10 items)
    if (lane.pendingQueue.length >= lane.maxQueueDepth) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Validate queue operation
    const validation = canQueue(state, def, requestedQty);
    if (!validation.allowed) {
      return { success: false, reason: validation.reason };
    }

    // Create work item with queue turn tracking
    const workItemId = generateWorkItemId();
    const workItem = {
      id: workItemId,
      itemId: itemId,
      quantity: requestedQty,
      status: 'pending' as const,
      turnsRemaining: def.durationTurns,
      queuedTurn: turn,
    };

    // Mutate state to add pending item to queue
    const success = this.timeline.mutateAtTurn(turn, (s) => {
      s.lanes[laneId].pendingQueue.push(workItem);

      // Deduct research_points immediately for research items (at queue time, not activation)
      if (laneId === 'research') {
        const rpCost = def.costsPerUnit.research_points || 0;
        s.stocks.research_points -= rpCost * requestedQty;
      }
    });

    if (!success) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Log the queue operation
    getLogger().logQueueOperation(
      turn,
      'queue',
      laneId,
      itemId,
      def.name,
      requestedQty,
      `Queued at turn ${turn}`
    );

    return { success: true, itemId: workItemId };
  }

  /**
   * Cancel an entry in a lane
   * For pending: just remove
   * For active: refund resources, release workers/space, then remove and try activate next
   */
  cancelEntry(turn: number, laneId: LaneId): CancelResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_TURN' };
    }

    const lane = state.lanes[laneId];

    // If there's a pending item in queue, remove the first one
    if (lane.pendingQueue.length > 0) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const pending = s.lanes[laneId].pendingQueue[0];
        if (pending) {
          // Refund research_points for pending research items (deducted at queue time)
          if (laneId === 'research') {
            const def = s.defs[pending.itemId];
            if (def) {
              const rpCost = def.costsPerUnit.research_points || 0;
              s.stocks.research_points += rpCost * pending.quantity;
            }
          }
        }
        s.lanes[laneId].pendingQueue.shift();
      });

      // Log the cancel operation
      const def = state.defs[lane.pendingQueue[0]?.itemId];
      if (def) {
        getLogger().logQueueOperation(
          turn,
          'cancel',
          laneId,
          def.id,
          def.name,
          undefined,
          'Cancelled pending item'
        );
      }

      return { success: true };
    }

    // If there's an active item, we need to refund and release
    if (lane.active) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const active = s.lanes[laneId].active;
        if (!active) return;

        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund resources
        const costs = def.costsPerUnit;
        s.stocks.metal += costs.metal * active.quantity;
        s.stocks.mineral += costs.mineral * active.quantity;
        s.stocks.food += costs.food * active.quantity;
        s.stocks.energy += costs.energy * active.quantity;
        s.stocks.research_points += costs.research_points * active.quantity;

        // Release workers
        const workersNeeded = costs.workers || 0;
        if (workersNeeded > 0) {
          const totalWorkers = workersNeeded * active.quantity;
          s.population.workersIdle += totalWorkers;
          s.population.busyByLane[laneId] =
            (s.population.busyByLane[laneId] || 0) - totalWorkers;
        }

        // Release space
        const spaceNeeded = costs.space || 0;
        if (spaceNeeded > 0) {
          const totalSpace = spaceNeeded * active.quantity;
          if (def.type === 'structure') {
            s.space.groundUsed -= totalSpace;
          } else {
            s.space.orbitalUsed -= totalSpace;
          }
        }

        // Clear active slot
        s.lanes[laneId].active = null;
      });

      // Log the cancel operation
      const def = state.defs[lane.active?.itemId || ''];
      if (def) {
        getLogger().logQueueOperation(
          turn,
          'cancel',
          laneId,
          def.id,
          def.name,
          lane.active?.quantity,
          'Cancelled active item'
        );
      }

      return { success: true };
    }

    return { success: false, reason: 'NOT_FOUND' };
  }

  /**
   * Cancel a specific entry by its ID
   * Works for both pending and active entries
   */
  cancelEntryById(turn: number, laneId: LaneId, entryId: string): CancelResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_TURN' };
    }

    const lane = state.lanes[laneId];

    // Check if entry is in pending queue
    const pendingIndex = lane.pendingQueue.findIndex(item => item.id === entryId);
    if (pendingIndex !== -1) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const pending = s.lanes[laneId].pendingQueue[pendingIndex];
        if (pending) {
          // Refund research_points for pending research items (deducted at queue time)
          if (laneId === 'research') {
            const def = s.defs[pending.itemId];
            if (def) {
              const rpCost = def.costsPerUnit.research_points || 0;
              s.stocks.research_points += rpCost * pending.quantity;
            }
          }
        }
        s.lanes[laneId].pendingQueue.splice(pendingIndex, 1);
      });
      return { success: true };
    }

    // Check if entry is the active item
    if (lane.active && lane.active.id === entryId) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const active = s.lanes[laneId].active;
        if (!active) return;

        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund resources
        const costs = def.costsPerUnit;
        s.stocks.metal += costs.metal * active.quantity;
        s.stocks.mineral += costs.mineral * active.quantity;
        s.stocks.food += costs.food * active.quantity;
        s.stocks.energy += costs.energy * active.quantity;
        s.stocks.research_points += costs.research_points * active.quantity;

        // Release workers
        const workersNeeded = costs.workers || 0;
        if (workersNeeded > 0) {
          const totalWorkers = workersNeeded * active.quantity;
          s.population.workersIdle += totalWorkers;
          s.population.busyByLane[laneId] =
            (s.population.busyByLane[laneId] || 0) - totalWorkers;
        }

        // Release space
        const spaceNeeded = costs.space || 0;
        if (spaceNeeded > 0) {
          const totalSpace = spaceNeeded * active.quantity;
          if (def.type === 'structure') {
            s.space.groundUsed -= totalSpace;
          } else {
            s.space.orbitalUsed -= totalSpace;
          }
        }

        // Clear active slot
        s.lanes[laneId].active = null;
      });

      return { success: true };
    }

    return { success: false, reason: 'NOT_FOUND' };
  }

  /**
   * Cancel an entry by searching the timeline to find where it actually exists.
   * Handles the mismatch between queuedTurn and actual item location.
   *
   * This is useful for ships/colonists that don't auto-advance the UI,
   * where the item may be queued at T5 but actually active at T51.
   */
  cancelEntryByIdSmart(turn: number, laneId: LaneId, entryId: string): CancelResult {
    const totalTurns = this.getTotalTurns();

    // Quick check: Try the turn first (common case for buildings)
    const startState = this.timeline.getStateAtTurn(turn);
    if (startState) {
      const lane = startState.lanes[laneId];
      const inPending = lane.pendingQueue.some(item => item.id === entryId);
      const isActive = lane.active?.id === entryId;

      if (inPending || isActive) {
        return this.cancelEntryById(turn, laneId, entryId);
      }
    }

    // Not at turn, search forward (ships/colonists case)
    for (let searchTurn = turn + 1; searchTurn < totalTurns; searchTurn++) {
      const state = this.timeline.getStateAtTurn(searchTurn);
      if (!state) continue;

      const lane = state.lanes[laneId];
      const inPending = lane.pendingQueue.some(item => item.id === entryId);
      const isActive = lane.active?.id === entryId;

      if (inPending || isActive) {
        return this.cancelEntryById(searchTurn, laneId, entryId);
      }

      // Stop searching if item is in completionHistory
      const inHistory = lane.completionHistory.some(item => item.id === entryId);
      if (inHistory) {
        return { success: false, reason: 'NOT_FOUND' }; // Can't cancel completed items
      }
    }

    return { success: false, reason: 'NOT_FOUND' };
  }

  /**
   * Remove an item from completion history by item ID
   *
   * WARNING: This method is fundamentally broken in a deterministic simulation!
   *
   * The problem: When you remove a completed item from history and the timeline
   * recomputes, the item that was originally queued is STILL in the pendingQueue
   * of past states. When recomputation runs forward, it completes AGAIN, causing
   * completedCounts to increment back up.
   *
   * This creates a paradox: you can't retroactively "undo" history in a deterministic
   * simulation without also removing the original queue command that led to the completion.
   *
   * Proper solution: Don't allow removal of completed items. Only allow canceling
   * pending/active items before they complete.
   *
   * This method is kept for backwards compatibility but should be deprecated.
   */
  removeFromHistory(turn: number, laneId: LaneId, workItemId: string): CancelResult {
    // This operation is not supported in a deterministic simulation
    console.warn('[removeFromHistory] This operation is deprecated and causes state corruption.');
    console.warn('You cannot retroactively remove completed items from history.');
    console.warn('Only pending/active items can be canceled before completion.');

    return { success: false, reason: 'NOT_FOUND' };
  }

  /**
   * Advance to next turn
   */
  nextTurn(): PlanetState {
    return this.timeline.nextTurn();
  }

  /**
   * Set current turn (time travel)
   */
  setTurn(turn: number): boolean {
    return this.timeline.setCurrentTurn(turn);
  }

  /**
   * Simulate N turns from current position
   */
  simulateTurns(count: number): void {
    this.timeline.simulateTurns(count);
  }

  /**
   * Load a scenario with definitions and initial state
   */
  loadScenario(initialState: PlanetState): void {
    this.timeline.reset(initialState);
  }

  /**
   * Get current state
   */
  getCurrentState(): PlanetState {
    return this.timeline.getCurrentState();
  }

  /**
   * Reorder a queue item to a new position
   * Only works for pending items, not active ones
   */
  reorderQueueItem(turn: number, laneId: LaneId, entryId: string, newIndex: number): ReorderResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_TURN' };
    }

    const lane = state.lanes[laneId];
    if (!lane) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Find item in pending queue
    const oldIndex = lane.pendingQueue.findIndex(item => item.id === entryId);
    if (oldIndex === -1) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    // Validate new index (after removal, length will be one less)
    const queueLengthAfterRemoval = lane.pendingQueue.length - 1;
    if (newIndex < 0 || newIndex > queueLengthAfterRemoval) {
      return { success: false, reason: 'INVALID_INDEX' };
    }

    // Mutate state to reorder
    this.timeline.mutateAtTurn(turn, (s) => {
      const lane = s.lanes[laneId];
      const [item] = lane.pendingQueue.splice(oldIndex, 1);
      lane.pendingQueue.splice(newIndex, 0, item);
    });

    // Log the reorder operation
    const item = lane.pendingQueue[newIndex];
    if (item) {
      const def = state.defs[item.itemId];
      if (def) {
        getLogger().logQueueOperation(
          turn,
          'reorder',
          laneId,
          def.id,
          def.name,
          undefined,
          `Moved from index ${oldIndex} to ${newIndex}`
        );
      }
    }

    return { success: true };
  }

  /**
   * Get state at specific turn
   */
  getStateAtTurn(turn: number): PlanetState | undefined {
    return this.timeline.getStateAtTurn(turn);
  }

  /**
   * Get current turn index
   */
  getCurrentTurn(): number {
    return this.timeline.getCurrentTurn();
  }

  /**
   * Get total computed turns
   */
  getTotalTurns(): number {
    return this.timeline.getTotalTurns();
  }

  /**
   * Get all states (for debugging/visualization)
   */
  getAllStates(): PlanetState[] {
    return this.timeline.getAllStates();
  }
}
