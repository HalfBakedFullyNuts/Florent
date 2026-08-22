/**
 * Tests for engine helpers: work-item ID generation.
 *
 * IDs must be unique across sessions (saves may be restored into a fresh
 * process) and must not embed wall-clock or random content, which would leak
 * nondeterminism into replayed state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateWorkItemId, seedWorkItemIdCounterFromState } from '../helpers';
import type { PlanetState, WorkItem } from '../types';

function item(id: string): WorkItem {
  return { id, itemId: 'x', status: 'pending', quantity: 1, turnsRemaining: 1 };
}

describe('generateWorkItemId', () => {
  beforeEach(() => {
    seedWorkItemIdCounterFromState(undefined as unknown as PlanetState);
  });

  it('generates strictly increasing numeric ids without timestamps or randomness', () => {
    const a = generateWorkItemId();
    const b = generateWorkItemId();

    expect(a).toMatch(/^wi_\d+$/);
    expect(b).toMatch(/^wi_\d+$/);
    expect(Number(b.slice(3))).toBeGreaterThan(Number(a.slice(3)));
  });

  it('seeds past ids already present in a restored state (no collisions)', () => {
    const state = {
      lanes: {
        building: {
          active: null,
          pendingQueue: [item('wi_7')],
          completionHistory: [{ ...item('wi_9'), status: 'completed' }],
        },
      },
      pendingColonistConversions: [],
    } as unknown as PlanetState;

    seedWorkItemIdCounterFromState(state);
    const next = generateWorkItemId();

    expect(Number(next.slice(3))).toBeGreaterThan(9);
  });
});
