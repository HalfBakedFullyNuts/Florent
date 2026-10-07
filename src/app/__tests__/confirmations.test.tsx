/**
 * Destructive planner actions ask first: "Reset plan" wipes every colony, queue and
 * research; "Clear" empties a whole lane. Neither may act until the user confirms.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

function queueFarm() {
  fireEvent.click(screen.getByRole('button', { name: 'Queue Farm' }));
}

function farmQueueEntries() {
  return screen.queryAllByRole('button', { name: /Remove Farm from queue/i });
}

describe('destructive action confirmations', () => {
  it('Reset plan asks before wiping the plan and keeps it on cancel', async () => {
    render(<Home />);
    queueFarm();
    await waitFor(() => expect(farmQueueEntries()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /reset plan/i }));
    const dialog = screen.getByRole('dialog', { name: /reset plan/i });
    expect(farmQueueEntries()).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('dialog', { name: /reset plan/i })).not.toBeInTheDocument();
    expect(farmQueueEntries()).toHaveLength(1);
  });

  it('Reset plan wipes the queue once confirmed', async () => {
    render(<Home />);
    queueFarm();
    await waitFor(() => expect(farmQueueEntries()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /reset plan/i }));
    const dialog = screen.getByRole('dialog', { name: /reset plan/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^reset plan$/i }));

    await waitFor(() => expect(farmQueueEntries()).toHaveLength(0));
  });

  it('Clear asks before emptying a lane and clears once confirmed', async () => {
    render(<Home />);
    queueFarm();
    await waitFor(() => expect(farmQueueEntries()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /clear structures lane/i }));
    const dialog = screen.getByRole('dialog', { name: /clear the structures lane/i });
    expect(farmQueueEntries()).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole('button', { name: /^clear lane$/i }));
    await waitFor(() => expect(farmQueueEntries()).toHaveLength(0));
  });
});
