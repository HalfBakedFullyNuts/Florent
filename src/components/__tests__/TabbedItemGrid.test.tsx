import { describe, expect, test } from 'vitest';
import { getMaxImmediateQueueQuantity, type SmartQueueCheckShape } from '../LaneBoard/TabbedItemGrid';

describe('TabbedItemGrid queue helpers', () => {
  test('max immediate quantity ignores eventual soft-wait availability', () => {
    const canQueueItem = (_itemId: string, _quantity: number): SmartQueueCheckShape => ({
      allowed: false,
      canQueueEventually: true,
      reason: 'INSUFFICIENT_RESOURCES',
    });

    expect(getMaxImmediateQueueQuantity('soldier', canQueueItem)).toBe(0);
  });

  test('max immediate quantity returns the highest currently allowed quantity', () => {
    const canQueueItem = (_itemId: string, quantity: number): SmartQueueCheckShape => ({
      allowed: quantity <= 37,
      canQueueEventually: quantity <= 100,
      reason: quantity <= 37 ? undefined : 'HOUSING_MISSING',
    });

    expect(getMaxImmediateQueueQuantity('scientist', canQueueItem)).toBe(37);
  });
});
