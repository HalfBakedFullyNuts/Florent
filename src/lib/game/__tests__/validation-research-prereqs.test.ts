/**
 * Regression test for Issue 6:
 * Items gated by research (e.g. core_metal_mine ← core_metal_mine_research) must
 * not be flagged REQ_MISSING when the research is in state.completedResearch or
 * in the entry's scheduledResearch list.
 */

import { describe, it, expect } from 'vitest';
import { GameController } from '../commands';
import { getLaneView, type LaneEntry } from '../selectors';
import { validateAllQueueItems, validateQueueEntry } from '../validation';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import { getDefs, setDefsCatalog } from '../../sim/engine/defsRegistry';
import type { LaneId } from '../../sim/engine/types';
import gameDataRaw from '../game_data.json';

setDefsCatalog(loadGameData(gameDataRaw as any));

function laneEntries(state: ReturnType<GameController['getCurrentState']>, laneId: LaneId): LaneEntry[] {
  return getLaneView(state, laneId).entries;
}

describe('validation — research prerequisites', () => {
  function withSyntheticResearchPrereq(state: ReturnType<typeof createStandardStart>): typeof state {
    // The non-client adapter doesn't auto-inject research-derived prereqs.
    // Add one manually so the test exercises the validator against a real prereq id.
    const def = getDefs()['farm'];
    getDefs()['farm'] = {
      ...def,
      prerequisites: [...(def?.prerequisites || []), 'fake_research'],
    };
    return state;
  }

  it('accepts research listed in completedResearch as a satisfied prereq', () => {
    const initialState = withSyntheticResearchPrereq(createStandardStart(getDefs()));
    initialState.completedResearch = ['fake_research'];
    const controller = new GameController(initialState);

    const res = controller.queueItem(1, 'farm', 1);
    expect(res.success).toBe(true);

    const results = validateAllQueueItems(controller.getCurrentState(), laneEntries);
    const reqMissing = results.filter(r => r.reason?.startsWith('REQ_MISSING'));
    expect(reqMissing).toEqual([]);
  });

  it('accepts research listed in entry.scheduledResearch as a satisfied prereq', () => {
    const initialState = withSyntheticResearchPrereq(createStandardStart(getDefs()));
    const def = getDefs()['farm'];
    expect(def.prerequisites).toContain('fake_research');

    const entry: LaneEntry = {
      id: 'test-entry',
      itemId: 'farm',
      itemName: 'Farm',
      status: 'pending',
      quantity: 1,
      turnsRemaining: def.durationTurns,
      eta: 10,
      startTurn: 5,
      scheduledResearch: ['fake_research'],
    };

    const result = validateQueueEntry(initialState, entry, 'building');
    expect(result.valid).toBe(true);
  });

  it('treats prereq as missing when listed in entry.blockedResearch, even if scheduledResearch has it', () => {
    const initialState = withSyntheticResearchPrereq(createStandardStart(getDefs()));
    const def = getDefs()['farm'];

    const entry: LaneEntry = {
      id: 'test-entry',
      itemId: 'farm',
      itemName: 'Farm',
      status: 'pending',
      quantity: 1,
      turnsRemaining: def.durationTurns,
      eta: 10,
      startTurn: 5,
      scheduledResearch: ['fake_research'],
      blockedResearch: ['fake_research'],
    };

    const result = validateQueueEntry(initialState, entry, 'building');
    expect(result.valid).toBe(false);
    expect(result.missingPrereqs).toContain('fake_research');
  });

  it('still flags REQ_MISSING when neither completedResearch nor scheduledResearch covers the prereq', () => {
    const initialState = withSyntheticResearchPrereq(createStandardStart(getDefs()));
    const def = getDefs()['farm'];

    const entry: LaneEntry = {
      id: 'test-entry',
      itemId: 'farm',
      itemName: 'Farm',
      status: 'pending',
      quantity: 1,
      turnsRemaining: def.durationTurns,
      eta: 10,
      startTurn: 5,
    };

    const result = validateQueueEntry(initialState, entry, 'building');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('REQ_MISSING');
    expect(result.missingPrereqs).toContain('fake_research');
  });
});
