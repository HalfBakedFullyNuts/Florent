import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '../commands';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import { setDefsCatalog } from '../../sim/engine/defsRegistry';
import gameDataRaw from '../game_data.json';

// Living Quarters cost 4,800 metal; with an empty metal stock (+1,200/turn) they normally wait ~4 turns.
function brokeController(): GameController {
  const defs = loadGameData(gameDataRaw as any);
  setDefsCatalog(defs);
  const start = createStandardStart(defs);
  start.stocks.metal = 0;
  return new GameController(start);
}

function startTurnOf(controller: GameController, itemId: string): number | undefined {
  for (let turn = 1; turn <= 60; turn++) {
    const active = controller.getStateAtTurn(turn)!.lanes.building.active;
    if (active?.itemId === itemId) return active.startTurn;
  }
  return undefined;
}

describe('allowShortfall (insert without waiting for resources)', () => {
  let controller: GameController;
  beforeEach(() => {
    controller = brokeController();
  });

  it('normally stalls an unaffordable item until stock catches up', () => {
    controller.queueItem(1, 'living_quarters', 1);
    expect(startTurnOf(controller, 'living_quarters')).toBeGreaterThan(1);
  });

  it('starts the item in its slot when the shortfall is accepted, overspending stock', () => {
    const result = controller.queueItem(1, 'living_quarters', 1, { allowShortfall: true });

    expect(startTurnOf(controller, 'living_quarters')).toBe(1);
    expect(controller.getStateAtTurn(1)!.lanes.building.active?.id).toBe(result.itemId);
    expect(controller.getStateAtTurn(1)!.stocks.metal).toBeLessThan(0);
  });

  it('can be switched on for an entry that is already queued', () => {
    const { itemId } = controller.queueItem(1, 'living_quarters', 1);

    expect(controller.setAllowShortfall(1, 'building', itemId!, true)).toBe(true);
    expect(startTurnOf(controller, 'living_quarters')).toBe(1);
  });

  it('still waits for workers and missing prerequisites', () => {
    controller.queueItem(1, 'colony', 1, { allowShortfall: true }); // needs 50k workers, homeworld has 30k
    expect(startTurnOf(controller, 'colony')).toBeGreaterThan(1);

    const other = brokeController();
    other.queueItem(1, 'shipyard', 1, { force: true, allowShortfall: true }); // needs a Launch Site
    expect(other.getStateAtTurn(40)!.lanes.building.pendingQueue.map((item) => item.itemId)).toContain('shipyard');
  });
});
