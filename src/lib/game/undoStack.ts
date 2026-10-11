/** Bounded last-in-first-out history of snapshots for the planner's Undo button. */

const DEFAULT_LIMIT = 50;

export interface UndoEntry<T> {
  snapshot: T;
  /** What the step did, e.g. "Add Farm" — shown on the Undo button. */
  label: string;
}

export class UndoStack<T> {
  private entries: UndoEntry<T>[] = [];

  constructor(private readonly limit: number = DEFAULT_LIMIT) {}

  get canUndo(): boolean {
    return this.entries.length > 0;
  }

  get peekLabel(): string | null {
    return this.entries[this.entries.length - 1]?.label ?? null;
  }

  push(snapshot: T, label: string): void {
    this.entries.push({ snapshot, label });
    if (this.entries.length > this.limit) this.entries.shift();
  }

  pop(): UndoEntry<T> | null {
    return this.entries.pop() ?? null;
  }

  /** Forgets the latest step, for a change that ended up not being applied. */
  discardLast(): void {
    this.entries.pop();
  }

  clear(): void {
    this.entries = [];
  }
}
