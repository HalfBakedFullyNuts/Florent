import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '../commands';
import { beginPlanGuard, findShortfallChoice } from '../planGuard';
import { CommandHistory } from '../urlState';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import { setDefsCatalog } from '../../sim/engine/defsRegistry';
import type { PlanetState } from '../../sim/engine/types';
import gameDataRaw from '../game_data.json';

function setup(mutateStart?: (state: PlanetState) => void): GameController {
  const defs = loadGameData(gameDataRaw as any);
  setDefsCatalog(defs);
  const start = createStandardStart(defs);
  mutateStart?.(start);
  return new GameController(start);
}

function buildingOrder(controller: GameController): string[] {
  const lane = controller.getStateAtTurn(1)!.lanes.building;
  return [...(lane.active ? [lane.active] : []), ...lane.pendingQueue].map((item) => item.itemId);
}

function pendingId(controller: GameController, itemId: string): string {
  return controller.getStateAtTurn(1)!.lanes.building.pendingQueue.find((item) => item.itemId === itemId)!.id;
}

describe('beginPlanGuard', () => {
  let controller: GameController;
  beforeEach(() => {
    controller = setup();
    for (const id of ['farm', 'solar_generator', 'spy_centre']) controller.queueItem(1, id, 1);
  });

  it('reports nothing for a change that keeps the plan valid', () => {
    const guard = beginPlanGuard(controller, 1);
    controller.queueItem(1, 'metal_mine', 1);
    expect(guard.finish()).toEqual([]);
  });

  it('reports a reorder that drives net energy negative', () => {
    const guard = beginPlanGuard(controller, 1);
    controller.reorderQueueItem(1, 'building', pendingId(controller, 'spy_centre'), 0);
    controller.repackQueue(1, 'building');

    expect(guard.finish({ changedEntryId: pendingId(controller, 'spy_centre') }).map((p) => p.kind)).toContain('NEGATIVE_ENERGY');
  });

  it('undo restores the plan exactly as it was', () => {
    const guard = beginPlanGuard(controller, 1);
    controller.reorderQueueItem(1, 'building', pendingId(controller, 'spy_centre'), 0);
    guard.finish();

    guard.undo();
    expect(buildingOrder(controller)).toEqual(['farm', 'solar_generator', 'spy_centre']);
  });

  it('reports a prerequisite moved behind the building that needs it', () => {
    const rich = setup((start) => {
      Object.assign(start.completedCounts, { colony: 1, launch_site: 1, shipyard: 1 });
      Object.assign(start.stocks, { metal: 1_000_000, mineral: 1_000_000 });
      Object.assign(start.population, { workersTotal: 1_000_000, workersIdle: 1_000_000 });
      start.housing.workerCap = 1_000_000;
      Object.assign(start.space, { groundCap: 200, orbitalCap: 200 });
    });
    rich.queueItem(1, 'farm', 1);
    expect(rich.queueItem(1, 'metropolis', 1).success).toBe(true);
    expect(rich.queueItem(1, 'space_dock', 1).success).toBe(true);
    const guard = beginPlanGuard(rich, 1);
    rich.reorderQueueItem(1, 'building', pendingId(rich, 'space_dock'), 0);

    const problems = guard.finish({ changedEntryId: pendingId(rich, 'space_dock') });
    expect(problems.some((p) => p.kind === 'NEVER_STARTS' && p.itemId === 'space_dock' && p.detail.includes('Metropolis'))).toBe(true);
  });
});

describe('findShortfallChoice', () => {
  it('offers a start-now option when the entry only waits for stock', () => {
    const controller = setup((start) => { start.stocks.metal = 0; });
    const { itemId } = controller.queueItem(1, 'living_quarters', 1);

    const choice = findShortfallChoice(controller, 1, 'building', itemId!);
    expect(choice).not.toBeNull();
    expect(choice!.forcedStart).toBe(1);
    expect(choice!.waitStart).toBeGreaterThan(1);
    const lane = controller.getStateAtTurn(1)!.lanes.building; // the probe leaves no trace
    expect(lane.active).toBeNull();
    expect(lane.pendingQueue[0]).toMatchObject({ id: itemId });
    expect(lane.pendingQueue[0].allowShortfall).toBeUndefined();
  });

  it('returns null when the entry starts on time anyway', () => {
    const controller = setup();
    const { itemId } = controller.queueItem(1, 'farm', 1);
    expect(findShortfallChoice(controller, 1, 'building', itemId!)).toBeNull();
  });
});

describe('CommandHistory checkpoints', () => {
  it('restore drops commands recorded after the checkpoint, including seq ids', () => {
    const history = new CommandHistory();
    history.recordQueue(0, 'farm', 1, 'a');
    const checkpoint = history.checkpoint();
    history.recordQueue(0, 'metal_mine', 1, 'b');
    history.recordReorder(0, 'building', 'b', 0);

    history.restore(checkpoint);
    history.recordQueue(0, 'solar_generator', 1, 'c');
    history.recordCancel(0, 'building', 'c');

    expect(history.getCommands()).toEqual([
      ['q', 0, 11, 1],
      ['q', 0, 42, 1],
      ['c', 0, 'b', 2],
    ]);
  });
});
