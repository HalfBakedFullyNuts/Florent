/**
 * Tests for completion buffer
 * Ticket 5: Build completions & colonist conversion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionBuffer } from '../buffers';
import type { WorkItem } from '../types';

describe('CompletionBuffer', () => {
  let buffer: CompletionBuffer;

  beforeEach(() => {
    buffer = new CompletionBuffer();
  });

  describe('enqueue and drain', () => {
    it('should enqueue and drain items for a turn', () => {
      const item: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(5, item);
      const drained = buffer.drain(5);

      expect(drained).toHaveLength(1);
      expect(drained[0]).toEqual(item);
    });

    it('should return empty array for turn with no items', () => {
      const drained = buffer.drain(10);
      expect(drained).toEqual([]);
    });

    it('should handle multiple items for same turn', () => {
      const item1: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      const item2: WorkItem = {
        id: 'test2',
        itemId: 'farm',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(5, item1);
      buffer.enqueue(5, item2);

      const drained = buffer.drain(5);
      expect(drained).toHaveLength(2);
      expect(drained).toContainEqual(item1);
      expect(drained).toContainEqual(item2);
    });

    it('should separate items by turn', () => {
      const item1: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      const item2: WorkItem = {
        id: 'test2',
        itemId: 'farm',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(5, item1);
      buffer.enqueue(6, item2);

      const turn5 = buffer.drain(5);
      const turn6 = buffer.drain(6);

      expect(turn5).toHaveLength(1);
      expect(turn5[0]).toEqual(item1);
      expect(turn6).toHaveLength(1);
      expect(turn6[0]).toEqual(item2);
    });

    it('should remove items after draining', () => {
      const item: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(5, item);
      buffer.drain(5);
      const drained = buffer.drain(5);

      expect(drained).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all buffered completions', () => {
      const item1: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      const item2: WorkItem = {
        id: 'test2',
        itemId: 'farm',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(5, item1);
      buffer.enqueue(10, item2);
      buffer.clear();

      expect(buffer.drain(5)).toEqual([]);
      expect(buffer.drain(10)).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle turn 0', () => {
      const item: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(0, item);
      const drained = buffer.drain(0);

      expect(drained).toHaveLength(1);
      expect(drained[0]).toEqual(item);
    });

    it('should handle large turn numbers', () => {
      const item: WorkItem = {
        id: 'test1',
        itemId: 'metal_mine',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
      };

      buffer.enqueue(999999, item);
      const drained = buffer.drain(999999);

      expect(drained).toHaveLength(1);
      expect(drained[0]).toEqual(item);
    });
  });
});
