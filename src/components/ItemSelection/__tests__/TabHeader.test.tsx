/**
 * TabHeader Component Tests
 *
 * Ticket 25: Tab navigation component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabHeader } from '../TabHeader';

describe('TabHeader', () => {
  const mockOnTabChange = vi.fn();

  afterEach(() => {
    mockOnTabChange.mockClear();
  });

  describe('Display', () => {
    it('should render all three tabs', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByText(/Structures/i)).toBeInTheDocument();
      expect(screen.getByText(/Ships/i)).toBeInTheDocument();
      expect(screen.getByText(/Colonists/i)).toBeInTheDocument();
    });

    it('should show icons for each tab', () => {
      const { container } = render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      const text = container.textContent || '';
      expect(text).toContain('🏗️'); // Structures
      expect(text).toContain('🚀'); // Ships
      expect(text).toContain('👥'); // Colonists
    });

    it('should display item counts when provided', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
          counts={{ building: 15, ship: 8, colonist: 3 }}
        />
      );

      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should not display counts when zero', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
          counts={{ building: 0, ship: 5, colonist: 0 }}
        />
      );

      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('should highlight active tab', () => {
      const { container } = render(
        <TabHeader
          activeTab="ship"
          onTabChange={mockOnTabChange}
        />
      );

      const shipTab = screen.getByRole('tab', { name: /Ships/i });
      expect(shipTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should not highlight inactive tabs', () => {
      render(
        <TabHeader
          activeTab="ship"
          onTabChange={mockOnTabChange}
        />
      );

      const buildingTab = screen.getByRole('tab', { name: /Structures/i });
      const colonistTab = screen.getByRole('tab', { name: /Colonists/i });

      expect(buildingTab).toHaveAttribute('aria-selected', 'false');
      expect(colonistTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Click Behavior', () => {
    it('should call onTabChange when tab is clicked', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      const shipTab = screen.getByRole('tab', { name: /Ships/i });
      fireEvent.click(shipTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('ship');
    });

    it('should call onTabChange with correct lane id for each tab', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      fireEvent.click(screen.getByRole('tab', { name: /Structures/i }));
      expect(mockOnTabChange).toHaveBeenLastCalledWith('building');

      fireEvent.click(screen.getByRole('tab', { name: /Ships/i }));
      expect(mockOnTabChange).toHaveBeenLastCalledWith('ship');

      fireEvent.click(screen.getByRole('tab', { name: /Colonists/i }));
      expect(mockOnTabChange).toHaveBeenLastCalledWith('colonist');
    });

    it('should call onTabChange even when clicking active tab', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      const buildingTab = screen.getByRole('tab', { name: /Structures/i });
      fireEvent.click(buildingTab);

      expect(mockOnTabChange).toHaveBeenCalledWith('building');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('should have aria-controls attributes', () => {
      render(
        <TabHeader
          activeTab="building"
          onTabChange={mockOnTabChange}
        />
      );

      expect(screen.getByRole('tab', { name: /Structures/i }))
        .toHaveAttribute('aria-controls', 'building-panel');
      expect(screen.getByRole('tab', { name: /Ships/i }))
        .toHaveAttribute('aria-controls', 'ship-panel');
      expect(screen.getByRole('tab', { name: /Colonists/i }))
        .toHaveAttribute('aria-controls', 'colonist-panel');
    });
  });
});
