import { describe, it, expect } from 'vitest';
import { UndoStack } from '../undoStack';

describe('UndoStack', () => {
  it('returns snapshots newest first and reports when it is empty', () => {
    const stack = new UndoStack<string>();
    expect(stack.canUndo).toBe(false);
    stack.push('a', 'Add Farm');
    stack.push('b', 'Reorder');

    expect(stack.canUndo).toBe(true);
    expect(stack.peekLabel).toBe('Reorder');
    expect(stack.pop()).toEqual({ snapshot: 'b', label: 'Reorder' });
    expect(stack.pop()).toEqual({ snapshot: 'a', label: 'Add Farm' });
    expect(stack.pop()).toBeNull();
  });

  it('keeps only the most recent steps', () => {
    const stack = new UndoStack<number>(3);
    for (let i = 1; i <= 5; i++) stack.push(i, `step ${i}`);
    expect([stack.pop()?.snapshot, stack.pop()?.snapshot, stack.pop()?.snapshot, stack.pop()]).toEqual([5, 4, 3, null]);
  });

  it('drops the last push when a change is abandoned, and clears', () => {
    const stack = new UndoStack<string>();
    stack.push('a', 'Add Farm');
    stack.push('b', 'Add Mine');
    stack.discardLast();
    expect(stack.peekLabel).toBe('Add Farm');
    stack.clear();
    expect(stack.canUndo).toBe(false);
  });
});
