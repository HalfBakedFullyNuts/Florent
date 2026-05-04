/**
 * TICKET-5: Export Functionality Tests
 * Test export format generation for text and Discord formats
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DISCORD_MESSAGE_LIMIT,
  formatAsText,
  formatAsDiscord,
  formatAsDiscordMessages,
  extractQueueItems,
  copyToClipboard,
} from '../formatters';
import type { LaneView } from '../../game/selectors';

describe('Export Formatters (TICKET-5)', () => {
  const mockLaneViews: LaneView[] = [
    {
      laneId: 'building',
      entries: [
        {
          id: '1',
          itemId: 'farm',
          itemName: 'Farm',
          quantity: 1,
          status: 'pending',
          turnsRemaining: 5,
          eta: 6,
          completionTurn: 6,
          queuedTurn: 1,
        },
        {
          id: '2',
          itemId: 'metal_mine',
          itemName: 'Metal Mine',
          quantity: 1,
          status: 'pending',
          turnsRemaining: 10,
          eta: 16,
          completionTurn: 16,
          queuedTurn: 1,
        },
      ],
    },
    {
      laneId: 'ship',
      entries: [
        {
          id: '3',
          itemId: 'fighter',
          itemName: 'Fighter',
          quantity: 5,
          status: 'pending',
          turnsRemaining: 8,
          eta: 9,
          completionTurn: 9,
          queuedTurn: 1,
        },
      ],
    },
    {
      laneId: 'colonist',
      entries: [
        {
          id: '4',
          itemId: 'soldier',
          itemName: 'Soldier',
          quantity: 100,
          status: 'pending',
          turnsRemaining: 15,
          eta: 16,
          completionTurn: 16,
          queuedTurn: 1,
        },
      ],
    },
  ];

  // TICKET-6: Test data with active items (the bug scenario)
  const mockLaneViewsWithActive: LaneView[] = [
    {
      laneId: 'building',
      entries: [
        {
          id: '1',
          itemId: 'farm',
          itemName: 'Farm',
          quantity: 1,
          status: 'active',
          turnsRemaining: 3,
          eta: 4,
          completionTurn: undefined, // Not completed yet
          queuedTurn: 1,
        },
        {
          id: '2',
          itemId: 'metal_mine',
          itemName: 'Metal Mine',
          quantity: 1,
          status: 'pending',
          turnsRemaining: 10,
          eta: 14,
          completionTurn: 14,
          queuedTurn: 1,
        },
      ],
    },
    {
      laneId: 'ship',
      entries: [
        {
          id: '3',
          itemId: 'fighter',
          itemName: 'Fighter',
          quantity: 5,
          status: 'active',
          turnsRemaining: 2,
          eta: 3,
          completionTurn: undefined, // Not completed yet
          queuedTurn: 1,
        },
      ],
    },
  ];

  describe('extractQueueItems', () => {
    it('should extract all non-completed items', () => {
      const items = extractQueueItems(mockLaneViews);
      expect(items).toHaveLength(4);
    });

    it('should sort items by turn', () => {
      const items = extractQueueItems(mockLaneViews);
      expect(items[0].turn).toBe(6); // Farm at T6
      expect(items[1].turn).toBe(9); // Fighter at T9
      expect(items[2].turn).toBe(16); // Metal Mine at T16
      expect(items[3].turn).toBe(16); // Soldier at T16
    });

    it('should filter items by maxTurn (current view export)', () => {
      const items = extractQueueItems(mockLaneViews, 9);
      expect(items).toHaveLength(2);
      expect(items[0].turn).toBe(6); // Farm at T6
      expect(items[1].turn).toBe(9); // Fighter at T9
      // Metal Mine and Soldier at T16 should be excluded
    });

    it('should include items at exactly maxTurn', () => {
      const items = extractQueueItems(mockLaneViews, 16);
      expect(items).toHaveLength(4); // All items
    });

    it('should return empty array when maxTurn is before all items', () => {
      const items = extractQueueItems(mockLaneViews, 5);
      expect(items).toHaveLength(0);
    });

    it('should include completed items in export', () => {
      const lanesWithCompleted: LaneView[] = [
        {
          laneId: 'building',
          entries: [
            {
              id: '1',
              itemId: 'farm',
              itemName: 'Farm',
              quantity: 1,
              status: 'completed',
              turnsRemaining: 0,
              eta: null,
              completionTurn: 5,
              queuedTurn: 1,
            },
            {
              id: '2',
              itemId: 'metal_mine',
              itemName: 'Metal Mine',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 10,
              eta: 15,
              completionTurn: 15,
              queuedTurn: 1,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithCompleted);
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Farm');
      expect(items[0].turn).toBe(5);
      expect(items[1].name).toBe('Metal Mine');
      expect(items[1].turn).toBe(15);
    });

    // TICKET-6: Tests for active items bug fix
    it('should export active items correctly using eta', () => {
      const items = extractQueueItems(mockLaneViewsWithActive);
      expect(items).toHaveLength(3);
      // Items should be sorted by turn
      // Active fighter at T3 (first)
      expect(items[0].turn).toBe(3);
      expect(items[0].name).toBe('Fighter');
      // Active farm at T4 (second)
      expect(items[1].turn).toBe(4);
      expect(items[1].name).toBe('Farm');
      // Pending metal mine at T14 (third)
      expect(items[2].turn).toBe(14);
      expect(items[2].name).toBe('Metal Mine');
    });

    it('should handle mixed active and pending items', () => {
      const items = extractQueueItems(mockLaneViewsWithActive);
      const activeItems = items.filter((_, idx) => idx < 2); // First 2 are active
      const pendingItems = items.filter((_, idx) => idx >= 2); // Last is pending

      expect(activeItems.length).toBe(2);
      expect(pendingItems.length).toBe(1);

      // All items should have valid turn numbers
      items.forEach(item => {
        expect(item.turn).toBeGreaterThan(0);
      });
    });

    it('should skip items with invalid turn data', () => {
      const lanesWithInvalidData: LaneView[] = [
        {
          laneId: 'building',
          entries: [
            {
              id: '1',
              itemId: 'unknown',
              itemName: 'Unknown Building',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 0,
              eta: null,
              completionTurn: undefined,
              queuedTurn: 1,
            },
            {
              id: '2',
              itemId: 'farm',
              itemName: 'Farm',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 5,
              eta: 6,
              completionTurn: 6,
              queuedTurn: 1,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithInvalidData);
      // Should skip the invalid item and only return the valid farm
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Farm');
    });

    it('should handle active items with eta but no completionTurn', () => {
      const lanesWithActiveOnly: LaneView[] = [
        {
          laneId: 'building',
          entries: [
            {
              id: '1',
              itemId: 'farm',
              itemName: 'Farm',
              quantity: 1,
              status: 'active',
              turnsRemaining: 5,
              eta: 6,
              completionTurn: undefined, // This was causing the bug
              queuedTurn: 1,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithActiveOnly);
      expect(items).toHaveLength(1);
      expect(items[0].turn).toBe(6); // Should use eta, not undefined
      expect(items[0].name).toBe('Farm');
    });
  });

  describe('formatAsText', () => {
    it('should format items as plain text list', () => {
      const text = formatAsText(mockLaneViews);
      const lines = text.split('\n');

      expect(lines[0]).toBe('[6] - Farm');
      expect(lines[1]).toBe('[9] - 5x Fighter');
      expect(lines[2]).toBe('[16] - Metal'); // Abbreviated from "Metal Mine"
      expect(lines[3]).toBe('[16] - 100x Soldier');
    });

    it('should format items with maxTurn filter (current view)', () => {
      const text = formatAsText(mockLaneViews, 9);
      const lines = text.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('[6] - Farm');
      expect(lines[1]).toBe('[9] - 5x Fighter');
    });

    it('should include research without quantity', () => {
      const lanesWithResearch: LaneView[] = [
        ...mockLaneViews,
        {
          laneId: 'research',
          entries: [
            {
              id: 'research-1',
              itemId: 'planet_management',
              itemName: 'Planet Management',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 5,
              eta: 12,
              completionTurn: 12,
              queuedTurn: 1,
            },
          ],
        },
      ];

      const text = formatAsText(lanesWithResearch);
      expect(text).toContain('[12] - Planet Management');
      expect(text).not.toContain('[12] - 1x Planet Management');
    });

    it('should handle empty queue', () => {
      const emptyLanes: LaneView[] = [
        { laneId: 'building', entries: [] },
        { laneId: 'ship', entries: [] },
        { laneId: 'colonist', entries: [] },
      ];

      const text = formatAsText(emptyLanes);
      expect(text).toBe('');
    });
  });

  describe('formatAsDiscord', () => {
    it('should format as Discord table', () => {
      const discord = formatAsDiscord(mockLaneViews);

      // Should have code block markers
      expect(discord.startsWith('```')).toBe(true);
      expect(discord.endsWith('```')).toBe(true);

      // Should have table header
      expect(discord).toContain('| Turn | Structure');
      expect(discord).toContain('| Ship');
      expect(discord).toContain('| Colonist');
      expect(discord).toContain('| Research');

      // Should contain the data (with abbreviations)
      expect(discord).toContain('Farm');
      expect(discord).toContain('Fighter');
      expect(discord).toContain('Metal'); // "Metal Mine" → "Metal"
      expect(discord).toContain('Soldier');
    });

    it('should format with maxTurn filter (current view)', () => {
      const discord = formatAsDiscord(mockLaneViews, 9);

      expect(discord).toContain('Farm');
      expect(discord).toContain('Fighter');
      expect(discord).not.toContain('Metal'); // "Metal Mine" is beyond T9
      expect(discord).not.toContain('Soldier');
    });

    it('should split long Discord exports into 2000-character messages', () => {
      // Create a very long queue that will exceed the normal Discord limit.
      const longEntries: LaneView[] = [
        {
          laneId: 'building',
          entries: Array.from({ length: 200 }, (_, i) => ({
            id: `${i}`,
            itemId: 'farm',
            itemName: 'Farm with a very long name that takes up space',
            quantity: 1,
            status: 'pending' as const,
            turnsRemaining: 5,
            eta: i + 10,
            completionTurn: i + 10,
            queuedTurn: 1,
          })),
        },
      ];

      const messages = formatAsDiscordMessages(longEntries);
      expect(messages.length).toBeGreaterThan(1);
      messages.forEach(message => {
        expect(message.length).toBeLessThanOrEqual(DISCORD_MESSAGE_LIMIT);
        expect(message.startsWith('```')).toBe(true);
        expect(message.endsWith('```')).toBe(true);
      });
    });

    it('should handle empty queue', () => {
      const emptyLanes: LaneView[] = [
        { laneId: 'building', entries: [] },
        { laneId: 'ship', entries: [] },
        { laneId: 'colonist', entries: [] },
      ];

      const discord = formatAsDiscord(emptyLanes);
      expect(discord).toContain('```');
      expect(discord).toContain('| Turn |');
    });

    it('should group items by turn', () => {
      const discord = formatAsDiscord(mockLaneViews);

      // T16 has both Metal Mine and Soldier, should be in same row
      const lines = discord.split('\n');
      const t16Line = lines.find(line => line.includes('| 16'));

      expect(t16Line).toBeDefined();
      if (t16Line) {
        expect(t16Line).toContain('Metal'); // "Metal Mine" → "Metal"
        expect(t16Line).toContain('Soldier');
      }
    });

    // TICKET-6: Test Discord export with active items produces non-empty output
    it('should produce non-empty Discord output with active items', () => {
      const discord = formatAsDiscord(mockLaneViewsWithActive);

      // Should contain table structure
      expect(discord).toContain('```');
      expect(discord).toContain('| Turn | Structure');
      expect(discord).toContain('| Ship');
      expect(discord).toContain('| Colonist');
      expect(discord).toContain('| Research');

      // Should contain actual data rows (not just headers, with abbreviations)
      expect(discord).toContain('Farm');
      expect(discord).toContain('Fighter');
      expect(discord).toContain('Metal'); // "Metal Mine" → "Metal"

      // Should have data rows with turn numbers
      const lines = discord.split('\n');
      const dataRows = lines.filter(line =>
        line.includes('|') &&
        !line.includes('Turn |') &&
        !line.includes('---')
      );
      expect(dataRows.length).toBeGreaterThan(0);
    });

    it('should include research in Discord export', () => {
      const lanesWithResearch: LaneView[] = [
        {
          laneId: 'research',
          entries: [
            {
              id: 'research-1',
              itemId: 'planet_management',
              itemName: 'Planet Management',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 5,
              eta: 12,
              completionTurn: 12,
              queuedTurn: 1,
            },
          ],
        },
      ];

      const discord = formatAsDiscord(lanesWithResearch);

      expect(discord).toContain('| Research');
      expect(discord).toContain('Planet Manageme');
      expect(discord).not.toContain('1x Planet');
    });
  });

  describe('copyToClipboard', () => {
    it('falls back to a textarea copy when the Clipboard API is unavailable', async () => {
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      });
      const execCommand = vi.fn().mockReturnValue(true);
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: execCommand,
      });

      await expect(copyToClipboard('hello discord')).resolves.toBe(true);
      expect(execCommand).toHaveBeenCalledWith('copy');
    });
  });
});
