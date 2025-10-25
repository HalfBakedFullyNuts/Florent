/**
 * ItemSelectionPanel Component Tests
 *
 * Ticket 25: Item selection panel with tabs
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemSelectionPanel } from '../ItemSelectionPanel';

describe('ItemSelectionPanel', () => {
  const mockOnQueueItem = vi.fn();
  const mockCanQueueItem = vi.fn();

  const mockAvailableItems = {
    metal_mine: {
      id: 'metal_mine',
      name: 'Metal Mine',
      tier: 1,
      durationTurns: 5,
      lane: 'building',
      costsPerUnit: {
        resources: { metal: 500, mineral: 200 },
      },
    },
    mineral_extractor: {
      id: 'mineral_extractor',
      name: 'Mineral Extractor',
      tier: 1,
      durationTurns: 4,
      lane: 'building',
      costsPerUnit: {
        resources: { metal: 300, mineral: 400 },
      },
    },
    fighter: {
      id: 'fighter',
      name: 'Fighter',
      tier: 1,
      durationTurns: 3,
      lane: 'ship',
      costsPerUnit: {
        resources: { metal: 200, mineral: 100 },
      },
    },
    soldier: {
      id: 'soldier',
      name: 'Soldier',
      tier: 1,
      durationTurns: 2,
      lane: 'colonist',
      costsPerUnit: {
        resources: { metal: 50, mineral: 50 },
      },
    },
  };

  const mockCurrentState = {
    stocks: {
      metal: 1000,
      mineral: 500,
    },
  };

  afterEach(() => {
    mockOnQueueItem.mockClear();
    mockCanQueueItem.mockClear();
  });

  describe('Layout and Structure', () => {
    it('should render with fixed width on large screens', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const panel = container.querySelector('.lg\\:w-\\[400px\\]');
      expect(panel).toBeInTheDocument();
    });

    it('should display tab header', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      expect(screen.getByText(/Structures/i)).toBeInTheDocument();
      expect(screen.getByText(/Ships/i)).toBeInTheDocument();
      expect(screen.getByText(/Colonists/i)).toBeInTheDocument();
    });

    it('should display footer hint', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      expect(screen.getByText(/Click item to queue/i)).toBeInTheDocument();
      expect(screen.getByText(/Hover for details/i)).toBeInTheDocument();
    });
  });

  describe('Tab Behavior', () => {
    it('should start with building tab active', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const buildingTab = screen.getByRole('tab', { name: /Structures/i });
      expect(buildingTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch tabs when clicked', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const shipTab = screen.getByRole('tab', { name: /Ships/i });
      fireEvent.click(shipTab);

      expect(shipTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should display correct items for each tab', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      // Building tab should show building items
      expect(screen.getByText('Metal Mine')).toBeInTheDocument();
      expect(screen.getByText('Mineral Extractor')).toBeInTheDocument();

      // Switch to ship tab
      const shipTab = screen.getByRole('tab', { name: /Ships/i });
      fireEvent.click(shipTab);

      expect(screen.getByText('Fighter')).toBeInTheDocument();
      expect(screen.queryByText('Metal Mine')).not.toBeInTheDocument();
    });
  });

  describe('Item Categorization', () => {
    it('should categorize items as available when allowed', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const availableCards = container.querySelectorAll('.border-green-500');
      expect(availableCards.length).toBeGreaterThan(0);
    });

    it('should categorize items as insufficient resources', () => {
      mockCanQueueItem.mockReturnValue({
        allowed: false,
        reason: 'Insufficient resources: need 100 more metal',
      });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const insufficientCards = container.querySelectorAll('.border-yellow-500');
      expect(insufficientCards.length).toBeGreaterThan(0);
    });

    it('should categorize items as locked', () => {
      mockCanQueueItem.mockReturnValue({
        allowed: false,
        reason: 'Missing prerequisite: Metal Refinery',
      });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const lockedCards = container.querySelectorAll('.border-gray-500');
      expect(lockedCards.length).toBeGreaterThan(0);
    });
  });

  describe('Grid Layout', () => {
    it('should use 2-column grid for structures', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const grid = container.querySelector('.grid-cols-2');
      expect(grid).toBeInTheDocument();
    });

    it('should use 2-column grid for ships', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const shipTab = screen.getByRole('tab', { name: /Ships/i });
      fireEvent.click(shipTab);

      const grid = container.querySelector('.grid-cols-2');
      expect(grid).toBeInTheDocument();
    });

    it('should use 1-column grid for colonists', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      const { container } = render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const colonistTab = screen.getByRole('tab', { name: /Colonists/i });
      fireEvent.click(colonistTab);

      const grid = container.querySelector('.grid-cols-1');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no items available', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={{}}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      expect(screen.getByText(/No items available/i)).toBeInTheDocument();
    });
  });

  describe('Item Counts', () => {
    it('should display correct item counts in tabs', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      // 2 building items
      expect(screen.getByText('2')).toBeInTheDocument();
      // 1 ship item
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Queueing Integration', () => {
    it('should call onQueueItem when available item is clicked', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      const metalMineCard = screen.getByRole('button', { name: /Queue Metal Mine/i });
      fireEvent.click(metalMineCard);

      expect(mockOnQueueItem).toHaveBeenCalledWith('metal_mine', 1);
    });

    it('should validate each item with canQueueItem', () => {
      mockCanQueueItem.mockReturnValue({ allowed: true });

      render(
        <ItemSelectionPanel
          availableItems={mockAvailableItems}
          currentState={mockCurrentState}
          onQueueItem={mockOnQueueItem}
          canQueueItem={mockCanQueueItem}
        />
      );

      // Should be called for each building item (2 items on initial building tab)
      expect(mockCanQueueItem).toHaveBeenCalledTimes(2);
      expect(mockCanQueueItem).toHaveBeenCalledWith('metal_mine', 1);
      expect(mockCanQueueItem).toHaveBeenCalledWith('mineral_extractor', 1);
    });
  });
});
