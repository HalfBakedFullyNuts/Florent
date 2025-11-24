/**
 * Timeline management and recomputation
 * Fixed 200-turn timeline architecture for simplified queue management
 */

import type { PlanetState } from '../sim/engine/types';
import { simulate, runTurn } from '../sim/engine/turn';
import { CompletionBuffer } from '../sim/engine/buffers';
import { cloneState } from '../sim/engine/helpers';
import { getLogger } from './logger';

/**
 * Timeline state manager with fixed 200-turn architecture
 * Always maintains exactly 200 pre-computed turns for consistent UX
 */
export class Timeline {
  private static readonly FIXED_TURNS = 200;
  private static readonly LAZY_COMPUTE_BUFFER = 50; // Compute 50 turns ahead
  private states: PlanetState[];
  private currentTurnIndex: number;
  private completionBuffer: CompletionBuffer;
  private stableFromTurn: number = -1; // Cache for stable state optimization
  private highestComputedIndex: number = 0; // Track how far we've computed

  constructor(initialState: PlanetState) {
    this.states = new Array(Timeline.FIXED_TURNS);
    this.states[0] = cloneState(initialState);
    this.currentTurnIndex = 0;
    this.completionBuffer = new CompletionBuffer();

    // Completely lazy initialization - don't compute anything upfront
    // Only compute when turns are actually requested (on-demand)
    // This makes initialization instant (0ms instead of 500-1000ms)
    // When a turn is requested, we compute that turn + 50 more as a buffer
    this.highestComputedIndex = 0;
  }

  /**
   * Get state at specific turn
   * Automatically computes turns lazily if not yet computed
   */
  getStateAtTurn(turn: number): PlanetState | undefined {
    // Map turn number to array index (turn 1 = index 0)
    const initialTurn = this.states[0]?.currentTurn || 1;
    const index = turn - initialTurn;

    if (index < 0 || index >= this.states.length) {
      return undefined;
    }

    // If we've reached stable state and requesting a turn after it, just clone stable state
    if (this.stableFromTurn >= 0 && index > this.stableFromTurn) {
      if (!this.states[index]) {
        const stableState = this.states[this.stableFromTurn];
        this.states[index] = cloneState(stableState);
        this.states[index].currentTurn = stableState.currentTurn + (index - this.stableFromTurn);
      }
      return cloneState(this.states[index]);
    }

    // Lazy computation: if requesting a turn we haven't computed yet, compute up to it + buffer
    if (index > this.highestComputedIndex) {
      const targetIndex = Math.min(index + Timeline.LAZY_COMPUTE_BUFFER, Timeline.FIXED_TURNS - 1);
      this.computeUpToIndex(targetIndex);

      // If we still don't have the state (stable state was detected before reaching index),
      // create it from stable state template
      if (!this.states[index] && this.stableFromTurn >= 0 && index > this.stableFromTurn) {
        const stableState = this.states[this.stableFromTurn];
        this.states[index] = cloneState(stableState);
        this.states[index].currentTurn = stableState.currentTurn + (index - this.stableFromTurn);
      }
    }

    // Safety check: ensure state exists before cloning
    if (!this.states[index]) {
      return undefined;
    }

    return cloneState(this.states[index]);
  }

  /**
   * Get current turn number (not index)
   */
  getCurrentTurn(): number {
    // Ensure current state is computed before accessing
    this.ensureComputedUpTo(this.currentTurnIndex);
    return this.states[this.currentTurnIndex]?.currentTurn || 1;
  }

  /**
   * Get current state
   * Triggers lazy computation if current turn hasn't been computed yet
   */
  getCurrentState(): PlanetState {
    // Lazy computation: if current turn not yet computed, compute it
    if (this.currentTurnIndex > this.highestComputedIndex) {
      const targetIndex = Math.min(
        this.currentTurnIndex + Timeline.LAZY_COMPUTE_BUFFER,
        Timeline.FIXED_TURNS - 1
      );
      this.computeUpToIndex(targetIndex);
    }
    return cloneState(this.states[this.currentTurnIndex]);
  }

