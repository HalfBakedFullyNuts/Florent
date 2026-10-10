import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '../commands';
import { diagnoseController } from '../planGuard';
import { createDemolishDef } from '../demolish';
import { createStandardStart } from '../../sim/defs/seed';
import { loadGameData } from '../../sim/defs/adapter';
import { getDefs, setDefsCatalog } from '../../sim/engine/defsRegistry';
import gameDataRaw from '../game_data.json';

// Three free ground space: three Mineral Extractors (1 GS each) fit, a fourth never could.
function controllerWithFreeGround(free: number): GameController {
  const defs = loadGameData(gameDataRaw as any);
  setDefsCatalog(defs);
  const start = createStandardStart(defs);
  start.space.groundCap = start.space.groundUsed + free;
  return new GameController(start);
}

describe('queueing structures needs space the plan can provide', () => {
  let controller: GameController;
  beforeEach(() => {
    controller = controllerWithFreeGround(3);
  });

  it('accepts structures while queued space fits and refuses the one that never could', () => {
    for (let i = 0; i < 3; i++) expect(controller.queueItem(1, 'mineral_extractor', 1).success).toBe(true);
    expect(controller.queueItem(1, 'mineral_extractor', 1)).toMatchObject({ success: false, reason: 'SPACE_INSUFFICIENT' });
  });

  it('counts space that queued structures will free (demolition)', () => {
    for (let i = 0; i < 3; i++) controller.queueItem(1, 'mineral_extractor', 1);
    const demolish = createDemolishDef('metal_mine', getDefs());
    controller.injectDef(1, demolish);
    expect(controller.queueItem(1, demolish.id, 1).success).toBe(true);

    expect(controller.queueItem(1, 'mineral_extractor', 1).success).toBe(true);
  });

  it('names missing space when an entry never starts', () => {
    for (let i = 0; i < 3; i++) controller.queueItem(1, 'mineral_extractor', 1);
    controller.queueItem(1, 'mineral_extractor', 1, { force: true });

    const stalled = diagnoseController(controller, 1).problems.find((p) => p.kind === 'NEVER_STARTS');
    expect(stalled?.detail).toBe('never starts: no free ground space');
  });
});
