import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '../commands';
import { describePlanProblem, diagnosePlan, findNewProblems, type PlanDiagnosis } from '../planDiagnostics';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import { setDefsCatalog } from '../../sim/engine/defsRegistry';
import type { ItemDefinition } from '../../sim/engine/types';
import gameDataRaw from '../game_data.json';

let defs: Record<string, ItemDefinition>;

beforeEach(() => {
  defs = loadGameData(gameDataRaw as any);
  setDefsCatalog(defs);
});

function controllerWith(items: string[]): GameController {
  const controller = new GameController(createStandardStart(defs));
  for (const id of items) controller.queueItem(1, id, 1);
  return controller;
}

function diagnose(controller: GameController): PlanDiagnosis {
  return diagnosePlan((turn) => controller.getStateAtTurn(turn), 1, controller.getTotalTurns());
}

function moveFirstPending(controller: GameController, itemId: string, newIndex: number): void {
  const lane = controller.getStateAtTurn(1)!.lanes.building;
  const entry = lane.pendingQueue.find((item) => item.itemId === itemId)!;
  controller.reorderQueueItem(1, 'building', entry.id, newIndex);
  controller.repackQueue(1, 'building');
}

describe('diagnosePlan', () => {
  it('reports no problems for a plan that stays within its means', () => {
    const diagnosis = diagnose(controllerWith(['farm', 'solar_generator', 'spy_centre']));
    expect(diagnosis.problems).toEqual([]);
  });

  it('flags negative net energy from the first turn it happens, with its turn range', () => {
    const controller = controllerWith(['farm', 'solar_generator', 'spy_centre']);
    moveFirstPending(controller, 'spy_centre', 0); // Spy Centre now finishes before the Solar Generator

    const energy = diagnose(controller).problems.filter((p) => p.kind === 'NEGATIVE_ENERGY');
    expect(energy).toHaveLength(1);
    expect(energy[0]).toMatchObject({ turn: 21, endTurn: 24 });
  });

  it('flags entries that never start, naming the missing prerequisite', () => {
    const controller = new GameController(createStandardStart(defs));
    controller.queueItem(1, 'shipyard', 1, { force: true }); // needs a Launch Site that is never built

    const stalled = diagnose(controller).problems.filter((p) => p.kind === 'NEVER_STARTS');
    expect(stalled).toHaveLength(1);
    expect(stalled[0]).toMatchObject({ laneId: 'building', itemId: 'shipyard' });
    expect(stalled[0].detail).toContain('Launch Site');
  });

  it('records every entry start turn so later changes can be compared', () => {
    const controller = controllerWith(['farm', 'solar_generator']);
    const { starts } = diagnose(controller);
    expect([...starts.values()].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 5]);
  });
});

describe('findNewProblems', () => {
  const empty: PlanDiagnosis = { problems: [], starts: new Map(), items: new Map() };

  it('returns problems that did not exist before the change', () => {
    const before = diagnose(controllerWith(['farm', 'solar_generator', 'spy_centre']));
    const controller = controllerWith(['farm', 'solar_generator', 'spy_centre']);
    moveFirstPending(controller, 'spy_centre', 0);

    const added = findNewProblems(before, diagnose(controller));
    expect(added.map((p) => p.kind)).toContain('NEGATIVE_ENERGY');
  });

  it('ignores problems that were already there', () => {
    const controller = controllerWith(['farm', 'solar_generator', 'spy_centre']);
    moveFirstPending(controller, 'spy_centre', 0);
    const diagnosis = diagnose(controller);

    expect(findNewProblems(diagnosis, diagnosis)).toEqual([]);
  });

  it('reports existing entries pushed later, except the one being changed', () => {
    const before: PlanDiagnosis = { ...empty, starts: new Map([['lq', 7], ['farm', 1], ['moved', 3]]) };
    const after: PlanDiagnosis = { ...empty, starts: new Map([['lq', 12], ['farm', 1], ['moved', 9]]) };

    const added = findNewProblems(before, after, { changedEntryId: 'moved' });
    expect(added).toEqual([expect.objectContaining({ kind: 'DELAYED', entryId: 'lq', turn: 12, detail: 'starts T12 instead of T7' })]);
  });

  it('names the delayed entry and its lane when the diagnosis knows them', () => {
    const items = new Map([['lq', { itemId: 'living_quarters', laneId: 'building' as const }]]);
    const before: PlanDiagnosis = { ...empty, starts: new Map([['lq', 7]]), items };
    const after: PlanDiagnosis = { ...empty, starts: new Map([['lq', 9]]), items };

    expect(findNewProblems(before, after)[0]).toMatchObject({ itemId: 'living_quarters', laneId: 'building' });
  });

  it('describes problems for the player with turn labels and item names', () => {
    const names = (id: string) => (id === 'spy_centre' ? 'Spy Centre' : id);
    expect(describePlanProblem({ kind: 'NEGATIVE_ENERGY', turn: 21, endTurn: 24, detail: 'net energy -40/turn' }, names)).toEqual({
      turnLabel: 'T21–T24',
      title: 'Energy output negative',
      detail: 'net energy -40/turn',
    });
    expect(describePlanProblem({ kind: 'NEVER_STARTS', turn: 200, itemId: 'spy_centre', detail: 'never starts: missing Metropolis' }, names)).toEqual({
      turnLabel: 'T200',
      title: 'Spy Centre never starts',
      detail: 'never starts: missing Metropolis',
    });
  });

  it('reports an entry that started before but no longer starts at all', () => {
    const before: PlanDiagnosis = { ...empty, starts: new Map([['lq', 7]]) };
    const after: PlanDiagnosis = { ...empty, starts: new Map([['lq', null]]) };

    expect(findNewProblems(before, after).map((p) => p.kind)).toEqual(['DELAYED']);
  });
});