  /**
   * Get total number of computed turns (always 200)
   */
  getTotalTurns(): number {
    return Timeline.FIXED_TURNS;
  }

  /**
   * Ensure states are computed up to a given index
   * @param index - The index to ensure is computed
   */
  private ensureComputedUpTo(index: number): void {
    if (index > this.highestComputedIndex) {
      const targetIndex = Math.min(
        index + Timeline.LAZY_COMPUTE_BUFFER,
        Timeline.FIXED_TURNS - 1
      );
      this.computeUpToIndex(targetIndex);
    }
  }

  /**
   * Compute turns up to a specific index (lazy computation)
   * @param targetIndex - The highest index to compute up to
   */
  private computeUpToIndex(targetIndex: number): void {
    if (targetIndex <= this.highestComputedIndex) {
      return; // Already computed
    }

    const start = performance.now();
    const startIndex = this.highestComputedIndex + 1;
    let lastComputedIndex = this.highestComputedIndex;

    for (let i = startIndex; i <= targetIndex; i++) {
      // Clone previous state and run turn
      this.states[i] = cloneState(this.states[i - 1]);
      runTurn(this.states[i], this.completionBuffer);
      lastComputedIndex = i;

      // Detect stable state (no active items, no pending queues)
      if (this.stableFromTurn === -1 && this.isStableState(this.states[i])) {
        this.stableFromTurn = i;
        getLogger().logTimelineEvent(
          this.states[i].currentTurn,
          'stable_state',
          `Stable state detected at turn ${this.states[i].currentTurn}`
        );
        // For stable state, we can stop computing - all future turns are the same
        // We'll compute them on-demand if needed
        break;
      }
    }

    this.highestComputedIndex = lastComputedIndex;

    const duration = performance.now() - start;
    if (duration > 100) {
      getLogger().logTimelineEvent(
        this.states[this.highestComputedIndex]?.currentTurn || 0,
        'recompute',
        `Computed turns ${startIndex}-${this.highestComputedIndex} in ${duration.toFixed(1)}ms${this.stableFromTurn >= 0 ? `, stable from T${this.stableFromTurn}` : ''}`
      );
    }
  }

  /**
   * Recompute from a specific index (for mutations)
   * @param fromIndex - Starting index for recomputation
   */
  recomputeAll(fromIndex: number = 1): void {
    // Reset stable state detection when recomputing
    this.stableFromTurn = -1;

    // If recomputing from the beginning, reset completion buffer
    if (fromIndex === 1) {
      this.completionBuffer.clear();
      this.highestComputedIndex = 0;
    } else {
      // When recomputing from a mutation, only reset computed index to just before mutation
      this.highestComputedIndex = Math.max(0, fromIndex - 1);
    }

    // Compute up to where we were before, or at least to the lazy buffer
    const targetIndex = Math.max(
      this.highestComputedIndex + Timeline.LAZY_COMPUTE_BUFFER,
      Timeline.LAZY_COMPUTE_BUFFER
    );
    this.computeUpToIndex(Math.min(targetIndex, Timeline.FIXED_TURNS - 1));
  }

  /**
   * Check if state is stable (no work remaining and no ongoing resource production)
   * A state is NOT stable if:
   * - Any lane has active or pending items
   * - Scientists are producing research points
   */
  private isStableState(state: PlanetState): boolean {
    // Check if any lanes have work
    const hasLaneWork = !Object.values(state.lanes).every(
      lane => !lane.active && lane.pendingQueue.length === 0
    );

    if (hasLaneWork) {
      return false;
    }

    // Check if scientists are producing RP
    // Even with no queued work, scientists continue producing RP every turn
    if (state.population.scientists > 0) {
      return false;
    }

    return true;
  }

