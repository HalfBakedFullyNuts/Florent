/**
 * Timeline management and recomputation
 * Fixed 200-turn timeline architecture for simplified queue management
 */

import type { PlanetState } from '../sim/engine/types';
import { simulate, runTurn } from '../sim/engine/turn';
import { CompletionBuffer } from '../sim/engine/buffers';
import { cloneState } from '../sim/engine/helpers';

/**
 * Timeline state manager with fixed 200-turn architecture
 * Always maintains exactly 200 pre-computed turns for consistent UX
 */
export class Timeline {
  private static readonly FIXED_TURNS = 200;
  private states: PlanetState[];
  private currentTurnIndex: number;
  private completionBuffer: CompletionBuffer;
  private stableFromTurn: number = -1; // Cache for stable state optimization

  constructor(initialState: PlanetState) {
    this.states = new Array(Timeline.FIXED_TURNS);
    this.states[0] = cloneState(initialState);
    this.currentTurnIndex = 0;
    this.completionBuffer = new CompletionBuffer();

    // Pre-compute all 200 turns on initialization
    this.recomputeAll();
  }

  /**
   * Get state at specific turn
   * Returns undefined if turn hasn't been computed yet
   */
  getStateAtTurn(turn: number): PlanetState | undefined {
    // Map turn number to array index (turn 1 = index 0)
    const initialTurn = this.states[0]?.currentTurn || 1;
    const index = turn - initialTurn;

    if (index < 0 || index >= this.states.length) {
      return undefined;
    }
    return cloneState(this.states[index]);
  }

  /**
   * Get current turn number (not index)
   */
  getCurrentTurn(): number {
    return this.states[this.currentTurnIndex]?.currentTurn || 1;
  }

  /**
   * Get current state
   */
  getCurrentState(): PlanetState {
    return cloneState(this.states[this.currentTurnIndex]);
  }

  /**
   * Get total number of computed turns (always 200)
   */
  getTotalTurns(): number {
    return Timeline.FIXED_TURNS;
  }

  /**
   * Recompute all 200 turns from scratch
   * Optimized with stable state detection
   */
  recomputeAll(): void {
    const start = performance.now();
    this.stableFromTurn = -1;

    // Reset completion buffer for fresh computation
    this.completionBuffer.clear();

    for (let i = 1; i < Timeline.FIXED_TURNS; i++) {
      // Clone previous state and run turn
      this.states[i] = cloneState(this.states[i - 1]);
      runTurn(this.states[i], this.completionBuffer);

      // Detect stable state (no active items, no pending queues)
      if (this.stableFromTurn === -1 && this.isStableState(this.states[i])) {
        this.stableFromTurn = i;
        // Fast-copy stable state to remaining turns
        const stableState = this.states[i];
        for (let j = i + 1; j < Timeline.FIXED_TURNS; j++) {
          this.states[j] = cloneState(stableState);
          // Increment turn counter for each cloned state
          this.states[j].currentTurn = stableState.currentTurn + (j - i);
        }
        break;
      }
    }

    const duration = performance.now() - start;
    if (duration > 100) {
      console.log(`Timeline recompute: ${duration.toFixed(1)}ms, stable from T${this.stableFromTurn}`);
    }
  }

  /**
   * Check if state is stable (no work remaining)
   */
  private isStableState(state: PlanetState): boolean {
    return Object.values(state.lanes).every(
      lane => !lane.active && lane.pendingQueue.length === 0
    );
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
    }
    return this.getCurrentState();
  }

  /**
   * Simulate N turns by advancing the view (backward compatibility)
   * All 200 turns are already pre-computed; this just moves the view forward
   */
  simulateTurns(count: number): void {
    // Advance current turn index by count (max at 199)
    const newIndex = this.currentTurnIndex + count;
    if (newIndex < Timeline.FIXED_TURNS) {
      this.currentTurnIndex = newIndex;
    } else {
      this.currentTurnIndex = Timeline.FIXED_TURNS - 1;
    }
  }

  /**
   * Apply a state mutation at specific turn and recompute all 200 turns
   * This is used by the commands API to apply changes
   */
  mutateAtTurn(turn: number, mutation: (state: PlanetState) => void): boolean {
    // Map turn number to array index
    const initialTurn = this.states[0]?.currentTurn || 1;
    const index = turn - initialTurn;

    if (index < 0 || index >= Timeline.FIXED_TURNS) {
      return false;
    }

    // Get the state at the target turn
    const state = this.states[index];

    // Apply the mutation
    mutation(state);

    // Recompute all 200 turns from the beginning
    this.recomputeAll();

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
    return this.states.map((s) => cloneState(s));
  }
}
