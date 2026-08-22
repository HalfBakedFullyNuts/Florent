/**
 * Tests for the engine-level defs catalog.
 *
 * PlanetState snapshots must NOT embed the (large, static) item-definition
 * catalog; lookups resolve through the registry instead. This keeps timeline
 * cloning cheap and memory footprint small while staying deterministic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ItemDefinition } from '../types';
import { setDefsCatalog, getDefs, registerDef } from '../defsRegistry';
import { createMinimalStart } from '../../defs/seed';
import { Timeline } from '../../../game/state';

function makeDef(id: string, overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id,
    name: id,
    type: 'structure',
    lane: 'building',
    durationTurns: 2,
    costsPerUnit: { metal: 10 },
    effectsOnComplete: {},
    upkeepPerUnit: {},
    isAbundanceScaled: false,
    prerequisites: [],
    ...overrides,
  } as ItemDefinition;
}

describe('defsRegistry', () => {
  beforeEach(() => {
    setDefsCatalog({});
  });

  it('resolves definitions through the catalog instead of state.defs', () => {
    const def = makeDef('test_mine', { outputsPerUnit: { metal: 5 } });
    setDefsCatalog({ test_mine: def });

    expect(getDefs()['test_mine']).toBe(def);
  });

  it('registerDef makes synthetic defs (e.g. demolish) visible to lookups', () => {
    const synthetic = makeDef('demolish_test_mine');
    registerDef(synthetic);

    expect(getDefs()['demolish_test_mine']).toBe(synthetic);
  });

  it('registerDef is idempotent for the same id', () => {
    const a = makeDef('dup_def', { name: 'first' });
    const b = makeDef('dup_def', { name: 'second' });
    registerDef(a);
    registerDef(b);

    expect(getDefs()['dup_def']).toBe(b);
  });

  it('timeline states do not carry the defs catalog per turn', () => {
    const state = createMinimalStart({ test_mine: makeDef('test_mine') });
    const timeline = new Timeline(state);
    const future = timeline.getStateAtTurn(3);

    expect(future).toBeDefined();
    expect(Object.keys(future as object)).not.toContain('defs');
  });
});
