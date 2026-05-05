/**
 * TICKET-5: Queue Export Formatters
 * Functions to format queue data for different export types
 */

import type { LaneView } from '../game/selectors';
import type { LaneId } from '../sim/engine/types';
import { abbreviateName } from './abbreviations';

export const DISCORD_MESSAGE_LIMIT = 2000;

export interface QueueItem {
  /** Turn when the player should queue/start this item. */
  turn: number;
  lane: LaneId;
  itemId: string;
  name: string;
  quantity: number;
  isWait?: boolean;
  waitTurns?: number;
}

export interface BuildDataJsonItem {
  turn: number;
  lane: LaneId;
  itemId: string;
  name: string;
  quantity: number;
  isWait?: true;
  waitTurns?: number;
}

export interface BuildDataJson {
  format: 'florent-build-list';
  version: 1;
  scope: 'current' | 'full';
  currentTurn?: number;
  items: BuildDataJsonItem[];
}

export interface MultiPlanetExportPlanet {
  id: string;
  name: string;
  startTurn: number;
  currentTurn?: number;
  lanes: LaneView[];
}

export interface MultiPlanetExportData {
  planets: MultiPlanetExportPlanet[];
  researchLane?: LaneView;
}

export interface MultiPlanetBuildDataJson {
  format: 'florent-build-list';
  version: 2;
  scope: 'current' | 'full';
  currentTurn?: number;
  planets: Array<{
    id: string;
    name: string;
    startTurn: number;
    currentTurn?: number;
    items: BuildDataJsonItem[];
  }>;
  research: BuildDataJsonItem[];
}

/**
 * Extract queue items from lane views.
 * Returns items sorted by the turn when the player should queue/start them.
 *
 * @param laneViews - Array of lane views to extract from
 * @param maxTurn - Optional maximum queue/start turn to include (for "current view" export)
 */
export function extractQueueItems(laneViews: LaneView[], maxTurn?: number): QueueItem[] {
  const items: QueueItem[] = [];

  laneViews.forEach(laneView => {
    laneView.entries.forEach(entry => {
      const turn = getQueueActionTurn(entry);

      // Skip items with no usable queue/start turn.
      if (turn === 0) {
        console.warn(`Queue item ${entry.itemName} has no valid queue turn`);
        return;
      }

      // Skip queue actions beyond maxTurn if specified (for "current view" export)
      if (maxTurn !== undefined && turn > maxTurn) {
        return;
      }

      items.push({
        turn,
        lane: laneView.laneId,
        itemId: entry.itemId,
        name: entry.itemName,
        quantity: entry.quantity,
        isWait: entry.isWait,
        waitTurns: entry.isWait ? getWaitTurns(entry) : undefined,
      });
    });
  });

  // Sort by queue/start turn.
  return items.sort((a, b) => a.turn - b.turn);
}

function getQueueActionTurn(entry: LaneView['entries'][number]): number {
  return entry.startTurn ?? entry.queuedTurn ?? 0;
}

function getWaitTurns(entry: LaneView['entries'][number]): number | undefined {
  if (!entry.isWait) return undefined;
  if (entry.turnsRemaining > 0) return entry.turnsRemaining;

  const start = entry.startTurn ?? entry.queuedTurn;
  const end = entry.completionTurn ?? entry.eta ?? undefined;
  if (start !== undefined && end !== undefined && end > start) {
    return end - start;
  }

  return undefined;
}

/**
 * Format queue as plain text list
 * Format: "[Queue Turn] - [Building]/[Ships]/[Colonists]"
 *
 * Example:
 * [1] - Farm
 * [6] - Metal Mine
 * [12] - 5x Fighter
 *
 * @param laneViews - Array of lane views to format
 * @param maxTurn - Optional maximum queue/start turn to include (for "current view" export)
 */
export function formatAsText(laneViews: LaneView[], maxTurn?: number): string {
  const items = extractQueueItems(laneViews, maxTurn);

  if (items.length === 0) {
    return '';
  }

  return items.map(item => {
    // Abbreviate building names to save space
    const abbreviatedName = abbreviateName(item.name);

    const itemText = formatQueueItemLabel(item, abbreviatedName);

    return `[${item.turn}] - ${itemText}`;
  }).join('\n');
}

function formatQueueItemLabel(item: QueueItem, displayName: string = item.name): string {
  if (item.isWait || item.itemId === '__wait__') {
    return `Wait ${item.waitTurns ?? '?'}T`;
  }

  // Structures and research are unique queue items; ships/colonists carry quantities.
  return item.lane === 'building' || item.lane === 'research'
    ? displayName
    : `${item.quantity}x ${displayName}`;
}

