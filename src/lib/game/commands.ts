/**
 * Commands API - Public mutation interface for the app
 * All UI actions should go through these commands
 */

import type { PlanetState, LaneId, ItemDefinition } from '../sim/engine/types';
import { canQueue } from '../sim/engine/validation';
import { tryActivateNext } from '../sim/engine/lanes';
import { generateWorkItemId, refundActivationCosts } from '../sim/engine/helpers';
import { createStandardStart } from '../sim/defs/seed';
import { Timeline } from './state';
import { getLogger } from './logger';
import { getPlannedWaitTurns } from './waitDuration';

export interface QueueResult {
  success: boolean;
  reason?: 'REQ_MISSING' | 'HOUSING_MISSING' | 'ENERGY_INSUFFICIENT' | 'PLANET_LIMIT_REACHED' | 'INSUFFICIENT_RESOURCES' | 'INVALID_LANE';
  itemId?: string;
}

export interface CancelResult {
  success: boolean;
  reason?: 'NOT_FOUND' | 'INVALID_TURN';
}

export interface ReorderResult {
  success: boolean;
  reason?: 'NOT_FOUND' | 'INVALID_TURN' | 'INVALID_LANE' | 'INVALID_INDEX' | 'CANNOT_REORDER_WAIT' | 'INVALID_ITEM';
}

interface QueueItemOptions {
  force?: boolean;
  preserveId?: string;
  minStartTurn?: number;
  completedResearch?: string[];
  scheduledResearch?: string[];
  blockedResearch?: string[];
}

/**
 * Game controller - manages timeline and exposes commands
 */
export class GameController {
  private timeline: Timeline;

  constructor(initialState: PlanetState, existingTimeline?: Timeline) {
    // Use existing timeline if provided (for multi-planet support), otherwise create new one
    this.timeline = existingTimeline || new Timeline(initialState);
  }

