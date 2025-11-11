/**
 * TICKET-5: Queue Export Formatters
 * Functions to format queue data for different export types
 */

import type { LaneView } from '../game/selectors';
import type { LaneId } from '../sim/engine/types';
import { abbreviateName } from './abbreviations';

export interface QueueItem {
  turn: number;
  lane: LaneId;
  name: string;
  quantity: number;
}

/**
 * Extract queue items from lane views, excluding completed items
 * Returns items sorted by completion turn
 *
 * @param laneViews - Array of lane views to extract from
 * @param maxTurn - Optional maximum turn to include (for "current view" export)
 */
export function extractQueueItems(laneViews: LaneView[], maxTurn?: number): QueueItem[] {
  const items: QueueItem[] = [];

  laneViews.forEach(laneView => {
    laneView.entries.forEach(entry => {
      // Use the appropriate turn value based on status
      let turn: number;
      if (entry.status === 'completed') {
        // Completed items: use their actual completion turn
        turn = entry.completionTurn ?? 0;
      } else if (entry.status === 'active') {
        // Active items: use eta (calculated completion time)
        turn = entry.eta || 0;
      } else if (entry.status === 'pending') {
        // Pending items: prefer completionTurn, fall back to eta
        turn = entry.completionTurn ?? entry.eta ?? 0;
      } else {
        // Fallback for any other status
        turn = entry.completionTurn ?? entry.eta ?? 0;
      }

      // Skip items with turn 0 (invalid data)
      if (turn === 0) {
        console.warn(`Queue item ${entry.itemName} has no valid completion turn`);
        return;
      }

      // Skip items beyond maxTurn if specified (for "current view" export)
      if (maxTurn !== undefined && turn > maxTurn) {
        return;
      }

      items.push({
        turn,
        lane: laneView.laneId,
        name: entry.itemName,
        quantity: entry.quantity,
      });
    });
  });

  // Sort by turn
  return items.sort((a, b) => a.turn - b.turn);
}

/**
 * Format queue as plain text list
 * Format: "[Turn Number] - [Building]/[Ships]/[Colonists]"
 *
 * Example:
 * [6] - Farm
 * [9] - 5x Fighter
 * [16] - Metal Mine
 *
 * @param laneViews - Array of lane views to format
 * @param maxTurn - Optional maximum turn to include (for "current view" export)
 */
export function formatAsText(laneViews: LaneView[], maxTurn?: number): string {
  const items = extractQueueItems(laneViews, maxTurn);

  if (items.length === 0) {
    return '';
  }

  return items.map(item => {
    // Abbreviate building names to save space
    const abbreviatedName = abbreviateName(item.name);

    // Buildings show name only, ships/colonists show quantity
    const itemText = item.lane === 'building'
      ? abbreviatedName
      : `${item.quantity}x ${abbreviatedName}`;

    return `[${item.turn}] - ${itemText}`;
  }).join('\n');
}

/**
 * Format queue as Discord table with character limit check
 * Format: Markdown table with code block
 *
 * Discord has an 8,192 character limit per message
 * If exceeded, prepends warning message
 *
 * @param laneViews - Array of lane views to format
 * @param maxTurn - Optional maximum turn to include (for "current view" export)
 */
export function formatAsDiscord(laneViews: LaneView[], maxTurn?: number): string {
  const items = extractQueueItems(laneViews, maxTurn);

  const DISCORD_LIMIT = 8192;
  const WARNING = 'Buildlist exceeds character limit on Discord\n\n';

  // Group items by turn
  const turnGroups = new Map<number, QueueItem[]>();
  items.forEach(item => {
    if (!turnGroups.has(item.turn)) {
      turnGroups.set(item.turn, []);
    }
    turnGroups.get(item.turn)!.push(item);
  });

  // Build table
  let table = '```\n';
  table += '| Turn | Structure       | Ship            | Colonist        |\n';
  table += '|------|-----------------|-----------------|-----------------|';

  let exceedsLimit = false;

  // Sort by turn and add rows
  Array.from(turnGroups.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([turn, turnItems]) => {
      const structure = turnItems.find(i => i.lane === 'building');
      const ship = turnItems.find(i => i.lane === 'ship');
      const colonist = turnItems.find(i => i.lane === 'colonist');

      // Abbreviate names to save space
      const structureText = structure ? abbreviateName(structure.name) : '';
      const shipText = ship ? `${ship.quantity}x ${abbreviateName(ship.name)}` : '';
      const colonistText = colonist ? `${colonist.quantity}x ${abbreviateName(colonist.name)}` : '';

      const row = `\n| ${String(turn).padEnd(4)} | ${
        structureText.padEnd(15)
      } | ${
        shipText.padEnd(15)
      } | ${
        colonistText.padEnd(15)
      } |`;

      // Check if adding this row would exceed the limit (account for closing ```)
      if (table.length + row.length + 4 > DISCORD_LIMIT) {
        exceedsLimit = true;
      }

      table += row;
    });

  table += '\n```';

  return exceedsLimit ? WARNING + table : table;
}

/**
 * Copy text to clipboard
 * Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
