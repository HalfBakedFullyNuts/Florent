import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import {
  getMaxImmediateQueueQuantity,
  getMaxQueueableQuantity,
  TabbedItemGrid,
  type SmartQueueCheckShape,
} from '../LaneBoard/TabbedItemGrid';

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

  test('handles a large max correctly (50000)', () => {
    const canQueueItem = (_itemId: string, qty: number): SmartQueueCheckShape => ({
      allowed: qty <= 50000,
      canQueueEventually: true,
      waitTurnsNeeded: 0,
    });
    expect(getMaxImmediateQueueQuantity('fighter', canQueueItem)).toBe(50000);
  });

  test('max queueable quantity follows eventual queueability like manual input', () => {
    const canQueueItem = (_itemId: string, quantity: number): SmartQueueCheckShape => ({
      allowed: quantity <= 37,
      canQueueEventually: quantity <= 100,
      reason: quantity <= 37 ? undefined : 'Waiting for resources',
    });

    expect(getMaxQueueableQuantity('scientist', canQueueItem)).toBe(100);
  });
});

describe('TabbedItemGrid batch controls', () => {
  const availableItems = {
    fighter: {
      id: 'fighter',
      name: 'Fighter',
      lane: 'ship',
      durationTurns: 4,
      costsPerUnit: {},
      upkeepPerUnit: {},
      prerequisites: [],
    },
  };

  test('step buttons update the quantity submitted by add', () => {
    const onQueueItem = vi.fn();
    render(
      <TabbedItemGrid
        availableItems={availableItems}
        onQueueItem={onQueueItem}
        canQueueItem={() => ({ allowed: true, canQueueEventually: true })}
        activeTab="ship"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity by 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity by 100' }));
    fireEvent.click(screen.getByRole('button', { name: 'Queue Fighter' }));

    expect(onQueueItem).toHaveBeenCalledWith('fighter', 111);
  });

  test('max button uses eventual queueability instead of immediate-only allowed quantity', () => {
    const onQueueItem = vi.fn();
    render(
      <TabbedItemGrid
        availableItems={availableItems}
        onQueueItem={onQueueItem}
        canQueueItem={(_itemId, quantity) => ({
          allowed: quantity <= 5,
          canQueueEventually: quantity <= 100,
        })}
        activeTab="ship"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Queue maximum Fighter' }));

    expect(onQueueItem).toHaveBeenCalledWith('fighter', 99999);
  });

  test('item-count badge can clear the active lane', () => {
    const onClearLane = vi.fn();
    render(
      <TabbedItemGrid
        availableItems={availableItems}
        onQueueItem={vi.fn()}
        onClearLane={onClearLane}
        canQueueItem={() => ({ allowed: true, canQueueEventually: true })}
        activeTab="ship"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Ships lane' }));

    expect(onClearLane).toHaveBeenCalledWith('ship');
  });
});
