/**
 * Commands API - Public mutation interface for the app
 * All UI actions should go through these commands
 */

import type { PlanetState, LaneId, ItemDefinition } from '../sim/engine/types';
import { canQueue } from '../sim/engine/validation';
import { generateWorkItemId } from '../sim/engine/helpers';
import { Timeline } from './state';

export interface QueueResult {
  success: boolean;
  reason?: 'REQ_MISSING' | 'HOUSING_MISSING' | 'ENERGY_INSUFFICIENT' | 'INVALID_LANE';
  itemId?: string;
}

export interface CancelResult {
  success: boolean;
  reason?: 'NOT_FOUND' | 'INVALID_TURN';
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

    // Validate queue operation
    const validation = canQueue(state, def, requestedQty);
    if (!validation.allowed) {
      return { success: false, reason: validation.reason };
    }

    // Determine lane from definition
    const laneId = def.lane;
    const lane = state.lanes[laneId];

    // Check if lane is available (no pending item)
    if (lane.pending) {
      return { success: false, reason: 'INVALID_LANE' };
    }

    // Create work item
    const workItemId = generateWorkItemId();
    const workItem = {
      id: workItemId,
      itemId: itemId,
      quantity: requestedQty,
      status: 'pending' as const,
      turnsRemaining: def.durationTurns,
    };

    // Mutate state to add pending item
    const success = this.timeline.mutateAtTurn(turn, (s) => {
      s.lanes[laneId].pending = workItem;
    });

    if (!success) {
      return { success: false, reason: 'INVALID_LANE' };
    }

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

    // If there's a pending item, just remove it
    if (lane.pending) {
      this.timeline.mutateAtTurn(turn, (s) => {
        s.lanes[laneId].pending = null;
      });
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