  /**
   * Queue an item in a lane at specific turn
   * Validates prerequisites and energy forward-check before queueing
   */
  queueItem(
    turn: number,
    itemId: string,
    requestedQty: number,
    options?: QueueItemOptions
  ): QueueResult {
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

    if (!options?.force) {
      if (options?.blockedResearch?.length) {
        return { success: false, reason: 'REQ_MISSING' };
      }

      // Check if queue is full (max 10 items)
      if (lane.pendingQueue.length >= lane.maxQueueDepth) {
        return { success: false, reason: 'INVALID_LANE' };
      }

      // Validate queue operation
      const validationResearch = Array.from(new Set([
        ...(state.completedResearch || []),
        ...(options?.completedResearch || []),
        ...(options?.minStartTurn !== undefined ? options?.scheduledResearch || [] : []),
      ]));
      const validationState = validationResearch.length > 0
        ? { ...state, completedResearch: validationResearch }
        : state;
      const validation = canQueue(validationState, def, requestedQty);
      if (!validation.allowed) {
        return { success: false, reason: validation.reason };
      }
    }

    // Prerequisite stalling is handled by clampBatchAtActivation at engine level —
    // it returns 0 (stall) each turn until prereqs are actually completed.
    // Explicit wait injection is not needed and produces misleading queue entries.

    // Preserve original ID when repacking to avoid ID churn across cancel+repack cycles
    const workItemId = options?.preserveId ?? generateWorkItemId();
    const workItem = {
      id: workItemId,
      itemId: itemId,
      quantity: requestedQty,
      status: 'pending' as const,
      turnsRemaining: def.durationTurns,
      queuedTurn: turn,
      minStartTurn: options?.minStartTurn,
      scheduledResearch: options?.scheduledResearch?.length ? options.scheduledResearch : undefined,
      blockedResearch: options?.blockedResearch?.length ? options.blockedResearch : undefined,
    };

    // Push to queue, then eagerly activate so costs appear on the current turn.
    const success = this.timeline.mutateAtTurn(turn, (s) => {
      if (options?.completedResearch?.length && options.minStartTurn === undefined) {
        s.completedResearch = Array.from(new Set([
          ...(s.completedResearch || []),
          ...options.completedResearch,
        ]));
      }
      s.lanes[laneId].pendingQueue.push(workItem);
      tryActivateNext(s, laneId);
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
   * Queue a wait item in a lane at specific turn
   * Wait items pause lane activity for N turns without resource costs
   */
  queueWaitItem(turn: number, laneId: LaneId, waitTurns: number, isAutoWait: boolean = false, options?: { force?: boolean; preserveId?: string }): QueueResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    const lane = state.lanes[laneId];

    if (!options?.force) {
      // Check if queue is full
      if (lane.pendingQueue.length >= lane.maxQueueDepth) {
        return { success: false, reason: 'INVALID_LANE' };
      }
    }

    // Validate wait turns (must be positive)
    if (waitTurns <= 0) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Create wait work item — preserve original ID when repacking
    const workItemId = options?.preserveId ?? generateWorkItemId();
    const waitItem = {
      id: workItemId,
      itemId: '__wait__',
      quantity: 1,
      status: 'pending' as const,
      turnsRemaining: waitTurns,
      queuedTurn: turn,
      isWait: true,
      isAutoWait,
    };

    // Push to queue, then eagerly activate so the wait starts on the current turn.
    const success = this.timeline.mutateAtTurn(turn, (s) => {
      s.lanes[laneId].pendingQueue.push(waitItem);
      tryActivateNext(s, laneId);
    });

    if (!success) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Log the queue operation
    getLogger().logQueueOperation(
      turn,
      'queue',
      laneId,
      '__wait__',
      'Wait',
      1,
      `Queued wait for ${waitTurns} turns at turn ${turn}`
    );

    return { success: true, itemId: workItemId };
  }

  /**
   * Inject a synthetic ItemDefinition into the state at `turn` so the engine
   * can look it up by id during validation and completion handling.
   * The mutation propagates to all recomputed future states.
   */
  injectDef(turn: number, def: import('../sim/engine/types').ItemDefinition): void {
    this.timeline.mutateAtTurn(turn, (state) => {
      state.defs[def.id] = def;
    });
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

    // If there's a pending item in queue, remove the first one.
    // Pending items haven't been activated, so nothing to refund.
    if (lane.pendingQueue.length > 0) {
      this.timeline.mutateAtTurn(turn, (s) => {
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

        // Handle wait items (no resources or workers to refund)
        if (active.isWait) {
          s.lanes[laneId].active = null;
          tryActivateNext(s, laneId);
          return;
        }

        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund resources, workers, and space
        refundActivationCosts(s, def, active.quantity, laneId);

        // Clear active slot and immediately activate next pending item
        s.lanes[laneId].active = null;
        tryActivateNext(s, laneId);
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

    // Check if entry is in pending queue.
    // Pending items haven't been activated, so nothing to refund.
    const pendingIndex = lane.pendingQueue.findIndex(item => item.id === entryId);
    if (pendingIndex !== -1) {
      this.timeline.mutateAtTurn(turn, (s) => {
        s.lanes[laneId].pendingQueue.splice(pendingIndex, 1);
      });
      return { success: true };
    }

    // Check if entry is the active item
    if (lane.active && lane.active.id === entryId) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const active = s.lanes[laneId].active;
        if (!active) return;

        // Handle wait items (no resources or workers to refund)
        if (active.isWait) {
          s.lanes[laneId].active = null;
          tryActivateNext(s, laneId);
          return;
        }

        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund resources, workers, and space
        refundActivationCosts(s, def, active.quantity, laneId);

        // Clear active slot and immediately activate next pending item
        s.lanes[laneId].active = null;
        tryActivateNext(s, laneId);
      });

      return { success: true };
    }

    return { success: false, reason: 'NOT_FOUND' };
  }

  /**
   * Cancel a planned item by removing it from the T1 state directly.
   *
   * The queue display reads from T199 (where items may already be in completionHistory),
   * but cancellation must operate on the *plan* at T1 (where items are originally queued).
   * After removal, the timeline recomputes and the item disappears from all future turns.
   *
   * This avoids the bug where cancelEntryByIdSmart fails because it finds the item
   * in completionHistory and returns NOT_FOUND.
   */
  cancelPlannedItem(laneId: LaneId, entryId: string): CancelResult {
    const turn = this.timeline.getInitialTurn();
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) return { success: false, reason: 'INVALID_TURN' };

    const lane = state.lanes[laneId];

    // Check pending queue at T1.
    // Pending items haven't been activated, so nothing to refund.
    const pendingIndex = lane.pendingQueue.findIndex(item => item.id === entryId);
    if (pendingIndex !== -1) {
      this.timeline.mutateAtTurn(turn, (s) => {
        s.lanes[laneId].pendingQueue.splice(pendingIndex, 1);
      });

      getLogger().logQueueOperation(
        turn, 'cancel', laneId, entryId, 'planned-item', undefined,
        `Cancelled planned item ${entryId} from pending queue at T${turn}`
      );
      return { success: true };
    }

    // Check active at T1 (first item from queue gets activated immediately)
    if (lane.active && lane.active.id === entryId) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const active = s.lanes[laneId].active;
        if (!active) return;

        if (!active.isWait) {
          const def = s.defs[active.itemId];
          if (def) {
            refundActivationCosts(s, def, active.quantity, laneId);
          }
        }
        s.lanes[laneId].active = null;
        tryActivateNext(s, laneId);
      });