/**
 * Format queue as a portable build-data JSON payload for game import.
 *
 * This intentionally avoids Florent save/share metadata, encoded replay state,
 * local cache ids, author names, and UI-only fields. The game-facing payload is
 * just ordered build data with stable item ids and quantities.
 */
export function formatAsBuildDataJson(
  laneViews: LaneView[],
  maxTurn?: number,
  options?: { scope?: 'current' | 'full'; currentTurn?: number },
): string {
  const items = extractQueueItems(laneViews, maxTurn)
    .map(toBuildDataJsonItem);

  if (items.length === 0) {
    return '';
  }

  const payload: BuildDataJson = {
    format: 'florent-build-list',
    version: 1,
    scope: options?.scope ?? (maxTurn === undefined ? 'full' : 'current'),
    items,
  };

  if (options?.currentTurn !== undefined) {
    payload.currentTurn = options.currentTurn;
  }

  return JSON.stringify(payload, null, 2);
}

export function formatMultiPlanetAsBuildDataJson(
  data: MultiPlanetExportData,
  maxTurn?: number,
  options?: { scope?: 'current' | 'full'; currentTurn?: number },
): string {
  const planets = data.planets.map((planet) => ({
    id: planet.id,
    name: planet.name,
    startTurn: planet.startTurn,
    currentTurn: planet.currentTurn,
    items: extractQueueItems(planet.lanes, maxTurn).map(toBuildDataJsonItem),
  }));
  const research = data.researchLane
    ? extractQueueItems([data.researchLane], maxTurn).map(toBuildDataJsonItem)
    : [];

  if (planets.every((planet) => planet.items.length === 0) && research.length === 0) {
    return '';
  }

  const payload: MultiPlanetBuildDataJson = {
    format: 'florent-build-list',
    version: 2,
    scope: options?.scope ?? (maxTurn === undefined ? 'full' : 'current'),
    planets,
    research,
  };

  if (options?.currentTurn !== undefined) {
    payload.currentTurn = options.currentTurn;
  }

  return JSON.stringify(payload, null, 2);
}

function toBuildDataJsonItem(item: QueueItem): BuildDataJsonItem {
  return {
    turn: item.turn,
    lane: item.lane,
    itemId: item.itemId,
    name: item.isWait || item.itemId === '__wait__' ? 'Wait' : item.name,
    quantity: item.quantity,
    isWait: item.isWait || item.itemId === '__wait__' ? true : undefined,
    waitTurns: item.isWait || item.itemId === '__wait__' ? item.waitTurns : undefined,
  };
}

/**
 * Format queue as one or more Discord messages, each safe for non-Nitro users.
 * Format: Markdown table with code block
 *
 * Discord's normal message limit is 2,000 characters. The returned array is
 * intended to be copied/pasted one message at a time.
 *
 * @param laneViews - Array of lane views to format
 * @param maxTurn - Optional maximum queue/start turn to include (for "current view" export)
 */
export function formatAsDiscordMessages(laneViews: LaneView[], maxTurn?: number): string[] {
  const items = extractQueueItems(laneViews, maxTurn);

  // Group items by turn
  const turnGroups = new Map<number, QueueItem[]>();
  items.forEach(item => {
    if (!turnGroups.has(item.turn)) {
      turnGroups.set(item.turn, []);
    }
    turnGroups.get(item.turn)!.push(item);
  });

  const header = [
    '```',
    '| Queue | Structure       | Ship            | Colonist        | Research        |',
    '|-------|-----------------|-----------------|-----------------|-----------------|',
  ].join('\n');
  const footer = '\n```';
  const rows: string[] = [];

  // Sort by turn and add rows
  Array.from(turnGroups.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([turn, turnItems]) => {
      const structure = turnItems.find(i => i.lane === 'building');
      const ship = turnItems.find(i => i.lane === 'ship');
      const colonist = turnItems.find(i => i.lane === 'colonist');
      const research = turnItems.find(i => i.lane === 'research');

      // Abbreviate names to save space
      const structureText = structure ? formatQueueItemLabel(structure, abbreviateName(structure.name)) : '';
      const shipText = ship ? formatQueueItemLabel(ship, abbreviateName(ship.name)) : '';
      const colonistText = colonist ? formatQueueItemLabel(colonist, abbreviateName(colonist.name)) : '';
      const researchText = research ? formatQueueItemLabel(research, abbreviateName(research.name)) : '';

      const row = `\n| ${String(turn).padEnd(5)} | ${
        fitDiscordCell(structureText)
      } | ${
        fitDiscordCell(shipText)
      } | ${
        fitDiscordCell(colonistText)
      } | ${
        fitDiscordCell(researchText)
      } |`;
      rows.push(row);
    });

  if (rows.length === 0) {
    return [`${header}${footer}`];
  }

  const messages: string[] = [];
  let table = header;

  rows.forEach(row => {
    if (table !== header && table.length + row.length + footer.length > DISCORD_MESSAGE_LIMIT) {
      messages.push(`${table}${footer}`);
      table = header;
    }
    table += row;
  });

  messages.push(`${table}${footer}`);

  return messages;
}

