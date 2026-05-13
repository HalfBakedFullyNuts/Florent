import React from 'react';
import { describe, expect, it, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TabbedItemGrid, getMaxImmediateQueueQuantity, type SmartQueueCheckShape } from '../LaneBoard/TabbedItemGrid';

// ---------------------------------------------------------------------------
// Pure-function tests for getMaxImmediateQueueQuantity
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// Component tests for TabbedItemGrid
// ---------------------------------------------------------------------------

const mockItems: Record<string, any> = {
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    lane: 'ship',
    durationTurns: 5,
    costsPerUnit: { metal: 100 },
    upkeepPerUnit: {},
    tier: 1,
  },
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    lane: 'colonist',
    durationTurns: 1,
    costsPerUnit: { workers: 1 },
    upkeepPerUnit: {},
    tier: 1,
    colonistKind: 'soldier',
  },
  scientist: {
    id: 'scientist',
    name: 'Scientist',
    lane: 'colonist',
    durationTurns: 1,
    costsPerUnit: { workers: 1 },
    upkeepPerUnit: {},
    tier: 1,
    colonistKind: 'scientist',
  },
};

const alwaysAllowed = (_id: string, _qty: number): SmartQueueCheckShape => ({
  allowed: true,
  canQueueEventually: true,
  waitTurnsNeeded: 0,
});

const maxAt100 = (_id: string, qty: number): SmartQueueCheckShape => ({
  allowed: qty <= 100,
  canQueueEventually: true,
  waitTurnsNeeded: 0,
});

describe('TabbedItemGrid component', () => {
  it('shows quantity controls for ships', () => {
    render(
      <TabbedItemGrid
        availableItems={mockItems}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    // Should have + ++ +++ buttons
    expect(screen.getByLabelText('Add 1 to quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Add 10 to quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Add 1000 to quantity')).toBeInTheDocument();
  });

  it('increments quantity with + button', () => {
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.click(screen.getByLabelText('Add 1 to quantity'));
    expect(input).toHaveValue('2');
  });

  it('increments quantity with ++ button (+10)', () => {
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.click(screen.getByLabelText('Add 10 to quantity'));
    expect(input).toHaveValue('11');
  });

  it('increments quantity with +++ button (+1000)', () => {
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.click(screen.getByLabelText('Add 1000 to quantity'));
    expect(input).toHaveValue('1001');
  });

  it('clamps quantity to max when increment exceeds maximum', () => {
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={vi.fn()}
        canQueueItem={maxAt100}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.click(screen.getByLabelText('Add 1000 to quantity'));
    expect(input).toHaveValue('100');
  });

  it('queues current quantity on Enter key', () => {
    const onQueueItem = vi.fn();
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={onQueueItem}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onQueueItem).toHaveBeenCalledWith('fighter', 5);
  });

  it('resets quantity on Escape key', () => {
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '42' } });
    expect(input).toHaveValue('42');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('1');
  });

  it('queues via add button', () => {
    const onQueueItem = vi.fn();
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={onQueueItem}
        canQueueItem={alwaysAllowed}
        activeTab="ship"
      />
    );
    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Queue Fighter'));
    expect(onQueueItem).toHaveBeenCalledWith('fighter', 3);
  });

  it('max button queues the maximum immediately', () => {
    const onQueueItem = vi.fn();
    render(
      <TabbedItemGrid
        availableItems={{ fighter: mockItems.fighter }}
        onQueueItem={onQueueItem}
        canQueueItem={maxAt100}
        activeTab="ship"
      />
    );
    fireEvent.click(screen.getByLabelText('Queue maximum Fighter'));
    expect(onQueueItem).toHaveBeenCalledWith('fighter', 100);
  });

  it('soldiers default quantity is 100', () => {
    render(
      <TabbedItemGrid
        availableItems={{ soldier: mockItems.soldier }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="colonist"
      />
    );
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('scientists default quantity is 100', () => {
    render(
      <TabbedItemGrid
        availableItems={{ scientist: mockItems.scientist }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="colonist"
      />
    );
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('both soldiers and scientists default to 100 when rendered together', () => {
    render(
      <TabbedItemGrid
        availableItems={{ soldier: mockItems.soldier, scientist: mockItems.scientist }}
        onQueueItem={vi.fn()}
        canQueueItem={alwaysAllowed}
        activeTab="colonist"
      />
    );
    const inputs = screen.getAllByDisplayValue('100');
    expect(inputs.length).toBe(2);
  });
});
