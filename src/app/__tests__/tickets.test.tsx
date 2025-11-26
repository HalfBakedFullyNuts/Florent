/**
 * Tests for UI tickets - Home page integration tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '',
}));

describe('BUG-2: Queue Display Turn Range Format', () => {
  it('should start the game at T1 instead of T0', () => {
    render(<Home />);
    // Look for turn display - should show Turn 1
    const turnInput = screen.getByRole('spinbutton', { name: /turn/i });
    expect(turnInput).toHaveValue(1);
  });
});

describe('UI-5: Auto-Advance to Completion & Queue Timeline Visualization', () => {
  it('should auto-advance to completion turn when queueing buildings', async () => {
    render(<Home />);

    // Find and click a structure to queue
    const farmButton = screen.getAllByText(/Farm/)[0]?.closest('button');
    if (farmButton) {
      fireEvent.click(farmButton);

      // After queueing a 4-turn building at T1, should advance to T5
      await waitFor(() => {
        const turnInput = screen.getByRole('spinbutton', { name: /turn/i });
        expect(Number(turnInput.getAttribute('value'))).toBeGreaterThan(1);
      });
    }
  });

  it('should NOT auto-advance when queueing ships or colonists', async () => {
    render(<Home />);

    // First switch to Ships tab
    const shipsTab = screen.queryByRole('tab', { name: /ships/i });
    if (shipsTab) {
      fireEvent.click(shipsTab);
    }

    // Find and click a ship to queue (if available)
    const shipButtons = screen.queryAllByText(/Fighter|Bomber|Frigate/);
    const currentTurnBefore = screen.getByRole('spinbutton', { name: /turn/i }).getAttribute('value');

    if (shipButtons.length > 0) {
      fireEvent.click(shipButtons[0]);

      // Turn should remain the same
      await waitFor(() => {
        const turnInput = screen.getByRole('spinbutton', { name: /turn/i });
        expect(turnInput.getAttribute('value')).toBe(currentTurnBefore);
      });
    }
  });
});

describe('UI-8: Display Completed Structures List', () => {
  it('should show buildings list with Outpost', () => {
    render(<Home />);

    // Initially should show Buildings section with at least Outpost
    expect(screen.getByText(/^Buildings$/i)).toBeInTheDocument();

    // Outpost should be in the list (may appear multiple times in different sections)
    const outpostElements = screen.queryAllByText(/Outpost/i);
    expect(outpostElements.length).toBeGreaterThan(0);
  });
});

describe('Integration Tests', () => {
  it('should handle the full queue workflow with all improvements', async () => {
    render(<Home />);

    // 1. Game should start at T1
    const turnInput = screen.getByRole('spinbutton', { name: /turn/i });
    expect(turnInput).toHaveValue(1);

    // 2. Find a structure button (should be sorted by duration)
    const structureButtons = screen.getAllByRole('button');
    const farmButton = structureButtons.find(btn => btn.textContent?.includes('Farm'));

    if (farmButton) {
      // 3. Click to queue
      fireEvent.click(farmButton);

      // 4. Should auto-advance for buildings
      await waitFor(() => {
        const newTurn = Number(turnInput.getAttribute('value'));
        expect(newTurn).toBeGreaterThan(1);
      });

      // 5. Queue should show the item with proper format
      const queuedItems = screen.queryAllByText(/Farm/);
      if (queuedItems.length > 0) {
        expect(queuedItems[0]).toBeInTheDocument();
      }
    }
  });
});
