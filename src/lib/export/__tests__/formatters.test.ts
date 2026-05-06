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
  formatAsBuildDataJson,
  formatMultiPlanetAsBuildDataJson,
  formatMultiPlanetAsText,
  formatMultiPlanetAsDiscordMessages,
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
          startTurn: 1,
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
          startTurn: 6,
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
          startTurn: 2,
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
          startTurn: 6,
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
          startTurn: 1,
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
          startTurn: 7,
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
          startTurn: 2,
        },
      ],
    },
  ];

  describe('extractQueueItems', () => {
    it('should extract all non-completed items', () => {
      const items = extractQueueItems(mockLaneViews);
      expect(items).toHaveLength(4);
      expect(items[0].itemId).toBe('farm');
    });

    it('should sort items by queue/start turn', () => {
      const items = extractQueueItems(mockLaneViews);
      expect(items[0].turn).toBe(1); // Farm starts at T1, completes at T6
      expect(items[1].turn).toBe(2); // Fighter starts at T2, completes at T9
      expect(items[2].turn).toBe(6); // Metal Mine starts at T6, completes at T16
      expect(items[3].turn).toBe(6); // Soldier starts at T6, completes at T16
    });

    it('should filter items by maxTurn (current view export)', () => {
      const items = extractQueueItems(mockLaneViews, 2);
      expect(items).toHaveLength(2);
      expect(items[0].turn).toBe(1); // Farm queue action at T1
      expect(items[1].turn).toBe(2); // Fighter queue action at T2
      // Metal Mine and Soldier at T6 should be excluded
    });

    it('should include items at exactly maxTurn', () => {
      const items = extractQueueItems(mockLaneViews, 6);
      expect(items).toHaveLength(4); // All items
    });

    it('should return empty array when maxTurn is before all items', () => {
      const items = extractQueueItems(mockLaneViews, 0);
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
              startTurn: 1,
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
              startTurn: 6,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithCompleted);
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Farm');
      expect(items[0].turn).toBe(1);
      expect(items[1].name).toBe('Metal Mine');
      expect(items[1].turn).toBe(6);
    });

    // TICKET-6: Tests for active items bug fix
    it('should export active items using queue/start turn instead of eta', () => {
      const items = extractQueueItems(mockLaneViewsWithActive);
      expect(items).toHaveLength(3);
      // Items should be sorted by turn
      // Active farm starts at T1 even though it completes at T4.
      expect(items[0].turn).toBe(1);
      expect(items[0].name).toBe('Farm');
      // Active fighter starts at T2 even though it completes at T3.
      expect(items[1].turn).toBe(2);
      expect(items[1].name).toBe('Fighter');
      // Pending metal mine starts at T7 even though it completes at T14.
      expect(items[2].turn).toBe(7);
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
              startTurn: 1,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithInvalidData);
      // Should skip the invalid item and only return the valid farm
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Farm');
    });

    it('should handle active items with startTurn but no completionTurn', () => {
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
              startTurn: 2,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithActiveOnly);
      expect(items).toHaveLength(1);
      expect(items[0].turn).toBe(2); // Should use startTurn, not eta/completion
      expect(items[0].name).toBe('Farm');
    });

    it('falls back to queuedTurn when startTurn is unavailable', () => {
      const lanesWithLegacyEntry: LaneView[] = [
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
              queuedTurn: 3,
            },
          ],
        },
      ];

      const items = extractQueueItems(lanesWithLegacyEntry);
      expect(items).toHaveLength(1);
      expect(items[0].turn).toBe(3);
    });
  });

  describe('formatAsText', () => {
    it('should format items as plain text list', () => {
      const text = formatAsText(mockLaneViews);
      const lines = text.split('\n');

      expect(lines[0]).toBe('[1] - Farm');
      expect(lines[1]).toBe('[2] - 5x Fighter');
      expect(lines[2]).toBe('[6] - Metal'); // Abbreviated from "Metal Mine"
      expect(lines[3]).toBe('[6] - 100x Soldier');
    });

    it('should format items with maxTurn filter (current view)', () => {
      const text = formatAsText(mockLaneViews, 2);
      const lines = text.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('[1] - Farm');
      expect(lines[1]).toBe('[2] - 5x Fighter');
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
              startTurn: 4,
            },
          ],
        },
      ];

      const text = formatAsText(lanesWithResearch);
      expect(text).toContain('[4] - Planet Management');
      expect(text).not.toContain('[4] - 1x Planet Management');
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
      expect(discord).toContain('| Start | Structure');
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
      const discord = formatAsDiscord(mockLaneViews, 2);

      expect(discord).toContain('Farm');
      expect(discord).toContain('Fighter');
      expect(discord).not.toContain('Metal'); // "Metal Mine" starts beyond T2
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
            queuedTurn: i + 1,
            startTurn: i + 1,
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
      expect(discord).toContain('| Start |');
    });

    it('should group items by turn', () => {
      const discord = formatAsDiscord(mockLaneViews);

      // T6 has both Metal Mine and Soldier, should be in same row
      const lines = discord.split('\n');
      const t6Line = lines.find(line => line.includes('| 6'));

      expect(t6Line).toBeDefined();
      if (t6Line) {
        expect(t6Line).toContain('Metal');
        expect(t6Line).toContain('Soldier');
      }
    });

    // TICKET-6: Test Discord export with active items produces non-empty output
    it('should produce non-empty Discord output with active items', () => {
      const discord = formatAsDiscord(mockLaneViewsWithActive);

      // Should contain table structure
      expect(discord).toContain('```');
      expect(discord).toContain('| Start | Structure');
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
        !line.includes('Start |') &&
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
              startTurn: 4,
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

  describe('formatAsBuildDataJson', () => {
    it('exports item ids, lanes, turns, and quantities without save/share metadata', () => {
      const json = formatAsBuildDataJson(mockLaneViews, undefined, {
        scope: 'full',
        currentTurn: 1,
      });
      const parsed = JSON.parse(json);

      expect(parsed).toEqual({
        format: 'florent-build-list',
        version: 1,
        scope: 'full',
        currentTurn: 1,
        items: [
          { turn: 1, lane: 'building', itemId: 'farm', name: 'Farm', quantity: 1 },
          { turn: 2, lane: 'ship', itemId: 'fighter', name: 'Fighter', quantity: 5 },
          { turn: 6, lane: 'building', itemId: 'metal_mine', name: 'Metal Mine', quantity: 1 },
          { turn: 6, lane: 'colonist', itemId: 'soldier', name: 'Soldier', quantity: 100 },
        ],
      });
      expect(json).not.toContain('encoded');
      expect(json).not.toContain('share');
      expect(json).not.toContain('author');
    });

    it('filters current-scope JSON by max turn and includes manual waits', () => {
      const lanesWithWait: LaneView[] = [
        ...mockLaneViews,
        {
          laneId: 'building',
          entries: [
            {
              id: 'wait-1',
              itemId: '__wait__',
              itemName: 'Wait',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 2,
              eta: 8,
              completionTurn: 8,
              queuedTurn: 1,
              isWait: true,
            },
          ],
        },
      ];

      const parsed = JSON.parse(formatAsBuildDataJson(lanesWithWait, 2, { scope: 'current' }));

      expect(parsed.scope).toBe('current');
      expect(parsed.items.map((item: { itemId: string }) => item.itemId)).toEqual(['farm', '__wait__', 'fighter']);
      expect(parsed.items[1]).toMatchObject({
        itemId: '__wait__',
        isWait: true,
        waitTurns: 2,
      });
    });

    it('exports original wait durations for active and completed waits', () => {
      const lanesWithWaits: LaneView[] = [
        {
          laneId: 'building',
          entries: [
            {
              id: 'active-wait',
              itemId: '__wait__',
              itemName: 'Wait',
              quantity: 1,
              status: 'active',
              turnsRemaining: 2,
              queuedTurn: 4,
              startTurn: 4,
              eta: 9,
              isWait: true,
            },
            {
              id: 'single-turn-wait',
              itemId: '__wait__',
              itemName: 'Wait',
              quantity: 1,
              status: 'completed',
              turnsRemaining: 0,
              queuedTurn: 12,
              startTurn: 12,
              completionTurn: 12,
              eta: null,
              isWait: true,
            },
          ],
        },
      ];

      const parsed = JSON.parse(formatAsBuildDataJson(lanesWithWaits, undefined, {
        scope: 'full',
        currentTurn: 7,
      }));

      expect(parsed.items).toEqual([
        {
          turn: 4,
          lane: 'building',
          itemId: '__wait__',
          name: 'Wait',
          quantity: 1,
          isWait: true,
          waitTurns: 5,
        },
        {
          turn: 12,
          lane: 'building',
          itemId: '__wait__',
          name: 'Wait',
          quantity: 1,
          isWait: true,
          waitTurns: 1,
        },
      ]);
    });

    it('exports multi-planet JSON with global research separated', () => {
      const json = formatMultiPlanetAsBuildDataJson({
        planets: [
          {
            id: 'planet-1',
            name: 'Homeworld',
            startTurn: 1,
            currentTurn: 1,
            lanes: [mockLaneViews[0], mockLaneViews[1], mockLaneViews[2]],
          },
          {
            id: 'planet-2',
            name: 'Mars',
            startTurn: 24,
            currentTurn: 24,
            lanes: [
              {
                laneId: 'building',
                entries: [
                  {
                    id: 'mars-farm',
                    itemId: 'farm',
                    itemName: 'Farm',
                    quantity: 1,
                    status: 'pending',
                    turnsRemaining: 4,
                    eta: 28,
                    queuedTurn: 24,
                    startTurn: 24,
                    completionTurn: 28,
                  },
                ],
              },
              { laneId: 'ship', entries: [] },
              { laneId: 'colonist', entries: [] },
            ],
          },
        ],
        researchLane: {
          laneId: 'research',
          entries: [
            {
              id: 'research-1',
              itemId: 'planet_management',
              itemName: 'Planet Management',
              quantity: 1,
              status: 'pending',
              turnsRemaining: 10,
              eta: 12,
              queuedTurn: 1,
              startTurn: 2,
              completionTurn: 12,
            },
          ],
        },
      }, undefined, { scope: 'full', currentTurn: 1 });
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(2);
      expect(parsed.planets).toHaveLength(2);
      expect(parsed.planets[1]).toMatchObject({
        id: 'planet-2',
        name: 'Mars',
        startTurn: 24,
        items: [
          { turn: 24, lane: 'building', itemId: 'farm', name: 'Farm', quantity: 1 },
        ],
      });
      expect(parsed.research[0]).toMatchObject({
        lane: 'research',
        itemId: 'planet_management',
      });
    });

    it('exports multi-planet text and Discord sections', () => {
      const data = {
        planets: [
          {
            id: 'planet-1',
            name: 'Homeworld',
            startTurn: 1,
            lanes: [mockLaneViews[0], mockLaneViews[1], mockLaneViews[2]],
          },
          {
            id: 'planet-2',
            name: 'Mars',
            startTurn: 24,
            lanes: [
              { laneId: 'building' as const, entries: [] },
              { laneId: 'ship' as const, entries: [] },
              { laneId: 'colonist' as const, entries: [] },
            ],
          },
        ],
        researchLane: mockLaneViews[3],
      };

      const text = formatMultiPlanetAsText(data);
      const discord = formatMultiPlanetAsDiscordMessages(data).join('\n');

      expect(text).toContain('--- Homeworld');
      expect(text).toContain('--- Mars');
      expect(text).toContain('--- Global Research ---');
      expect(discord).toContain('Homeworld');
      expect(discord).toContain('Global Research');
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
