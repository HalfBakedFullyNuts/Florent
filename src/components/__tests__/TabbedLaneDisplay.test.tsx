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
});
