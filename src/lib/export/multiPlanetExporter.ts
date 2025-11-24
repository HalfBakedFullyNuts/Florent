/**
 * Export functionality for multi-planet game state
 */

import type { GameState } from '../game/gameState';
import { extractQueueItems, type QueueItem } from './formatters';

/**
 * Export all planets' build orders and research
 */
export function exportGameState(gameState: GameState): string {
  const lines: string[] = [];

  // Header
  lines.push('=== Multi-Planet Build Order ===');
  lines.push(`Planet Count: ${gameState.planets.size}/${gameState.maxPlanets}`);
  lines.push('');

  // Export each planet
  for (const planet of Array.from(gameState.planets.values())) {
    lines.push(`--- ${planet.name} (Turn ${planet.currentTurn}) ---`);
    lines.push(`Started: Turn ${planet.startTurn}`);

    // Extract queue items for this planet
    // Note: extractQueueItems expects LaneView array, but we have LaneState
    // This is a simplified version - may need proper conversion
    const items: any[] = [];  // Placeholder - would need proper lane view conversion

    if (items.length > 0) {
      lines.push('Queue:');
      items.forEach((item) => {
        const turn = planet.startTurn + (item.turn - 1); // Adjust for planet's start turn
        lines.push(`  [${turn}] ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`);
      });
    } else {
      lines.push('Queue: Empty');
    }

    lines.push('');
  }

  // Export global research
  if (gameState.globalResearch.queue.length > 0 || gameState.globalResearch.completed.length > 0) {
    lines.push('--- Global Research ---');

    if (gameState.globalResearch.completed.length > 0) {
      lines.push('Completed:');
      gameState.globalResearch.completed.forEach((id) => {
        lines.push(`  ✓ ${id}`);
      });
    }

    if (gameState.globalResearch.queue.length > 0) {
      lines.push('In Queue:');
      gameState.globalResearch.queue.forEach((item) => {
        lines.push(`  - ${item.itemId} (${item.turnsRemaining} turns remaining)`);
      });
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export game state as Discord-formatted table
 */
export function exportGameStateDiscord(gameState: GameState): string {
  const lines: string[] = [];

  lines.push('```');
  lines.push(`Multi-Planet Build Order (${gameState.planets.size}/${gameState.maxPlanets} planets)`);
  lines.push('');

  // Create table for each planet
  for (const planet of Array.from(gameState.planets.values())) {
    lines.push(`=== ${planet.name} ===`);
    lines.push(`Start: Turn ${planet.startTurn} | Current: Turn ${planet.currentTurn}`);
    lines.push('');

    // Extract and format queue items
    // Note: extractQueueItems expects LaneView array, but we have LaneState
    // This is a simplified version - may need proper conversion
    const items: any[] = [];  // Placeholder - would need proper lane view conversion

    if (items.length > 0) {
      // Group by turn for table format
      const byTurn = new Map<number, QueueItem[]>();
      items.forEach((item) => {
        const turn = planet.startTurn + (item.turn - 1);
        if (!byTurn.has(turn)) {
          byTurn.set(turn, []);
        }
        byTurn.get(turn)!.push(item);
      });

      // Create table
      lines.push('| Turn | Building | Ship | Colonist |');
      lines.push('|------|----------|------|----------|');

      const sortedTurns = Array.from(byTurn.keys()).sort((a, b) => a - b);
      sortedTurns.forEach((turn) => {
        const turnItems = byTurn.get(turn)!;
        const building = turnItems.find(i => i.lane === 'building');
        const ship = turnItems.find(i => i.lane === 'ship');
        const colonist = turnItems.find(i => i.lane === 'colonist');

        lines.push(
          `| ${turn} | ${building ? building.name : ''} | ${ship ? ship.name : ''} | ${colonist ? colonist.name : ''} |`
        );
      });
    } else {
      lines.push('No items queued');
    }

    lines.push('');
  }

  // Add research if any
  if (gameState.globalResearch.queue.length > 0 || gameState.globalResearch.completed.length > 0) {
    lines.push('=== Global Research ===');

    if (gameState.globalResearch.completed.length > 0) {
      lines.push(`Completed: ${gameState.globalResearch.completed.join(', ')}`);
    }

    if (gameState.globalResearch.queue.length > 0) {
      lines.push('Queue:');
      gameState.globalResearch.queue.forEach((item) => {
        lines.push(`- ${item.itemId} (${item.turnsRemaining}T)`);
      });
    }
  }

  lines.push('```');

  return lines.join('\n');
}