      getLogger().logQueueOperation(
        turn, 'cancel', laneId, entryId, 'planned-item', undefined,
        `Cancelled planned item ${entryId} from active slot at T${turn}`
      );
      return { success: true };
    }

    // Fallback: item not found at T1 — try the legacy search as a safety net
    return this.cancelEntryByIdSmart(turn, laneId, entryId);
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
   * Update the quantity of an existing item in the queue preserving its position.
   */
  updateItemQuantity(turn: number, laneId: LaneId, entryId: string, newQuantity: number): CancelResult {
    // We only need to check turn 1 since everything is queued universally now.
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) return { success: false, reason: 'INVALID_TURN' };

    const lane = state.lanes[laneId];

    // Check pending queue
    const pendingIndex = lane.pendingQueue.findIndex(item => item.id === entryId);
    if (pendingIndex !== -1) {
      // Pending items haven't been activated. Just update intended qty.
      this.timeline.mutateAtTurn(turn, (s) => {
        const item = s.lanes[laneId].pendingQueue[pendingIndex];
        if (item && !item.isWait) {
          item.quantity = newQuantity;
        }
      });
      // Optionally repack to re-verify dynamic validators
      this.repackQueue(turn, laneId);
      return { success: true };
    }

    // Check active item
    if (lane.active && lane.active.id === entryId) {
      this.timeline.mutateAtTurn(turn, (s) => {
        const active = s.lanes[laneId].active;
        if (!active) return;
        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund old costs
        refundActivationCosts(s, def, active.quantity, laneId);

        // Update quantity
        active.quantity = newQuantity;

        // Re-deduct new costs? Wait, active items are activated during phase transitions.
        // It's safer to deactivate it and repack.
        // Or we can just adjust the costs if we import deductActivationCosts.
        // For simplicity, we can just deactivate it, push it to front of pending, and repack.
        s.lanes[laneId].active = null;
        s.lanes[laneId].pendingQueue.unshift({
          ...active,
          status: 'pending',
          turnsRemaining: def.durationTurns,
        });
      });
      // Repack processes the pending queue.
      this.repackQueue(turn, laneId);
      return { success: true };
    }

    return { success: false, reason: 'NOT_FOUND' };
  }

  /**
   * Reorder a queue item to a new position
   * Works for both pending and active items.
   * Active items are deactivated (refunded) and re-added to pending queue.
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

    // Check if item is active
    const isActiveItem = lane.active?.id === entryId;

    if (isActiveItem) {
      // Handle active item: deactivate and requeue
      return this.reorderActiveItem(turn, laneId, entryId, newIndex);
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
   * Reorder an active item by deactivating it and re-adding to pending queue
   * Refunds resources/workers, then inserts at specified position
   */
  private reorderActiveItem(turn: number, laneId: LaneId, entryId: string, newIndex: number): ReorderResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_TURN' };
    }

    const lane = state.lanes[laneId];
    const active = lane.active;
    if (!active || active.id !== entryId) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    // Auto-waits are synthetic and will be regenerated during repack.
    if (active.isAutoWait) {
      return { success: false, reason: 'CANNOT_REORDER_WAIT' };
    }

    // Manual waits have no activation costs to refund, so they can be moved
    // just like ordinary plan entries.
    if (active.isWait) {
      const newQueueLength = lane.pendingQueue.length + 1;
      if (newIndex < 0 || newIndex >= newQueueLength) {
        return { success: false, reason: 'INVALID_INDEX' };
      }
      const plannedWaitTurns = getPlannedWaitTurns(active, turn) ?? active.turnsRemaining;

      this.timeline.mutateAtTurn(turn, (s) => {
        const lane = s.lanes[laneId];
        const active = lane.active;
        if (!active) return;

        lane.active = null;
        lane.pendingQueue.splice(newIndex, 0, {
          ...active,
          status: 'pending' as const,
          queuedTurn: turn,
          startTurn: undefined,
          completionTurn: undefined,
          turnsRemaining: plannedWaitTurns,
          isWait: true,
          isAutoWait: false,
        });
      });

      getLogger().logQueueOperation(
        turn,
        'reorder',
        laneId,
        '__wait__',
        'Wait',
        undefined,
        `Moved manual wait to index ${newIndex}`
      );

      return { success: true };
    }

    const def = state.defs[active.itemId];
    if (!def) {
      return { success: false, reason: 'INVALID_ITEM' };
    }

    // Validate new index (active will become pending, so queue grows by 1)
    const newQueueLength = lane.pendingQueue.length + 1;
    if (newIndex < 0 || newIndex >= newQueueLength) {
      return { success: false, reason: 'INVALID_INDEX' };
    }

    // Mutate state: deactivate and requeue
    this.timeline.mutateAtTurn(turn, (s) => {
      const lane = s.lanes[laneId];
      const active = lane.active;
      if (!active) return;

      const def = s.defs[active.itemId];
      if (!def) return;

      // Refund resources, workers, and space
      refundActivationCosts(s, def, active.quantity, laneId);

      // Create new pending item with reset duration
      const newPendingItem = {
        id: active.id,
        itemId: active.itemId,
        quantity: active.quantity,
        status: 'pending' as const,
        turnsRemaining: def.durationTurns, // Reset to full duration
        queuedTurn: turn,
      };

      // Clear active, insert into pending queue, and activate the new front item
      lane.active = null;
      lane.pendingQueue.splice(newIndex, 0, newPendingItem);
      tryActivateNext(s, laneId);
    });

    // Log the reorder operation
    getLogger().logQueueOperation(
      turn,
      'reorder',
      laneId,
      def.id,
      def.name,
      active.quantity,
      `Deactivated and moved to pending queue at index ${newIndex}`
    );

    return { success: true };
  }

  /**
   * Auto-collapse a lane's queue by pulling items forward as early as possible.
   * If an item is delayed by prerequisites, inserts an autoWait item.
   *
   * @param turn The turn to start repacking from (usually viewTurn)
   * @param laneId The lane to repack
   */
  repackQueue(turn: number, laneId: LaneId): boolean {
    const startState = this.timeline.getStateAtTurn(turn);
    if (!startState) return false;

    const lane = startState.lanes[laneId];
    if (lane.pendingQueue.length === 0) return true; // Nothing to repack

    // 1. Extract and clone all items that are NOT auto-waits
    const extractedItems = lane.pendingQueue
      .filter(item => !item.isAutoWait)
      .map(item => ({ ...item })); // Clone to avoid mutation references

    // 2. Clear the queue from the timeline starting at `turn`.
    // No refunds needed — pending items don't deduct stocks under the
    // activation-time pricing model.
    this.timeline.mutateAtTurn(turn, (s) => {
      s.lanes[laneId].pendingQueue = [];
    });

    // 3. Re-insert items sequentially at the earliest valid turn
    let cursorTurn = turn;

    // We need to figure out when the lane actually becomes available.
    if (lane.active) {
      let foundEmptyTurn = cursorTurn;
      const maxTurns = this.getTotalTurns();
      for (let i = cursorTurn; i < maxTurns; i++) {
        const tState = this.timeline.getStateAtTurn(i);
        if (tState && !tState.lanes[laneId].active) {
          foundEmptyTurn = i;
          break;
        }
      }
      cursorTurn = foundEmptyTurn;
    }

    // Limit search to the last occupied turn for this lane (+ buffer).
    // This avoids scanning the entire 200-turn timeline when items only reach T50.
    const lastOccupiedTurn = this.getLastOccupiedTurnForLane(turn, laneId, startState);
    const searchLimit = Math.min(lastOccupiedTurn + 10, this.getTotalTurns());

    for (const item of extractedItems) {
      if (item.isWait) {
        // Manual waits just take up time natively. Preserve original ID to avoid ID churn.
        this.queueWaitItem(turn, laneId, item.turnsRemaining, false, { force: true, preserveId: item.id });
        cursorTurn += item.turnsRemaining;
        continue;
      }

      // It's a normal item. Find the earliest turn it's valid.
      let validTurn = -1;
      const def = startState.defs[item.itemId];
      if (!def) continue;

      // Search forward from cursorTurn up to the computed limit
      for (let searchTurn = cursorTurn; searchTurn < searchLimit; searchTurn++) {
        const checkState = this.timeline.getStateAtTurn(searchTurn);
        if (!checkState) break;

        const validation = canQueue(checkState, def, item.quantity);
        if (validation.allowed) {
          validTurn = searchTurn;
          break;
        }
      }

      if (validTurn === -1) {
        // Could not find a valid turn within the limit — fall back to cursor
        validTurn = cursorTurn;
      }

      // Did we have to wait?
      const gap = validTurn - cursorTurn;
      if (gap > 0) {
        // Insert autoWait at T=turn (no original ID to preserve — auto-waits are synthetic)
        this.queueWaitItem(turn, laneId, gap, true, { force: true });
      }

      // Queue the actual item universally at T=turn, preserving original ID
      this.queueItem(turn, item.itemId, item.quantity, {
        force: true,
        preserveId: item.id,
        minStartTurn: item.minStartTurn,
        scheduledResearch: item.scheduledResearch,
        blockedResearch: item.blockedResearch,
      });

      // Advance cursor
      cursorTurn = validTurn + def.durationTurns;
    }

    return true;
  }

  /**
   * Calculate the last turn occupied by items in a lane.
   * Used to limit repackQueue's search range to only the relevant window.
   */
  private getLastOccupiedTurnForLane(
    turn: number,
    laneId: LaneId,
    state?: ReturnType<typeof this.timeline.getStateAtTurn>
  ): number {
    const s = state ?? this.timeline.getStateAtTurn(turn);
    if (!s) return turn;

    const lane = s.lanes[laneId];
    let lastTurn = turn;

    if (lane.active) {
      lastTurn = turn + (lane.active.turnsRemaining || 0);
    }

    for (const item of lane.pendingQueue) {
      const def = s.defs[item.itemId];
      lastTurn += item.isWait ? item.turnsRemaining : (def?.durationTurns || 0);
    }

    return lastTurn;
  }

  /**
   * Reset the current planet's queue to its pristine starting state.
   * Recreates the timeline from createStandardStart using the same item defs,
   * preserving the planet's startTurn so timeline offsets stay correct.
   */
  resetQueue(): boolean {
    const state = this.timeline.getStateAtTurn(this.timeline.getInitialTurn());
    if (!state) return false;

    // Build a fresh starting state using the same item definitions
    const freshState = createStandardStart(state.defs);
    freshState.currentTurn = state.currentTurn;

    // Replace the timeline entirely — all queued items are gone
    this.timeline.reset(freshState);
    return true;
  }

  /**
   * Repack all four lanes in canonical order.
   * Called after any queue mutation that could affect multiple lanes
   * (e.g., cancelling a building that ships or colonists depend on).
   */
  repackAllLanes(turn: number): boolean {
    const LANE_ORDER: LaneId[] = ['building', 'ship', 'colonist', 'research'];
    for (const laneId of LANE_ORDER) {
      this.repackQueue(turn, laneId);
    }
    return true;
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

// ============================================================================
// Multi-Planet Command Functions
// ============================================================================

import type { GameState, ExtendedPlanetState } from './gameState';
import { queueGlobalResearch } from './globalResearch';

/**
 * Queue a building on a specific planet
 */
export function enqueueBuildingForPlanet(
  gameState: GameState,
  planetId: string,
  itemId: string,
  quantity: number
): GameState {
  const planet = gameState.planets.get(planetId);
  if (!planet) {
    throw new Error(`Planet ${planetId} not found`);
  }

  // Create a new controller for this planet if needed
  if (!planet.timeline) {
    planet.timeline = new Timeline(planet);
  }

  const controller = new GameController(planet);
  const result = controller.queueItem(planet.currentTurn, itemId, quantity);

  if (!result.success) {
    throw new Error(`Failed to queue ${itemId}: ${result.reason}`);
  }

  // Update planet state
  const newPlanet = controller.getCurrentState() as ExtendedPlanetState;
  newPlanet.id = planet.id;
  newPlanet.name = planet.name;
  newPlanet.startTurn = planet.startTurn;
  newPlanet.timeline = planet.timeline;

  // Return new game state with updated planet
  const newPlanets = new Map(gameState.planets);
  newPlanets.set(planetId, newPlanet);

  return {
    ...gameState,
    planets: newPlanets,
  };
}

/**
 * Advance turn for a specific planet
 */
export function advanceTurnForPlanet(
  gameState: GameState,
  planetId: string
): GameState {
  const planet = gameState.planets.get(planetId);
  if (!planet) {
    throw new Error(`Planet ${planetId} not found`);
  }

  // Create a new controller for this planet if needed
  if (!planet.timeline) {
    planet.timeline = new Timeline(planet);
  }

  const controller = new GameController(planet);
  controller.nextTurn();

  // Update planet state
  const newPlanet = controller.getCurrentState() as ExtendedPlanetState;
  newPlanet.id = planet.id;
  newPlanet.name = planet.name;
  newPlanet.startTurn = planet.startTurn;
  newPlanet.timeline = planet.timeline;

  // Return new game state with updated planet
  const newPlanets = new Map(gameState.planets);
  newPlanets.set(planetId, newPlanet);

  return {
    ...gameState,
    planets: newPlanets,
  };
}

export function queueResearch(
  gameState: GameState,
  itemId: string
): GameState {
  return queueGlobalResearch(gameState, itemId);
}
