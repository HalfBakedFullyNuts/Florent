/**
 * Commands API - Public mutation interface for the app
 * All UI actions should go through these commands
 */

import type { PlanetState, LaneId, ItemDefinition } from '../sim/engine/types';
import { canQueue } from '../sim/engine/validation';
import { generateWorkItemId, refundActivationCosts } from '../sim/engine/helpers';
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
  reason?: 'NOT_FOUND' | 'INVALID_TURN' | 'INVALID_LANE' | 'INVALID_INDEX' | 'CANNOT_REORDER_WAIT' | 'INVALID_ITEM';
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
   * Queue a wait item in a lane at specific turn
   * Wait items pause lane activity for N turns without resource costs
   */
  queueWaitItem(turn: number, laneId: LaneId, waitTurns: number): QueueResult {
    const state = this.timeline.getStateAtTurn(turn);
    if (!state) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    const lane = state.lanes[laneId];

    // Check if lane is busy with active work
    if (lane.active) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Check if queue is full
    if (lane.pendingQueue.length >= lane.maxQueueDepth) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Validate wait turns (must be positive)
    if (waitTurns <= 0) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Create wait work item
    const workItemId = generateWorkItemId();
    const waitItem = {
      id: workItemId,
      itemId: '__wait__',
      quantity: 1,
      status: 'pending' as const,
      turnsRemaining: waitTurns,
      queuedTurn: turn,
      isWait: true,
    };

    // Mutate state to add wait item to queue
    const success = this.timeline.mutateAtTurn(turn, (s) => {
      s.lanes[laneId].pendingQueue.push(waitItem);
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

        // Handle wait items (no resources or workers to refund)
        if (active.isWait) {
          s.lanes[laneId].active = null;
          return;
        }

        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund resources, workers, and space
        refundActivationCosts(s, def, active.quantity, laneId);

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

        // Handle wait items (no resources or workers to refund)
        if (active.isWait) {
          s.lanes[laneId].active = null;
          return;
        }

        const def = s.defs[active.itemId];
        if (!def) return;

        // Refund resources, workers, and space
        refundActivationCosts(s, def, active.quantity, laneId);

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

    // Don't allow reordering wait items
    if (active.isWait) {
      return { success: false, reason: 'CANNOT_REORDER_WAIT' };
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

      // Clear active and insert into pending queue at position
      lane.active = null;
      lane.pendingQueue.splice(newIndex, 0, newPendingItem);
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

/**
 * Calculate the earliest turn when research can start based on RP accumulation
 */
function calculateEarliestResearchTurn(
  gameState: GameState,
  rpCost: number,
  currentTurn: number
): number {
  // Sum current RP across all planets
  let totalRP = 0;
  let totalScientists = 0;

  for (const planet of Array.from(gameState.planets.values())) {
    totalRP += planet.stocks.research_points || 0;
    totalScientists += planet.population.scientists || 0;
  }

  // If we already have enough RP, start now
  if (totalRP >= rpCost) {
    return currentTurn;
  }

  // If no scientists, research can never start
  if (totalScientists === 0) {
    throw new Error('No scientists available to generate research points');
  }

  // Calculate turns needed to accumulate enough RP
  // Each scientist produces 1 RP per turn
  const rpNeeded = rpCost - totalRP;
  const turnsNeeded = Math.ceil(rpNeeded / totalScientists);

  return currentTurn + turnsNeeded;
}

/**
 * Queue research (global queue)
 * Automatically schedules research for the earliest turn when enough RP is available
 */
export function queueResearch(
  gameState: GameState,
  itemId: string
): GameState {
  // Check if any planet has prerequisites
  let hasPrereqs = false;
  let totalScientists = 0;

  for (const planet of Array.from(gameState.planets.values())) {
    if (planet.completedCounts['lab'] > 0 && planet.population.scientists > 0) {
      hasPrereqs = true;
    }
    totalScientists += planet.population.scientists || 0;
  }

  if (!hasPrereqs) {
    throw new Error('No planet has lab and scientists for research');
  }

  if (totalScientists === 0) {
    throw new Error('No scientists available to generate research points');
  }

  // Get research definition
  const def = gameState.planets.values().next().value?.defs[itemId];
  if (!def) {
    throw new Error(`Research ${itemId} not found`);
  }

  // Calculate earliest turn when research can start
  const cost = def.costsPerUnit?.research_points || 0;
  const currentPlanet = gameState.planets.get(gameState.currentPlanetId);
  const currentTurn = currentPlanet?.currentTurn || 1;
  const earliestTurn = calculateEarliestResearchTurn(gameState, cost, currentTurn);

  // Deduct research points from planets (prioritize highest stock)
  let remainingCost = cost;
  const sortedPlanets = Array.from(gameState.planets.values()).sort(
    (a, b) => (b.stocks.research_points || 0) - (a.stocks.research_points || 0)
  );

  const newPlanets = new Map(gameState.planets);
  for (const planet of sortedPlanets) {
    if (remainingCost <= 0) break;

    const planetRP = planet.stocks.research_points || 0;
    const deduction = Math.min(planetRP, remainingCost);

    const updatedPlanet = { ...planet };
    updatedPlanet.stocks.research_points = planetRP - deduction;
    newPlanets.set(planet.id, updatedPlanet);

    remainingCost -= deduction;
  }

  // Add to global research queue with calculated start turn
  const workItem = {
    id: generateWorkItemId(),
    itemId,
    status: 'pending' as const,
    quantity: 1,
    turnsRemaining: def.durationTurns,
    queuedTurn: earliestTurn, // Queue for earliest possible turn
  };

  // Log the scheduling decision
  if (earliestTurn > currentTurn) {
    getLogger().logQueueOperation(
      currentTurn,
      'queue',
      'research',
      itemId,
      def.name,
      1,
      `Scheduled for turn ${earliestTurn} (waiting for ${cost - remainingCost} RP, ${totalScientists} scientists producing ${totalScientists} RP/turn)`
    );
  }

  return {
    ...gameState,
    planets: newPlanets,
    globalResearch: {
      ...gameState.globalResearch,
      queue: [...gameState.globalResearch.queue, workItem],
    },
  };
}
