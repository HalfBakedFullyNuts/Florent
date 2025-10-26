/**
 * Timeline management and recomputation
 * Manages snapshots, invalidation, and deterministic recomputation
 */

import type { PlanetState } from '../sim/engine/types';
import { simulate, runTurn } from '../sim/engine/turn';
import { CompletionBuffer } from '../sim/engine/buffers';
import { cloneState } from '../sim/engine/helpers';

/**
 * Timeline state manager
 * Stores all computed states and handles recomputation from edited turns
 */
export class Timeline {
  private states: PlanetState[];
  private currentTurnIndex: number;
  private completionBuffer: CompletionBuffer;

  constructor(initialState: PlanetState) {
    this.states = [cloneState(initialState)];
    this.currentTurnIndex = 0;
    this.completionBuffer = new CompletionBuffer();
  }

  /**
   * Get state at specific turn
   * Returns undefined if turn hasn't been computed yet
   */
  getStateAtTurn(turn: number): PlanetState | undefined {
    if (turn < 0 || turn >= this.states.length) {
      return undefined;
    }
    return cloneState(this.states[turn]);
  }

  /**
   * Get current turn index
   */
  getCurrentTurn(): number {
    return this.currentTurnIndex;
  }

  /**
   * Get current state
   */
  getCurrentState(): PlanetState {
    return cloneState(this.states[this.currentTurnIndex]);
  }

  /**
   * Get total number of computed turns
   */
  getTotalTurns(): number {
    return this.states.length;
  }

  /**
   * Set current turn index (for time travel)
   */
  setCurrentTurn(turn: number): boolean {
    if (turn < 0 || turn >= this.states.length) {
      return false;
    }
    this.currentTurnIndex = turn;
    return true;
  }

  /**
   * Advance to next turn
   * Computes new state if not already computed
   */
  nextTurn(): PlanetState {
    // If we're not at the end, just advance the index
    if (this.currentTurnIndex < this.states.length - 1) {
      this.currentTurnIndex += 1;
      return this.getCurrentState();
    }

    // Otherwise, compute the next turn
    const currentState = cloneState(this.states[this.currentTurnIndex]);
    runTurn(currentState, this.completionBuffer);
    this.states.push(currentState);
    this.currentTurnIndex += 1;

    return this.getCurrentState();
  }

  /**
   * Simulate N turns from current position
   * Extends timeline without changing current turn index
   */
  simulateTurns(count: number): void {
    if (count <= 0) return;

    // Start from the last computed state
    let lastState = cloneState(this.states[this.states.length - 1]);

    for (let i = 0; i < count; i++) {
      runTurn(lastState, this.completionBuffer);
      this.states.push(cloneState(lastState));
    }
  }

  /**
   * Recompute from specified turn
   * Truncates timeline at turn T0 and recomputes forward
   * This is the key function for handling edits/mutations
   */
  recomputeFromTurn(turn: number): void {
    if (turn < 0 || turn >= this.states.length) {
      console.error(`Cannot recompute from invalid turn: ${turn}`);
      return;
    }

    // Truncate states array at the specified turn
    this.states = this.states.slice(0, turn + 1);

    // Reset completion buffer (it's now invalid after truncation)
    this.completionBuffer.clear();

    // If current turn is beyond truncation point, move it back
    if (this.currentTurnIndex > turn) {
      this.currentTurnIndex = turn;
    }

    // The timeline is now truncated at turn
    // Future calls to nextTurn() or simulateTurns() will recompute forward
  }

  /**
   * Apply a state mutation at specific turn and recompute forward
   * This is used by the commands API to apply changes
   */
  mutateAtTurn(turn: number, mutation: (state: PlanetState) => void): boolean {
    if (turn < 0 || turn >= this.states.length) {
      return false;
    }

    // Get the state at the target turn
    const state = this.states[turn];

    // Apply the mutation
    mutation(state);

    // Recompute from this turn (truncate everything after)
    this.recomputeFromTurn(turn);

    return true;
  }

  /**
   * Reset timeline to initial state
   */
  reset(initialState: PlanetState): void {
    this.states = [cloneState(initialState)];
    this.currentTurnIndex = 0;
    this.completionBuffer.clear();
  }

  /**
   * Get all states (for debugging/visualization)
   * Returns clones to prevent mutation
   */
  getAllStates(): PlanetState[] {
    return this.states.map((s) => cloneState(s));
  }
}