/**
 * Format queue as Discord text. If multiple messages are required, they are
 * returned separated by blank lines for backward-compatible callers.
 */
export function formatAsDiscord(laneViews: LaneView[], maxTurn?: number): string {
  return formatAsDiscordMessages(laneViews, maxTurn).join('\n\n');
}

export function formatMultiPlanetAsText(data: MultiPlanetExportData, maxTurn?: number): string {
  const lines: string[] = ['=== Multi-Planet Build Order ==='];

  data.planets.forEach((planet) => {
    const items = extractQueueItems(planet.lanes, maxTurn);
    lines.push('', `--- ${planet.name} (starts T${planet.startTurn}) ---`);
    if (items.length === 0) {
      lines.push('No planet-local items queued.');
      return;
    }

    items.forEach((item) => {
      lines.push(`[${item.turn}] ${laneLabel(item.lane)} - ${formatQueueItemLabel(item)}`);
    });
  });

  const researchItems = data.researchLane ? extractQueueItems([data.researchLane], maxTurn) : [];
  lines.push('', '--- Global Research ---');
  if (researchItems.length === 0) {
    lines.push('No research queued.');
  } else {
    researchItems.forEach((item) => {
      lines.push(`[${item.turn}] ${formatQueueItemLabel(item)}`);
    });
  }

  const hasAnyPlanetItems = data.planets.some((planet) => extractQueueItems(planet.lanes, maxTurn).length > 0);
  return hasAnyPlanetItems || researchItems.length > 0 ? lines.join('\n') : '';
}

export function formatMultiPlanetAsDiscordMessages(data: MultiPlanetExportData, maxTurn?: number): string[] {
  const lines: string[] = [
    `Multi-Planet Build Order (${data.planets.length} planet${data.planets.length === 1 ? '' : 's'})`,
    '',
  ];

  data.planets.forEach((planet) => {
    const items = extractQueueItems(planet.lanes, maxTurn);
    lines.push(`${planet.name} (starts T${planet.startTurn})`);
    if (items.length === 0) {
      lines.push('No planet-local items queued.', '');
      return;
    }

    lines.push('| Queue | Lane      | Item            |');
    lines.push('|-------|-----------|-----------------|');
    items.forEach((item) => {
      lines.push(`| ${String(item.turn).padEnd(5)} | ${fitDiscordCell(laneLabel(item.lane), 9)} | ${fitDiscordCell(formatQueueItemLabel(item), 15)} |`);
    });
    lines.push('');
  });

  const researchItems = data.researchLane ? extractQueueItems([data.researchLane], maxTurn) : [];
  lines.push('Global Research');
  if (researchItems.length === 0) {
    lines.push('No research queued.');
  } else {
    lines.push('| Queue | Research        |');
    lines.push('|-------|-----------------|');
    researchItems.forEach((item) => {
      lines.push(`| ${String(item.turn).padEnd(5)} | ${fitDiscordCell(formatQueueItemLabel(item), 15)} |`);
    });
  }

  const hasAnyPlanetItems = data.planets.some((planet) => extractQueueItems(planet.lanes, maxTurn).length > 0);
  return hasAnyPlanetItems || researchItems.length > 0 ? splitDiscordLines(lines) : ['```\n```'];
}

function fitDiscordCell(value: string, width = 15): string {
  return value.slice(0, width).padEnd(width);
}

function splitDiscordLines(lines: string[]): string[] {
  const header = '```';
  const footer = '\n```';
  const messages: string[] = [];
  let message = header;

  lines.forEach((line) => {
    const nextLine = `\n${line}`;
    if (message !== header && message.length + nextLine.length + footer.length > DISCORD_MESSAGE_LIMIT) {
      messages.push(`${message}${footer}`);
      message = header;
    }
    message += nextLine;
  });

  messages.push(`${message}${footer}`);
  return messages;
}

function laneLabel(lane: LaneId): string {
  switch (lane) {
    case 'building':
      return 'Structure';
    case 'ship':
      return 'Ship';
    case 'colonist':
      return 'Colonist';
    case 'research':
      return 'Research';
  }
}

/**
 * Copy text to clipboard
 * Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API failed, trying textarea fallback:', err);
  }

  if (typeof document === 'undefined') return false;

  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return document.execCommand?.('copy') ?? false;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  } finally {
    textarea?.remove();
  }
}
