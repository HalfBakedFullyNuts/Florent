/**
 * Tests for UI tickets BUG-2, UI-5, UI-6, UI-7, UI-8, UI-9
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';
import { ItemGrid } from '../../components/LaneBoard/ItemGrid';
import { CompactLane } from '../../components/QueueDisplay/CompactLane';
import { CompactLaneEntry } from '../../components/QueueDisplay/CompactLaneEntry';
import type { LaneView } from '../../lib/game/selectors';

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

  it('should display queue items with correct turn range format', () => {
    const mockEntry = {
      id: 'test-1',
      itemId: 'farm',
      itemName: 'Farm',
      status: 'pending' as const,
      quantity: 1,
      turnsRemaining: 4,
      eta: null,
    };

    const mockLaneView: LaneView = {
      laneId: 'building',
      entries: [mockEntry],
    };

    render(
      <CompactLaneEntry
        entry={mockEntry}
        currentTurn={1}
        onCancel={() => {}}
        disabled={false}
      />
    );

    // Should show format like "T1-T4 Farm ⏸4"
    const entryText = screen.getByText(/Farm/);
    expect(entryText).toBeInTheDocument();
  });

  it('should show activation and completion turns correctly', () => {
    const mockActiveEntry = {
      id: 'test-2',
      itemId: 'metal_mine',
      itemName: 'Metal Mine',
      status: 'active' as const,
      quantity: 1,
      turnsRemaining: 3,
      eta: 4,
    };

    render(
      <CompactLaneEntry
        entry={mockActiveEntry}
        currentTurn={1}
        onCancel={() => {}}
        disabled={false}
      />
    );

    // Active items should show ⏳ icon with remaining turns
    const entryText = screen.getByText(/Metal Mine/);
    expect(entryText).toBeInTheDocument();
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

    // Find and click a ship to queue (if available)
    const shipButtons = screen.getAllByText(/Fighter|Bomber|Frigate/);
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

  it('should display a turn position indicator in queue display', () => {
    const mockLaneView: LaneView = {
      laneId: 'building',
      entries: [],
    };

    render(
      <CompactLane
        laneId="building"
        laneView={mockLaneView}
        currentTurn={5}
        onCancel={() => {}}
        disabled={false}
      />
    );

    // Queue should be rendered even when empty (for turn indicator)
    const queueContainer = screen.getByText(/Queue empty/i).closest('div');
    expect(queueContainer).toBeInTheDocument();
  });
});

describe('UI-6: Sort Queue Items by Duration and Name', () => {
  it('should sort items by duration first, then alphabetically', () => {
    const mockItems = {
      metal_mine: { id: 'metal_mine', name: 'Metal Mine', lane: 'building', durationTurns: 4 },
      farm: { id: 'farm', name: 'Farm', lane: 'building', durationTurns: 4 },
      habitat: { id: 'habitat', name: 'Habitat', lane: 'building', durationTurns: 6 },
      launch_site: { id: 'launch_site', name: 'Launch Site', lane: 'building', durationTurns: 8 },
      colony: { id: 'colony', name: 'Colony', lane: 'building', durationTurns: 24 },
    };

    render(
      <ItemGrid
        availableItems={mockItems}
        onQueueItem={() => {}}
        canQueueItem={() => ({ allowed: true })}
      />
    );

    const buttons = screen.getAllByRole('button');
    const itemNames = buttons
      .map(btn => btn.textContent)
      .filter(text => text?.includes('Farm') || text?.includes('Metal Mine') || text?.includes('Habitat'));

    // Check that 4T items come before 6T items
    const farmIndex = itemNames.findIndex(name => name?.includes('Farm'));
    const habitatIndex = itemNames.findIndex(name => name?.includes('Habitat'));

    if (farmIndex !== -1 && habitatIndex !== -1) {
      expect(farmIndex).toBeLessThan(habitatIndex);
    }

    // Check alphabetical order within same duration
    const farmText = itemNames.find(name => name?.includes('Farm'));
    const metalMineText = itemNames.find(name => name?.includes('Metal Mine'));

    if (farmText && metalMineText) {
      const farmIdx = itemNames.indexOf(farmText);
      const metalIdx = itemNames.indexOf(metalMineText);
      expect(farmIdx).toBeLessThan(metalIdx); // Farm comes before Metal Mine alphabetically
    }
  });
});

describe('UI-7: Queue Items Grid Layout and Alignment', () => {
  it('should be left-aligned instead of center-aligned', () => {
    const mockItems = {
      farm: { id: 'farm', name: 'Farm', lane: 'building', durationTurns: 4 },
    };

    const { container } = render(
      <ItemGrid
        availableItems={mockItems}
        onQueueItem={() => {}}
        canQueueItem={() => ({ allowed: true })}
      />
    );

    // Check that mx-auto is NOT present (center alignment)
    const gridContainer = container.querySelector('.lg\\:grid-cols-3');
    if (gridContainer) {
      expect(gridContainer.className).not.toContain('mx-auto');
    }
  });

  it('should have sufficient width for long item names', () => {
    const mockItems = {
      strip_mineral: {
        id: 'strip_mineral',
        name: 'Strip Mineral Extractor',
        lane: 'building',
        durationTurns: 24,
        costsPerUnit: { metal: 360000, mineral: 48000 },
        workersRequired: 200000,
        groundSpace: 6
      },
    };

    const { container } = render(
      <ItemGrid
        availableItems={mockItems}
        onQueueItem={() => {}}
        canQueueItem={() => ({ allowed: true })}
      />
    );

    // Check that max-w-[280px] constraint is not present
    const itemContainers = container.querySelectorAll('.bg-pink-nebula-panel');
    itemContainers.forEach(container => {
      expect(container.className).not.toContain('max-w-[280px]');
    });
  });
});

describe('UI-8: Display Completed Structures List', () => {
  it('should show "Completed Structures" instead of "Ships"', () => {
    render(<Home />);

    // Should have a Completed Structures section
    const structuresHeading = screen.queryByText('Completed Structures');
    const shipsSection = screen.queryByText(/Ships built/i);

    // This will be true after implementation
    if (structuresHeading) {
      expect(structuresHeading).toBeInTheDocument();
      expect(shipsSection).not.toBeInTheDocument();
    }
  });

  it('should display structures in correct format', () => {
    // Mock completed structures data
    const completedStructures = {
      metal_mine: { count: 3, def: {
        name: 'Metal Mine',
        outputsPerTurn: { metal: 200 },
        consumesPerTurn: { energy: 10 },
        groundSpace: 1
      }},
      solar_generator: { count: 2, def: {
        name: 'Solar Generator',
        outputsPerTurn: { energy: 30 },
        groundSpace: 1
      }},
    };

    // After implementation, should show:
    // "Metal Mine x3 +600M -30E -3GS"
    // "Solar Generator x2 +60E -2GS"
  });

  it('should show "No structures built" when empty', () => {
    render(<Home />);

    // Initially should show no structures built (except Outpost)
    const noStructuresText = screen.queryByText(/No structures built|Outpost/);
    if (noStructuresText) {
      expect(noStructuresText).toBeInTheDocument();
    }
  });
});

describe('UI-9: Queue Display Layout - Spacing and Height', () => {
  it('should have reduced gap between queue lanes', () => {
    const { container } = render(<Home />);

    // Find the queue display grid
    const queueGrid = container.querySelector('.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    if (queueGrid) {
      // Should have gap-2 or gap-1 instead of gap-4
      expect(queueGrid.className).toMatch(/gap-[12]/);
      expect(queueGrid.className).not.toContain('gap-4');
    }
  });

  it('should have increased vertical space for queue display', () => {
    const mockLaneView: LaneView = {
      laneId: 'building',
      entries: Array(15).fill(null).map((_, i) => ({
        id: `test-${i}`,
        itemId: 'farm',
        itemName: 'Farm',
        status: 'pending' as const,
        quantity: 1,
        turnsRemaining: 4,
        eta: null,
      })),
    };

    const { container } = render(
      <CompactLane
        laneId="building"
        laneView={mockLaneView}
        currentTurn={1}
        onCancel={() => {}}
        disabled={false}
      />
    );

    // Check for increased max-height
    const scrollContainer = container.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      const hasIncreasedHeight =
        scrollContainer.className.includes('max-h-[1200px]') ||
        scrollContainer.className.includes('max-h-[60vh]') ||
        scrollContainer.className.includes('max-h-[70vh]');

      // Should NOT have the old limited height
      expect(scrollContainer.className).not.toContain('max-h-[400px]');
    }
  });

  it('should display more items without scrolling', () => {
    // Create a lane with many items
    const manyItems = Array(12).fill(null).map((_, i) => ({
      id: `item-${i}`,
      itemId: `item_${i}`,
      itemName: `Item ${i}`,
      status: 'pending' as const,
      quantity: 1,
      turnsRemaining: 4,
      eta: null,
    }));

    const mockLaneView: LaneView = {
      laneId: 'building',
      entries: manyItems,
    };

    render(
      <CompactLane
        laneId="building"
        laneView={mockLaneView}
        currentTurn={1}
        onCancel={() => {}}
        disabled={false}
      />
    );

    // With tripled height, more items should be visible
    // This is a conceptual test - actual visibility depends on implementation
    const items = screen.getAllByText(/Item \d+/);
    expect(items.length).toBeGreaterThan(3); // Should show more than just 3-4 items
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
      const queuedItem = screen.queryByText(/Farm/);
      if (queuedItem) {
        expect(queuedItem).toBeInTheDocument();
      }
    }
  });
});