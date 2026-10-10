import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlanCheckDialog } from '../PlanCheckDialog';

const problems = [
  { kind: 'NEGATIVE_ENERGY' as const, turn: 21, endTurn: 24, detail: 'net energy -40/turn' },
  { kind: 'NEVER_STARTS' as const, turn: 200, itemId: 'space_dock', detail: 'never starts: missing Metropolis' },
];
const nameOf = (id: string) => (id === 'space_dock' ? 'Space Dock' : id);

describe('PlanCheckDialog', () => {
  it('lists every problem with its turn, headline and reason', () => {
    render(<PlanCheckDialog title="This reorder breaks your plan" problems={problems} nameOf={nameOf} actions={[]} onCancel={vi.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('T21–T24');
    expect(items[0]).toHaveTextContent('Energy output negative');
    expect(items[1]).toHaveTextContent('Space Dock never starts');
    expect(items[1]).toHaveTextContent('missing Metropolis');
  });

  it('each action reports its choice and cancel backs out', () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();
    render(
      <PlanCheckDialog
        title="Check"
        problems={problems}
        nameOf={nameOf}
        actions={[{ label: 'Do it anyway', onSelect: onApply, tone: 'danger' }]}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Do it anyway' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /^Cancel/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
