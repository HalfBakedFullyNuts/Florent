/**
 * Export functionality for multi-planet game state
 */

import type { GameState } from '../game/gameState';

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

    // Per-planet queue export requires LaneView conversion — use
    // formatters.formatMultiPlanetAsText for full queue detail.
    lines.push('Queue: Empty');

    lines.push('');
  }

  // Export global research
  if (gameState.globalResearch.lane.pendingQueue.length > 0 || gameState.globalResearch.lane.active || gameState.globalResearch.completed.length > 0) {
    lines.push('--- Global Research ---');

    if (gameState.globalResearch.completed.length > 0) {
      lines.push('Completed:');
      gameState.globalResearch.completed.forEach((id) => {
        lines.push(`  ✓ ${id}`);
      });
    }

    const queuedResearch = [
      ...(gameState.globalResearch.lane.active ? [gameState.globalResearch.lane.active] : []),
      ...gameState.globalResearch.lane.pendingQueue,
    ];
    if (queuedResearch.length > 0) {
      lines.push('In Queue:');
      queuedResearch.forEach((item) => {
        lines.push(`  - ${item.itemId} (${item.turnsRemaining} turns remaining)`);
      });
    }

    lines.push('');
  }

  return lines.join('\n');
}
