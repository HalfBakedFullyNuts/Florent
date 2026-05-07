import { describe, expect, test } from 'vitest';
import { buildSharedBuildListSummary } from '../SharedBuildListView';
import type { LaneEntry, LaneView } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';

function entry(overrides: Partial<LaneEntry> & Pick<LaneEntry, 'itemId'>): LaneEntry {
  return {
    id: `${overrides.itemId}-${overrides.startTurn ?? overrides.queuedTurn ?? 1}`,
    itemId: overrides.itemId,
    itemName: overrides.itemId,
    status: 'pending',
    quantity: 1,
    turnsRemaining: 1,
    eta: null,
    ...overrides,
  };
}

function lane(laneId: LaneId, entries: LaneEntry[]): LaneView {
  return { laneId, entries };
}

const emptyLanes: Record<LaneId, LaneView> = {
  building: lane('building', []),
  ship: lane('ship', []),
  colonist: lane('colonist', []),
  research: lane('research', []),
};

describe('buildSharedBuildListSummary', () => {
  test('summarizes only present build-list milestones', () => {
    const summary = buildSharedBuildListSummary({
      name: 'Strike BL',
      planets: new Map(),
      lanes: {
        ...emptyLanes,
        ship: lane('ship', [
          entry({ itemId: 'outpost_ship', quantity: 2, startTurn: 16, completionTurn: 20 }),
          entry({ itemId: 'outpost_ship', quantity: 1, startTurn: 210, completionTurn: 214 }),
          entry({ itemId: 'invasion_ship', startTurn: 40, completionTurn: 44 }),
        ]),
        colonist: lane('colonist', [
          entry({ itemId: 'soldier', quantity: 100, startTurn: 30, completionTurn: 33 }),
        ]),
      },
    });

    expect(summary.facts).toContainEqual({ label: 'Build list', value: 'Strike BL' });
    expect(summary.facts).toContainEqual({ label: 'First outpost ship', value: 'T20' });
    expect(summary.facts).toContainEqual({ label: 'First invasion ship', value: 'T44' });
    expect(summary.facts).toContainEqual({ label: 'First soldiers', value: 'T33' });
    expect(summary.facts).toContainEqual({ label: 'Outposts started before T200', value: '2' });
  });

  test('omits outpost, invasion, and soldier facts when they are absent', () => {
    const summary = buildSharedBuildListSummary({
      name: 'Eco BL',
      planets: new Map(),
      lanes: {
        ...emptyLanes,
        building: lane('building', [
          entry({ itemId: 'farm', startTurn: 1, completionTurn: 4 }),
        ]),
      },
    });

    const labels = summary.facts.map((fact) => fact.label);
    expect(labels).toContain('Build list');
    expect(labels).not.toContain('First outpost ship');
    expect(labels).not.toContain('First invasion ship');
    expect(labels).not.toContain('First soldiers');
    expect(labels).not.toContain('Outposts started before T200');
  });
});
