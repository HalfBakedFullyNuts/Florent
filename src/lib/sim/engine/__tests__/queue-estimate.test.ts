/**
 * Tests for the single shared queue-duration estimator
 * (`estimateItemCompletionTurn`). All completion-turn predictions must go
 * through this one implementation so UI hints can never disagree with the
 * engine about when queued work lands.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { estimateItemCompletionTurn } from '../queueValidation';
import { setDefsCatalog, getDefs } from '../defsRegistry';
import type { PlanetState, WorkItem, ItemDefinition } from '../types';

function def(id: string, lane: 'building' | 'ship', duration: number): ItemDefinition {
  return {
    id,
    name: id,
    lane,
    type: 'structure',
    tier: 1,
    durationTurns: duration,
    costsPerUnit: {},
    effectsOnComplete: {},
    upkeepPerUnit: {},
    isAbundanceScaled: false,
    prerequisites: [],
  } as unknown as ItemDefinition;
}

function item(id: string, itemId: string, opts: Partial<WorkItem> = {}): WorkItem {
  return { id, itemId, status: 'pending', quantity: 1, turnsRemaining: 0, ...opts };
}

function state(): PlanetState {
  return {
    currentTurn: 10,
    stocks: {},
    abundance: {},
    population: { workersTotal: 0, workersIdle: 0, soldiers: 0, scientists: 0, busyByLane: {} },
    space: { groundUsed: 0, groundCap: 0, orbitalUsed: 0, orbitalCap: 0 },
    housing: { workerCap: 0, soldierCap: 0, scientistCap: 0 },
    planetLimit: 4,
    completedResearch: [],
    lanes: {
      building: { active: null, pendingQueue: [], completionHistory: [], maxQueueDepth: 99 },
      ship: { active: null, pendingQueue: [], completionHistory: [], maxQueueDepth: 99 },
      colonist: { active: null, pendingQueue: [], completionHistory: [], maxQueueDepth: 99 },
      research: { active: null, pendingQueue: [], completionHistory: [], maxQueueDepth: 99 },
    },
    completedCounts: {},
    pendingColonistConversions: [],
  } as unknown as PlanetState;
}

describe('estimateItemCompletionTurn', () => {
  beforeEach(() => {
    setDefsCatalog({
      a3: def('a3', 'building', 3),
      b2: def('b2', 'building', 2),
      s4: def('s4', 'ship', 4),
    });
  });

  it('returns null when the item is nowhere in the lane', () => {
    expect(estimateItemCompletionTurn(state(), 'building', 'a3')).toBeNull();
  });

  it('counts active remaining plus earlier pending durations', () => {
    const s = state();
    s.lanes.building.active = item('act', 'a3', { status: 'active', turnsRemaining: 2 });
    s.lanes.building.pendingQueue = [
      item('p1', 'b2'),
      item('p2', 'a3'), // target
    ];
    // active finishes at 12; p1 runs 12→14; p2 completes at 14+3=17
    expect(estimateItemCompletionTurn(s, 'building', 'a3')).toBe(17);
  });

  it('treats wait entries by their turnsRemaining, not a def duration', () => {
    const s = state();
    s.lanes.building.pendingQueue = [
      item('w', '__wait__', { isWait: true, turnsRemaining: 5 }),
      item('p', 'a3'),
    ];
    // wait occupies 10→15; a3 completes at 15+3=18
    expect(estimateItemCompletionTurn(s, 'building', 'a3')).toBe(18);
  });

  it('finds items across lanes independently', () => {
    const s = state();
    s.lanes.ship.pendingQueue = [item('ship1', 's4')];
    // ship completes at 10+4=14
    expect(estimateItemCompletionTurn(s, 'ship', 's4')).toBe(14);
    expect(estimateItemCompletionTurn(s, 'building', 's4')).toBeNull();
  });

  it('handles missing defs conservatively by counting zero duration', () => {
    const s = state();
    s.lanes.ship.active = item('act', 'unknown_def', { status: 'active', turnsRemaining: 1 });
    s.lanes.ship.pendingQueue = [item('x', 's4')];
    expect(estimateItemCompletionTurn(s, 'ship', 's4')).toBe(15);
    void getDefs;
  });
});
