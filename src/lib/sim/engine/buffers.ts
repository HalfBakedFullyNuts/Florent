/**
 * Completion buffer for managing turn-keyed deferred completions
 */

import type { WorkItem } from './types';

export class CompletionBuffer {
  private completions: Map<number, WorkItem[]>;

  constructor() {
    this.completions = new Map();
  }

  /**
   * Enqueue item for completion at specified turn
   */
  enqueue(turn: number, item: WorkItem): void {
    const items = this.completions.get(turn) || [];
    items.push(item);
    this.completions.set(turn, items);
  }

  /**
   * Drain and return all items for specified turn
   */
  drain(turn: number): WorkItem[] {
    const items = this.completions.get(turn) || [];
    this.completions.delete(turn);
    return items;
  }

  /**
   * Clear all buffered completions
   */
  clear(): void {
    this.completions.clear();
  }
}