  /**
   * Set current turn number (for time travel)
   * Accepts turn numbers (1-200), not indices
   */
  setCurrentTurn(turn: number): boolean {
    // Map turn number to array index (turn 1 = index 0)
    const initialTurn = this.states[0]?.currentTurn || 1;
    const index = turn - initialTurn;

    if (index < 0 || index >= this.states.length) {
      return false;
    }

    // Ensure the target turn is computed before switching to it
    this.ensureComputedUpTo(index);
    this.currentTurnIndex = index;
    return true;
  }

  /**
   * Advance to next turn
   * Simply advances the view index (all turns pre-computed)
   */
  nextTurn(): PlanetState {
    if (this.currentTurnIndex < Timeline.FIXED_TURNS - 1) {
      this.currentTurnIndex += 1;
      getLogger().logTimelineEvent(
        this.getCurrentTurn(),
        'advance',
        `Advanced to turn ${this.getCurrentTurn()}`
      );
    }
    return this.getCurrentState();
  }

  /**
   * Simulate N turns by advancing the view (backward compatibility)
   * Triggers lazy computation as needed
   */
  simulateTurns(count: number): void {
    // Advance current turn index by count (max at 199)
    const newIndex = this.currentTurnIndex + count;
    const targetIndex = Math.min(newIndex, Timeline.FIXED_TURNS - 1);

    // Ensure target turn is computed
    this.ensureComputedUpTo(targetIndex);
    this.currentTurnIndex = targetIndex;
  }

  /**
   * Apply a state mutation at specific turn and recompute from that point forward
   * This is used by the commands API to apply changes
   */
  mutateAtTurn(turn: number, mutation: (state: PlanetState) => void): boolean {
    // Map turn number to array index
    const initialTurn = this.states[0]?.currentTurn || 1;
    const index = turn - initialTurn;

    if (index < 0 || index >= Timeline.FIXED_TURNS) {
      return false;
    }

    // Ensure the state at the target turn is computed
    this.ensureComputedUpTo(index);

    // If state still doesn't exist (stable state detected), create from template
    if (!this.states[index] && this.stableFromTurn >= 0 && index > this.stableFromTurn) {
      const stableState = this.states[this.stableFromTurn];
      this.states[index] = cloneState(stableState);
      this.states[index].currentTurn = stableState.currentTurn + (index - this.stableFromTurn);
    }

    // Get the state at the target turn
    const state = this.states[index];

    // Apply the mutation
    mutation(state);

    // Log the mutation
    getLogger().logTimelineEvent(
      turn,
      'mutation',
      `State mutated at turn ${turn}`,
      Timeline.FIXED_TURNS - turn
    );

    // Recompute from the next index forward (index+1) so the mutation at index is preserved
    // The mutation affects the state AT this index, so we recompute from the NEXT index
    if (index + 1 < Timeline.FIXED_TURNS) {
      this.recomputeAll(index + 1);
    }

    return true;
  }

  /**
   * Reset timeline to initial state and recompute all 200 turns
   */
  reset(initialState: PlanetState): void {
    this.states = new Array(Timeline.FIXED_TURNS);
    this.states[0] = cloneState(initialState);
    this.currentTurnIndex = 0;
    this.completionBuffer.clear();
    this.recomputeAll();
  }

  /**
   * Get all states (for debugging/visualization)
   * Returns clones to prevent mutation
   */
  getAllStates(): PlanetState[] {
    // Ensure all states are computed before returning
    this.ensureComputedUpTo(Timeline.FIXED_TURNS - 1);

    // Fill in any missing states from stable state template
    if (this.stableFromTurn >= 0) {
      const stableState = this.states[this.stableFromTurn];
      for (let i = this.stableFromTurn + 1; i < Timeline.FIXED_TURNS; i++) {
        if (!this.states[i]) {
          this.states[i] = cloneState(stableState);
          this.states[i].currentTurn = stableState.currentTurn + (i - this.stableFromTurn);
        }
      }
    }

    return this.states.map((s) => cloneState(s));
  }
}
