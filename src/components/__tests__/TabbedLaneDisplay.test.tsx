import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TabbedLaneDisplay } from '../QueueDisplay/TabbedLaneDisplay';
import type { LaneView } from '../../lib/game/selectors';

const defs = {
  farm: { name: 'Farm', costsPerUnit: {} },
  metal_mine: { name: 'Metal Mine', costsPerUnit: {} },
  mineral_extractor: { name: 'Mineral Extractor', costsPerUnit: {} },
};

function renderDisplay(buildingLane: LaneView, onTurnClick = vi.fn()) {
  render(
    <TabbedLaneDisplay
      buildingLane={buildingLane}
      shipLane={{ laneId: 'ship', entries: [] }}
      colonistLane={{ laneId: 'colonist', entries: [] }}
      researchLane={{ laneId: 'research', entries: [] }}
      currentTurn={1}
      onCancel={vi.fn()}
      defs={defs}
      activeTab="building"
      onTurnClick={onTurnClick}
      maxTurn={199}
    />
  );
}

describe('TabbedLaneDisplay', () => {
  it('renders the latest queue item at the top from chronological lane entries', () => {
    renderDisplay({
      laneId: 'building',
      entries: [
        {
          id: 'farm',
          itemId: 'farm',
          itemName: 'Farm',
          status: 'completed',
          quantity: 1,
          turnsRemaining: 0,
          eta: null,
          startTurn: 1,
          completionTurn: 5,
        },
        {
          id: 'metal',
          itemId: 'metal_mine',
          itemName: 'Metal Mine',
          status: 'pending',
          quantity: 1,
          turnsRemaining: 4,
          eta: 9,
          startTurn: 6,
          completionTurn: 9,
        },
        {
          id: 'mineral',
          itemId: 'mineral_extractor',
          itemName: 'Mineral Extractor',
          status: 'pending',
          quantity: 1,
          turnsRemaining: 4,
          eta: 13,
          startTurn: 10,
          completionTurn: 13,
        },
      ],
    });

    const text = document.body.textContent || '';
    expect(text.indexOf('Mineral Extractor')).toBeLessThan(text.indexOf('Metal Mine'));
    expect(text.indexOf('Metal Mine')).toBeLessThan(text.indexOf('Farm'));
  });

  it('shows projected build duration from the visible turn span when remaining turns are zero', () => {
    renderDisplay({
      laneId: 'building',
      entries: [{
        id: 'farm',
        itemId: 'farm',
        itemName: 'Farm',
        status: 'completed',
        quantity: 1,
        turnsRemaining: 0,
        eta: null,
        startTurn: 1,
        completionTurn: 4,
      }],
    });

    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T4')).toBeInTheDocument();
    expect(screen.getByText('4T')).toBeInTheDocument();
    expect(screen.queryByText('0T')).not.toBeInTheDocument();
  });

  it('displays completion turns beyond the simulator limit but clamps navigation', () => {
    const onTurnClick = vi.fn();
    renderDisplay({
      laneId: 'building',
      entries: [{
        id: 'slow',
        itemId: 'metal_mine',
        itemName: 'Metal Mine',
        status: 'active',
        quantity: 1,
        turnsRemaining: 80,
        eta: 250,
        startTurn: 170,
        completionTurn: 250,
      }],
    }, onTurnClick);

    fireEvent.click(screen.getByRole('button', { name: 'T250' }));

    expect(screen.getByText('T250')).toBeInTheDocument();
    expect(onTurnClick).toHaveBeenCalledWith(199);
  });

  it('clears the active lane from the queue header', () => {
    const onClearLane = vi.fn();
    render(
      <TabbedLaneDisplay
        buildingLane={{ laneId: 'building', entries: [] }}
        shipLane={{
          laneId: 'ship',
          entries: [{
            id: 'fighters',
            itemId: 'fighter',
            itemName: 'Fighter',
            status: 'pending',
            quantity: 5,
            turnsRemaining: 4,
            eta: 8,
            startTurn: 5,
            completionTurn: 8,
          }],
        }}
        colonistLane={{ laneId: 'colonist', entries: [] }}
        researchLane={{ laneId: 'research', entries: [] }}
        currentTurn={1}
        onCancel={vi.fn()}
        onClearLane={onClearLane}
        defs={defs}
        activeTab="ship"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Ships lane' }));

    expect(onClearLane).toHaveBeenCalledWith('ship');
  });
});

describe('TabbedLaneDisplay reordering', () => {
  const entry = (id: string, name: string, startTurn: number) => ({
    id, itemId: id, itemName: name, status: 'completed' as const, quantity: 1, turnsRemaining: 0,
    eta: startTurn + 3, startTurn, completionTurn: startTurn + 3,
  });
  // Viewed turn is past the whole queue (the default after "Advance after queuing").
  const lane: LaneView = {
    laneId: 'building',
    entries: [entry('farm', 'Farm', 1), entry('metal_mine', 'Metal Mine', 5), entry('mineral_extractor', 'Mineral Extractor', 9)],
  };
  const reorderPlan = { activeId: 'farm', pendingIds: ['metal_mine', 'mineral_extractor'], activeInIndexSpace: false };

  function renderReorderable(onReorder = vi.fn()) {
    render(
      <TabbedLaneDisplay
        buildingLane={lane}
        shipLane={{ laneId: 'ship', entries: [] }}
        colonistLane={{ laneId: 'colonist', entries: [] }}
        researchLane={{ laneId: 'research', entries: [] }}
        currentTurn={20}
        onCancel={vi.fn()}
        onReorder={onReorder}
        reorderPlan={reorderPlan}
        defs={defs}
        activeTab="building"
        maxTurn={199}
      />
    );
    return onReorder;
  }

  const row = (name: string) => screen.getByText(name).closest('li[draggable]') as HTMLElement;

  it('reorders by drag even when the viewed turn is past every entry', () => {
    const onReorder = renderReorderable();
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => ''), types: [] as string[], effectAllowed: '', dropEffect: '' };

    fireEvent.dragStart(row('Mineral Extractor'), { dataTransfer });
    fireEvent.dragOver(row('Metal Mine'), { dataTransfer });
    fireEvent.drop(row('Metal Mine'), { dataTransfer });

    expect(onReorder).toHaveBeenCalledWith('building', 'mineral_extractor', 0);
  });

  it('moves an entry one slot later in the plan with the "Move up" arrow (newest-first list)', () => {
    const onReorder = renderReorderable();

    const up = row('Metal Mine').querySelector('button[aria-label="Move up"]') as HTMLButtonElement;
    expect(up).not.toBeDisabled();
    fireEvent.click(up);

    expect(onReorder).toHaveBeenCalledWith('building', 'metal_mine', 1);
  });
});
