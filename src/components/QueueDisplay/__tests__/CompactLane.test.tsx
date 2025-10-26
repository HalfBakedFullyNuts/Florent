/**
 * CompactLane Component Tests
 *
 * Ticket 23: Compact lane display components
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompactLane } from '../CompactLane';
import type { LaneView, LaneEntry } from '../../../lib/game/selectors';

describe('CompactLane', () => {
  const mockOnCancel = vi.fn();

  const createMockLaneView = (entries: LaneEntry[] = []): LaneView => ({
    laneId: 'building',
    entries,
  });

  const createMockEntry = (id: string, itemName: string): LaneEntry => ({
    id,
    itemId: `item_${id}`,
    itemName,
    status: 'active',
    quantity: 1,
    turnsRemaining: 3,
    eta: 5,
  });

  afterEach(() => {
    mockOnCancel.mockClear();
  });

  describe('Layout', () => {
    it('should render with fixed 280px width', () => {
      const laneView = createMockLaneView();
      const { container } = render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      const laneContainer = container.querySelector('.w-\\[280px\\]');
      expect(laneContainer).toBeInTheDocument();
    });

    it('should display correct title for building lane', () => {
      const laneView = createMockLaneView();
      render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Structures')).toBeInTheDocument();
    });

    it('should display correct title for ship lane', () => {
      const laneView = createMockLaneView();
      render(
        <CompactLane
          laneId="ship"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Ships')).toBeInTheDocument();
    });

    it('should display correct title for colonist lane', () => {
      const laneView = createMockLaneView();
      render(
        <CompactLane
          laneId="colonist"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Colonists')).toBeInTheDocument();
    });

    it('should show entry count in header', () => {
      const entries = [
        createMockEntry('1', 'Metal Mine'),
        createMockEntry('2', 'Solar Generator'),
      ];
      const laneView = createMockLaneView(entries);
      render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show dash when queue is empty', () => {
      const laneView = createMockLaneView([]);
      render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show "Queue empty" message when no entries', () => {
      const laneView = createMockLaneView([]);
      render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Queue empty/i)).toBeInTheDocument();
    });
  });

  describe('Entries Display', () => {
    it('should render all entries', () => {
      const entries = [
        createMockEntry('1', 'Metal Mine'),
        createMockEntry('2', 'Solar Generator'),
        createMockEntry('3', 'Farm'),
      ];
      const laneView = createMockLaneView(entries);
      const { container } = render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      const allText = container.textContent || '';
      expect(allText).toContain('Metal Mine');
      expect(allText).toContain('Solar Generator');
      expect(allText).toContain('Farm');
    });

    it('should render entries in a scrollable container', () => {
      const entries = [
        createMockEntry('1', 'Metal Mine'),
        createMockEntry('2', 'Solar Generator'),
      ];
      const laneView = createMockLaneView(entries);
      const { container } = render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe('Footer Hints', () => {
    it('should show building-specific hint for building lane', () => {
      const laneView = createMockLaneView();
      render(
        <CompactLane
          laneId="building"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Hover to cancel/i)).toBeInTheDocument();
    });

    it('should show ship-specific hint for ship lane', () => {
      const laneView = createMockLaneView();
      render(
        <CompactLane
          laneId="ship"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Batch production/i)).toBeInTheDocument();
    });

    it('should show colonist-specific hint for colonist lane', () => {
      const laneView = createMockLaneView();
      render(
        <CompactLane
          laneId="colonist"
          laneView={laneView}
          currentTurn={1}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Requires housing/i)).toBeInTheDocument();
    });
  });
});
