import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningsPanel } from '../WarningsPanel';

describe('WarningsPanel', () => {
  it('stays mounted as an empty alert slot when there are no warnings', () => {
    render(<WarningsPanel warnings={[]} />);

    const slot = screen.getByRole('status');
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveAttribute('data-empty', 'true');
    expect(slot.textContent?.trim()).toBe('');
  });

  it('shows the most severe alert first, e.g. an action error over an engine warning', () => {
    render(
      <WarningsPanel
        warnings={[
          { type: 'NO_FOOD', message: 'Food is running out', severity: 'warning' },
          { type: 'ACTION_ERROR', message: 'Cannot queue item', severity: 'error' },
        ]}
      />
    );

    const slot = screen.getByRole('status');
    expect(slot).toHaveAttribute('data-empty', 'false');
    expect(slot).toHaveTextContent('Cannot queue item');
    expect(screen.getByRole('button', { name: 'Show all 2 warnings' })).toBeInTheDocument();
  });
});
