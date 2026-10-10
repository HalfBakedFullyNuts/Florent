import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BuildListOverviewModal, type TurnStats } from '../BuildListOverviewModal';
import type { LaneEntry } from '../../lib/game/selectors';

function entry(id: string, itemName: string, startTurn: number, completionTurn: number, extra: Partial<LaneEntry> = {}): LaneEntry {
  return { id, itemId: id, itemName, status: 'pending', quantity: 1, turnsRemaining: 4, eta: completionTurn, startTurn, completionTurn, ...extra };
}

const lanes = {
  building: [
    entry('farm', 'Farm', 1, 4),
    entry('spy', 'Spy Centre', 5, 20, { invalid: true, invalidReason: 'T21–T24: Energy output negative (net energy -40/turn)' }),
  ],
  ship: [],
  colonist: [entry('sci', 'Scientist', 1, 8, { quantity: 100 })],
  research: [],
};

const stats: TurnStats = {
  stocks: { metal: 30000, mineral: 20000, food: 1000, energy: 20000, research_points: 100 },
  income: { metal: 1200, mineral: 800, food: 140, energy: 70, research_points: 250 },
  population: { workers: 30000, soldiers: 0, scientists: 250 },
};

function renderOverview(statsAt = vi.fn(() => stats), onJumpToTurn = vi.fn()) {
  render(
    <BuildListOverviewModal
      planetName="Homeworld"
      lanes={lanes}
      problems={[{ kind: 'NEGATIVE_ENERGY', turn: 21, endTurn: 24, detail: 'net energy -40/turn' }]}
      nameOf={(id) => id}
      statsAt={statsAt}
      onJumpToTurn={onJumpToTurn}
      onClose={vi.fn()}
    />,
  );
  return { statsAt, onJumpToTurn };
}

describe('BuildListOverviewModal', () => {
  it('shows every lane side by side, one row per start turn', () => {
    renderOverview();
    const table = screen.getByRole('table', { name: /Build list of Homeworld/i });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Turn', 'Structures', 'Ships', 'Colonists', 'Research']);

    const firstRow = within(table).getByRole('row', { name: /^T1\b/ });
    expect(firstRow).toHaveTextContent('Farm');
    expect(firstRow).toHaveTextContent('Scientist ×100');
  });

  it('shows planet stats for a turn on hover', () => {
    const { statsAt } = renderOverview();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'T5' }));

    expect(statsAt).toHaveBeenCalledWith(5);
    const card = screen.getByRole('tooltip');
    expect(card).toHaveTextContent('Metal');
    expect(card).toHaveTextContent('30.000');
    expect(card).toHaveTextContent('+1.200');
    expect(card).toHaveTextContent('Scientists');
  });

  it('highlights problems: the entry, the turn they begin and a summary', () => {
    renderOverview();
    expect(screen.getByText(/1 problem in this build list/i)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^T5\b/ })).toHaveTextContent('Energy output negative');
    expect(screen.getByRole('row', { name: /^T21\b/ })).toHaveAttribute('data-problem', 'true');
  });

  it('jumps to a turn when its number is clicked', () => {
    const { onJumpToTurn } = renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'T21' }));
    expect(onJumpToTurn).toHaveBeenCalledWith(21);
  });
});
