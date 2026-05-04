import { describe, expect, test } from 'vitest';
import { GameController } from '../commands';
import { createInitialState } from '../../sim/defs/seed';
import type { ItemDefinition } from '../../sim/engine/types';

const zeroCosts = {
  metal: 0,
  mineral: 0,
  food: 0,
  energy: 0,
  research_points: 0,
  workers: 0,
  space: 0,
  space_orbital: 0,
};

const zeroUpkeep = {
  metal: 0,
  mineral: 0,
  food: 0,
  energy: 0,
  research_points: 0,
};

function makeDef(overrides: Partial<ItemDefinition> & Pick<ItemDefinition, 'id' | 'name'>): ItemDefinition {
  return {
    id: overrides.id,
    name: overrides.name,
    lane: overrides.lane ?? 'building',
    type: overrides.type ?? 'structure',
    tier: overrides.tier ?? 1,
    durationTurns: overrides.durationTurns ?? 1,
    costsPerUnit: overrides.costsPerUnit ?? zeroCosts,
    effectsOnComplete: overrides.effectsOnComplete ?? {},
    upkeepPerUnit: overrides.upkeepPerUnit ?? zeroUpkeep,
    isAbundanceScaled: overrides.isAbundanceScaled ?? false,
    prerequisites: overrides.prerequisites ?? [],
    unique: overrides.unique,
  };
}

function createResearchGateController() {
  const defs: Record<string, ItemDefinition> = {
    future_research: makeDef({
      id: 'future_research',
      name: 'Future Research',
      lane: 'research',
      unique: true,
    }),
    advanced_structure: makeDef({
      id: 'advanced_structure',
      name: 'Advanced Structure',
      durationTurns: 3,
      prerequisites: ['future_research'],
    }),
  };
  const initialState = createInitialState(defs, {
    structures: {},
    stocks: { metal: 1000, mineral: 1000, food: 1000, energy: 1000 },
    population: { workersTotal: 1000 },
  });
  return new GameController(initialState);
}

describe('GameController queueItem research gates', () => {
  test('rejects future research prerequisites unless they are scheduled', () => {
    const controller = createResearchGateController();

    const result = controller.queueItem(1, 'advanced_structure', 1, {
      minStartTurn: 5,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('REQ_MISSING');
  });

  test('queues items gated by scheduled research without starting before minStartTurn', () => {
    const controller = createResearchGateController();

    const result = controller.queueItem(1, 'advanced_structure', 1, {
      minStartTurn: 5,
      scheduledResearch: ['future_research'],
    });

    expect(result.success).toBe(true);
    expect(controller.getStateAtTurn(5)?.lanes.building.active).toBeNull();
    expect(controller.getStateAtTurn(6)?.lanes.building.active?.itemId).toBe('advanced_structure');
    expect(controller.getStateAtTurn(6)?.lanes.building.active?.startTurn).toBe(5);
  });

  test('activates immediately when global research is already completed', () => {
    const controller = createResearchGateController();

    const result = controller.queueItem(1, 'advanced_structure', 1, {
      completedResearch: ['future_research'],
    });

    expect(result.success).toBe(true);
    expect(controller.getStateAtTurn(1)?.lanes.building.active?.itemId).toBe('advanced_structure');
  });
});
