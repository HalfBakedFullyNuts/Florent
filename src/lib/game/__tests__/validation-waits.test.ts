/**
 * Regression test for Issue 1:
 * Wait entries (synthetic itemId '__wait__') must not trigger UNKNOWN_ITEM.
 */

import { describe, it, expect } from 'vitest';
import { GameController } from '../commands';
import { getLaneView, type LaneEntry } from '../selectors';
import { validateAllQueueItems, validateQueueEntry } from '../validation';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import type { LaneId } from '../../sim/engine/types';
import gameDataRaw from '../game_data.json';

function createController(): GameController {
  const defs = loadGameData(gameDataRaw as any);
  return new GameController(createStandardStart(defs));
}

function laneEntries(state: ReturnType<GameController['getCurrentState']>, laneId: LaneId): LaneEntry[] {
  return getLaneView(state, laneId).entries;
}

describe('validation — wait entries', () => {
  it('does not flag a manual wait entry as UNKNOWN_ITEM', () => {
    const controller = createController();
    const wait = controller.queueWaitItem(1, 'building', 5, false);
    expect(wait.success).toBe(true);

    const results = validateAllQueueItems(controller.getCurrentState(), laneEntries);
    const waitResults = results.filter(r => r.reason === 'UNKNOWN_ITEM');
    expect(waitResults).toHaveLength(0);
  });

  it('returns valid for an auto-wait entry directly', () => {
    const controller = createController();
    const wait = controller.queueWaitItem(1, 'building', 3, true);
    expect(wait.success).toBe(true);

    const state = controller.getCurrentState();
    const entries = laneEntries(state, 'building');
    const waitEntry = entries.find(e => e.isWait);
    expect(waitEntry).toBeDefined();

    const result = validateQueueEntry(state, waitEntry!, 'building');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
