/**
 * Regression test: cancelling a queued item that other queue entries depend on
 * must show the DependencyWarningModal. Previously the state was set but the
 * modal was never rendered, leaving users with zero feedback.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({ get: vi.fn() }),
  usePathname: () => '',
}));

describe('DependencyWarningModal wiring', () => {
  it('shows a prerequisite warning when cancelling an item with dependents', async () => {
    render(<Home />);

    // Queue launch_site, then comms_satellite which depends on it.
    // Item cards are clickable divs (not buttons), so click via the row.
    const clickItemCard = (label: string) => {
      const textEl = screen
        .getAllByText(label)
        .map((el) => el.closest('div[draggable="true"]'))
        .find(Boolean);
      expect(textEl).toBeTruthy();
      fireEvent.click(textEl as HTMLElement);
    };

    clickItemCard('Launch Site');
    // Queue panel now shows Launch Site in addition to the grid entry
    await waitFor(() => {
      expect(screen.getAllByText('Launch Site').length).toBeGreaterThan(1);
    });

    clickItemCard('Comms Satellite');
    await waitFor(() => {
      expect(screen.getAllByText('Comms Satellite').length).toBeGreaterThan(1);
    });

    // Auto-advance jumped the view to the completion turn; go back to T1 so
    // both entries are still pending in the queue panel.
    const turnInput = screen.getByRole('spinbutton', { name: /turn/i });
    fireEvent.change(turnInput, { target: { value: '1' } });
    fireEvent.blur(turnInput);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove Comms Satellite from queue/i }).length).toBe(1);
    });

    const cancelButtons = screen.getAllByRole('button', { name: /Remove Launch Site from queue/i });
    expect(cancelButtons.length).toBe(1);
    fireEvent.click(cancelButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/Prerequisite Warning/i)).toBeInTheDocument();
  });
});
