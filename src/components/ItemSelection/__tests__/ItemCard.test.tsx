/**
 * ItemCard Component Tests
 *
 * Ticket 25: Item selection card component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemCard } from '../ItemCard';

describe('ItemCard', () => {
  const mockOnQueueItem = vi.fn();

  const mockItemDef = {
    id: 'metal_mine',
    name: 'Metal Mine',
    tier: 1,
    durationTurns: 5,
    lane: 'building',
    costsPerUnit: {
      resources: {
        metal: 500,
        mineral: 200,
      },
    },
  };

  const mockCurrentState = {
    stocks: {
      metal: 1000,
      mineral: 300,
    },
  };

  afterEach(() => {
    mockOnQueueItem.mockClear();
  });

  describe('Display', () => {
    it('should render item name', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      expect(screen.getByText('Metal Mine')).toBeInTheDocument();
    });

    it('should display tier and duration', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const text = container.textContent || '';
      expect(text).toContain('T1');
      expect(text).toContain('5 turns');
    });

    it('should show "turn" for duration of 1', () => {
      const itemDef = { ...mockItemDef, durationTurns: 1 };
      const { container } = render(
        <ItemCard
          itemId="quick_item"
          itemDef={itemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const text = container.textContent || '';
      expect(text).toMatch(/1 turn/);
    });
  });

  describe('Status Icons', () => {
    it('should show ✅ for available items', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      expect(container.textContent).toContain('✅');
    });

    it('should show ⏸️ for queueable with wait items', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={true}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      expect(container.textContent).toContain('⏸️');
    });

    it('should show 🔒 for locked items', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={false}
          locked={true}
          onQueueItem={mockOnQueueItem}
        />
      );

      expect(container.textContent).toContain('🔒');
    });
  });

  describe('Visual States', () => {
    it('should have green border for available items', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = container.querySelector('.border-green-500');
      expect(card).toBeInTheDocument();
    });

    it('should have blue border for queueable with wait items', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={true}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = container.querySelector('.border-blue-500');
      expect(card).toBeInTheDocument();
    });

    it('should have gray border for locked items', () => {
      const { container } = render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={false}
          locked={true}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = container.querySelector('.border-gray-500');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Click Behavior', () => {
    it('should call onQueueItem when available item is clicked', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button', { name: /Queue Metal Mine/i });
      fireEvent.click(card);

      expect(mockOnQueueItem).toHaveBeenCalledWith('metal_mine', 1);
    });

    it('should not call onQueueItem when locked item is clicked', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={false}
          locked={true}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button', { name: /View Metal Mine/i });
      fireEvent.click(card);

      expect(mockOnQueueItem).not.toHaveBeenCalled();
    });

    it('should call onQueueItem when queueableWithWait item is clicked (triggers modal)', () => {
      // In the new implementation, queueableWithWait items ARE clickable
      // They trigger onQueueItem which then shows a confirmation modal
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={true}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(mockOnQueueItem).toHaveBeenCalledWith('metal_mine', 1);
    });
  });

  describe('Keyboard Support', () => {
    it('should be focusable when available', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should not be focusable when locked', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={false}
          queueableWithWait={false}
          locked={true}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '-1');
    });

    it('should queue on Enter key when available', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(mockOnQueueItem).toHaveBeenCalledWith('metal_mine', 1);
    });

    it('should queue on Space key when available', () => {
      render(
        <ItemCard
          itemId="metal_mine"
          itemDef={mockItemDef}
          available={true}
          queueableWithWait={false}
          locked={false}
          onQueueItem={mockOnQueueItem}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: ' ' });

      expect(mockOnQueueItem).toHaveBeenCalledWith('metal_mine', 1);
    });
  });
});
