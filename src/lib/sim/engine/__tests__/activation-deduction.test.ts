/**
 * Phase 0 Contract Tests — Activation-Time Deduction Model
 *
 * These tests pin the new contract for resource handling in the simulator:
 *   - Costs are NOT deducted at queue time. Pending items affect no stocks.
 *   - Costs ARE deducted on activation (start of turn item activates).
 *   - Workers/space already worked this way; this aligns resources/RP too.
 *   - Cancel pending  -> stocks unchanged.
 *   - Cancel active   -> full refund (resources + workers + space).
 *   - Lane priority is enforced per turn: building > ship > colonist > research.
 *   - Ship/colonist batches show INTENDED quantity until activation, then lock to clamped value.
 *   - Auto-wait inserted when a prereq is queued but not yet built.
 *   - Energy projection is a hard, per-planet block.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PlanetState, ItemDefinition } from '../types';
import { GameController } from '../../../game/commands';
import { createInitialState } from '../../defs/seed';
import { minimalDefs } from '../../../../test/fixtures/minimal';

/**
 * Extended defs adding research_lab + barracks + solar_generator + mineral_extractor
 * so the contract tests reflect the real game.
 */
function buildContractDefs(): Record<string, ItemDefinition> {
  const defs: Record<string, ItemDefinition> = { ...minimalDefs };

  defs.solar_generator = {
    id: 'solar_generator',
    name: 'Solar Generator',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 6,
    costsPerUnit: {
      metal: 800, mineral: 300, food: 0, energy: 0, research_points: 0,
      workers: 1000, space: 1,
    },
    effectsOnComplete: { production_energy: 100 },
    upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
    isAbundanceScaled: false,
    prerequisites: ['outpost'],
  };

  defs.mineral_extractor = {
    id: 'mineral_extractor',
    name: 'Mineral Extractor',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 4,
    costsPerUnit: {
      metal: 700, mineral: 1500, food: 0, energy: 0, research_points: 0,
      workers: 5000, space: 1,
    },
    effectsOnComplete: { production_mineral: 300 },
    upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 10, research_points: 0 },
    isAbundanceScaled: true,
    prerequisites: ['outpost'],
  };

  defs.research_lab = {
    id: 'research_lab',
    name: 'Research Lab',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 14,
    costsPerUnit: {
      metal: 24000, mineral: 16000, food: 0, energy: 0, research_points: 0,
      workers: 25000, space: 2,
    },
    effectsOnComplete: { housing_scientist_cap: 25000 },
    upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 10, research_points: 0 },
    isAbundanceScaled: false,
    prerequisites: ['outpost'],
    maxPerPlanet: 1,
  };

  defs.barracks = {
    id: 'barracks',
    name: 'Barracks',
    lane: 'building',
    type: 'structure',
    tier: 1,
    durationTurns: 6,
    costsPerUnit: {
      metal: 5000, mineral: 3000, food: 0, energy: 0, research_points: 0,
      workers: 5000, space: 1,
    },
    effectsOnComplete: { housing_soldier_cap: 5000 },
    upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 5, research_points: 0 },
    isAbundanceScaled: false,
    prerequisites: ['outpost'],
  };

  // Strip energy upkeep from metal_mine for predictable energy math in tests
  defs.metal_mine = {
    ...defs.metal_mine,
    upkeepPerUnit: { ...defs.metal_mine.upkeepPerUnit, energy: 10 },
  };

  return defs;
}

function buildState(defs: Record<string, ItemDefinition>, overrides: Partial<{
  metal: number; mineral: number; food: number; energy: number; rp: number;
  workersTotal: number; soldiers: number; scientists: number;
  structures: Record<string, number>;
}> = {}): PlanetState {
  return createInitialState(defs, {
    stocks: {
      metal: overrides.metal ?? 60000,
      mineral: overrides.mineral ?? 40000,
      food: overrides.food ?? 1000,
      energy: overrides.energy ?? 0,
    },
    abundance: { metal: 1.0, mineral: 1.0, food: 1.0, energy: 1.0 },
    population: {
      workersTotal: overrides.workersTotal ?? 80000,
      soldiers: overrides.soldiers ?? 0,
      scientists: overrides.scientists ?? 0,
    },
    structures: overrides.structures ?? {
      outpost: 1,
      solar_generator: 1, // +100 energy so research_lab's -10 upkeep passes
    },
    space: { groundCap: 60, orbitalCap: 40 },
  });
}

// ---------------------------------------------------------------------------
// 1. Research Lab queue bug — the original report
// ---------------------------------------------------------------------------
describe('Research Lab queue (the original bug)', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('queues a research lab on a fresh standard start', () => {
    const state = buildState(defs);
    const ctl = new GameController(state);
    const r = ctl.queueItem(1, 'research_lab', 1);
    expect(r.success).toBe(true);
  });

  it('still queues research_lab after several other buildings are queued at T1', () => {
    // The bug: queue-time deductions ate T1 metal so research_lab failed.
    // Under the new model, pending items must NOT deduct stocks.
    const state = buildState(defs, { metal: 30000, mineral: 20000 });
    const ctl = new GameController(state);
    expect(ctl.queueItem(1, 'metal_mine', 3).success).toBe(true);
    expect(ctl.queueItem(1, 'mineral_extractor', 3).success).toBe(true);
    expect(ctl.queueItem(1, 'farm', 1).success).toBe(true);
    // After the above, T1 stocks would have been ~24,000 metal under the OLD model.
    // Research lab needs 24,000 metal — under new model production accumulates
    // before activation, and the gate must consider that.
    const r = ctl.queueItem(1, 'research_lab', 1);
    expect(r.success).toBe(true);
  });

  it('rejects research_lab when the prereq (outpost) is missing entirely', () => {
    const state = buildState(defs, { structures: { solar_generator: 1 } });
    const ctl = new GameController(state);
    const r = ctl.queueItem(1, 'research_lab', 1);
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Activation-time pricing (no queue-time deduction)
// ---------------------------------------------------------------------------
describe('Activation-time pricing', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('queueing a building does NOT change T1 stocks', () => {
    const state = buildState(defs, { metal: 30000, mineral: 20000 });
    const ctl = new GameController(state);
    const beforeMetal = ctl.getStateAtTurn(1)!.stocks.metal;
    const beforeMineral = ctl.getStateAtTurn(1)!.stocks.mineral;
    ctl.queueItem(1, 'metal_mine', 1);
    const afterMetal = ctl.getStateAtTurn(1)!.stocks.metal;
    const afterMineral = ctl.getStateAtTurn(1)!.stocks.mineral;
    expect(afterMetal).toBe(beforeMetal);
    expect(afterMineral).toBe(beforeMineral);
  });

  it('stocks decrease at the activation turn, not at queue turn', () => {
    const state = buildState(defs, { metal: 30000, mineral: 20000 });
    const ctl = new GameController(state);
    ctl.queueItem(1, 'metal_mine', 1);
    // Building lane is empty -> activates same turn (T1)
    // Net delta on T1 visible state: +metal-mine cost deducted
    const t1 = ctl.getStateAtTurn(1)!;
    // After T1 production runs, expect stocks to reflect cost deduction
    const t2 = ctl.getStateAtTurn(2)!;
    // Costs deducted on activation turn at T1; we should see them on T1's state
    // (T1 starts at index 0; runTurn pushes us to T2).
    // Easiest invariant: T2 metal = T1 metal - 1500 + production
    const productionPerTurn = 300 + 3 * 0; // outpost only (no metal mines completed yet)
    expect(t2.stocks.metal).toBe(30000 - 1500 + productionPerTurn);
  });
});

// ---------------------------------------------------------------------------
// 3. Lane priority — building > ship > colonist > research
// ---------------------------------------------------------------------------
describe('Lane priority on activation turn', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('building gets workers first, colonist clamps to remainder', () => {
    // Workers idle = 14_000.  metal_mine needs 5_000 -> activates with 1.
    // After deduction, 9_000 workers idle.  Soldier needs 10/each -> max 900.
    // food: 18_000 lets soldier batch of up to 900 activate (20 food/each = 18_000).
    const state = buildState(defs, {
      workersTotal: 14000,
      food: 50000,
      metal: 80000,
      mineral: 80000,
      structures: { outpost: 1, solar_generator: 1, barracks: 1 },
    });
    const ctl = new GameController(state);
    expect(ctl.queueItem(1, 'metal_mine', 1).success).toBe(true);
    expect(ctl.queueItem(1, 'soldier', 5000).success).toBe(true); // way more than fit
    const t2 = ctl.getStateAtTurn(2)!;
    // Building lane should have the metal_mine active
    expect(t2.lanes.building.active?.itemId).toBe('metal_mine');
    expect(t2.lanes.building.active?.quantity).toBe(1);
    // Colonist lane should have clamped soldier batch
    const colonistActive = t2.lanes.colonist.active;
    expect(colonistActive?.itemId).toBe('soldier');
    expect(colonistActive?.quantity).toBeLessThanOrEqual(900);
    expect(colonistActive?.quantity).toBeGreaterThan(0);
  });

  it('building eats resources first; ship clamps to remaining metal', () => {
    // Add fighter def BEFORE building state so the def is in state.defs.
    defs.fighter = {
      id: 'fighter', name: 'Fighter', lane: 'ship', type: 'ship', tier: 2,
      durationTurns: 4,
      costsPerUnit: { metal: 1500, mineral: 350, food: 0, energy: 0, research_points: 0, workers: 500, space: 0 },
      effectsOnComplete: {},
      upkeepPerUnit: { metal: 0, mineral: 0, food: 0, energy: 0, research_points: 0 },
      isAbundanceScaled: false,
      prerequisites: [],
    };
    // 10_000 metal. metal_mine takes 1_500 (activates with 1).
    // remaining 8_500. fighter cost 1500 metal/each -> max 5 fighters.
    const state = buildState(defs, {
      metal: 10000, mineral: 10000, workersTotal: 60000,
      structures: { outpost: 1, solar_generator: 1 },
    });
    const ctl = new GameController(state);
    expect(ctl.queueItem(1, 'metal_mine', 1).success).toBe(true);
    expect(ctl.queueItem(1, 'fighter', 100).success).toBe(true);
    const t2 = ctl.getStateAtTurn(2)!;
    expect(t2.lanes.building.active?.itemId).toBe('metal_mine');
    expect(t2.lanes.ship.active?.itemId).toBe('fighter');
    expect(t2.lanes.ship.active!.quantity).toBeLessThanOrEqual(5);
    expect(t2.lanes.ship.active!.quantity).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Auto-wait insertion on queue
// ---------------------------------------------------------------------------
describe('Auto-wait injection', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('inserts a wait when prereq is queued but not yet built', () => {
    // Test scenario: queue barracks first, then queue soldier (which needs barracks).
    // Soldier should auto-wait until barracks completes.
    const state = buildState(defs, {
      metal: 80000, mineral: 80000, food: 50000,
      workersTotal: 20000, // small enough that net food stays positive
      structures: { outpost: 1, solar_generator: 2 },
    });
    const ctl = new GameController(state);
    expect(ctl.queueItem(1, 'barracks', 1).success).toBe(true);
    const r = ctl.queueItem(1, 'soldier', 100);
    expect(r.success).toBe(true);
    // Inspect colonist lane: should have an auto-wait item before the soldier item
    const t1 = ctl.getStateAtTurn(1)!;
    const cq = t1.lanes.colonist.pendingQueue;
    const hasAutoWait = cq.some(it => it.isWait && it.isAutoWait);
    const hasSoldier = cq.some(it => it.itemId === 'soldier');
    expect(hasAutoWait).toBe(true);
    expect(hasSoldier).toBe(true);
  });

  it('rejects when the prereq is not present and not queued', () => {
    const state = buildState(defs);
    const ctl = new GameController(state);
    // soldier requires barracks; no barracks exists or queued -> hard reject
    const r = ctl.queueItem(1, 'soldier', 1);
    expect(r.success).toBe(false);
  });

  it('does NOT inject wait when same-lane prereq completes before item naturally activates', () => {
    // Scenario mirrors the user bug: Launch Site (building lane) completes at ~T6,
    // then several more buildings fill the queue up to ~T22.
    // A new building requiring launch_site is added at the END of the queue.
    // Its natural activation is T22, after launch_site's T6 → wait = max(0, 6-22) = 0.
    //
    // We model this with: barracks (prereq for mineral_extractor_adv, but here we test
    // a building whose prereq IS barracks and both are in the building lane).
    // mineral_extractor (no prereq) stands in for the "gap filler" items.
    // We add a second barracks-requiring item after three gap fillers.
    // Since barracks completes at T7 and gap fillers push natural activation to T19, no wait.
    //
    // Instead of adding a new def, verify via barracks itself: queue barracks,
    // then 3 mineral_extractors (4T each), then another barracks.
    // The 2nd barracks has no prereq issues (barracks has no prereqs itself) but
    // we can verify the general formula by adding a custom dep. Use mineral_extractor
    // but give it a prerequisite of barracks for this test only.
    const defs2 = buildContractDefs();
    defs2.mineral_extractor = {
      ...defs2.mineral_extractor,
      prerequisites: ['barracks'],
    };
    const state = buildState(defs2, {
      metal: 200000, mineral: 200000, food: 50000,
      workersTotal: 80000,
      structures: { outpost: 1, solar_generator: 3, barracks: 1 }, // barracks already built
    });
    // Remove barracks from completedCounts so the prereq is "pending, not done"
    // and put a barracks in the building queue instead.
    state.completedCounts.barracks = 0;
    state.housing.soldierCap = 0;
    const ctl = new GameController(state);
    // Queue barracks (completes T7), then 3 gap-fillers (4T each → queue fills to T19)
    expect(ctl.queueItem(1, 'barracks', 1).success).toBe(true);
    expect(ctl.queueItem(1, 'solar_generator', 1).success).toBe(true);
    expect(ctl.queueItem(1, 'solar_generator', 1).success).toBe(true);
    expect(ctl.queueItem(1, 'solar_generator', 1).success).toBe(true);
    // mineral_extractor requires barracks; barracks completes at T7, but
    // mineral_extractor naturally activates at T19. No wait should be injected.
    const r = ctl.queueItem(1, 'mineral_extractor', 1);
    expect(r.success).toBe(true);
    const t1 = ctl.getStateAtTurn(1)!;
    const bq = t1.lanes.building.pendingQueue;
    const hasAutoWait = bq.some(it => it.isWait && it.isAutoWait);
    expect(hasAutoWait).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Cancel refund semantics
// ---------------------------------------------------------------------------
describe('Cancel refund semantics', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('cancelling a PENDING item does not change stocks', () => {
    const state = buildState(defs, { metal: 30000, mineral: 20000 });
    const ctl = new GameController(state);
    // Force two metal mines so the second is pending (since the first activates immediately)
    ctl.queueItem(1, 'metal_mine', 1);
    ctl.queueItem(1, 'metal_mine', 1);
    const beforeStocks = { ...ctl.getStateAtTurn(1)!.stocks };
    const lane = ctl.getStateAtTurn(1)!.lanes.building;
    const pending = lane.pendingQueue[0];
    expect(pending).toBeDefined();
    ctl.cancelEntryById(1, 'building', pending.id);
    const afterStocks = { ...ctl.getStateAtTurn(1)!.stocks };
    // Pending wasn't paid for — cancellation is a no-op on stocks
    expect(afterStocks.metal).toBe(beforeStocks.metal);
    expect(afterStocks.mineral).toBe(beforeStocks.mineral);
  });

  it('cancelling an ACTIVE item refunds resources, workers, and space', () => {
    const state = buildState(defs, { metal: 30000, mineral: 20000, workersTotal: 20000 });
    const ctl = new GameController(state);
    ctl.queueItem(1, 'metal_mine', 1);
    // states[0] (T1) = pre-turn snapshot with pendingQueue.
    // states[1] (T2) = after T1 ran -> metal_mine active, costs deducted.
    const beforeCancel = ctl.getStateAtTurn(2)!;
    expect(beforeCancel.lanes.building.active?.itemId).toBe('metal_mine');
    const stocksDuringActive = { ...beforeCancel.stocks };
    const workersIdleDuringActive = beforeCancel.population.workersIdle;
    const groundUsedDuringActive = beforeCancel.space.groundUsed;
    // Cancel the active at T2 (where it is currently active)
    ctl.cancelEntry(2, 'building');
    const afterCancel = ctl.getStateAtTurn(2)!;
    // Resources refunded by 1500 metal + 1000 mineral
    expect(afterCancel.stocks.metal).toBe(stocksDuringActive.metal + 1500);
    expect(afterCancel.stocks.mineral).toBe(stocksDuringActive.mineral + 1000);
    // Workers released
    expect(afterCancel.population.workersIdle).toBe(workersIdleDuringActive + 5000);
    // Space freed
    expect(afterCancel.space.groundUsed).toBe(groundUsedDuringActive - 1);
  });
});

// ---------------------------------------------------------------------------
// 6. Intended quantity preserved until activation; remainder dropped on clamp
// ---------------------------------------------------------------------------
describe('Intended batch size preserved until activation', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('pending colonist batch shows intended quantity (not pre-clamped)', () => {
    // Tight workers (1000 idle) -> soldier of 500 cannot fully activate.
    // Plenty of food (50_000) so soldier can queue under the new validator.
    const state = buildState(defs, {
      metal: 80000, mineral: 80000, food: 50000, workersTotal: 1000,
      structures: { outpost: 1, solar_generator: 1, barracks: 1 },
    });
    const ctl = new GameController(state);
    expect(ctl.queueItem(1, 'soldier', 500).success).toBe(true);
    // T1 (states[0]) is the pre-turn snapshot — soldier is pending here with intended qty.
    const t1 = ctl.getStateAtTurn(1)!;
    const pendingSoldier = t1.lanes.colonist.pendingQueue.find(it => it.itemId === 'soldier');
    expect(pendingSoldier).toBeDefined();
    expect(pendingSoldier!.quantity).toBe(500); // intended preserved
  });

  it('clamped batch drops the remainder; queue does not retain leftover', () => {
    const state = buildState(defs, {
      metal: 80000, mineral: 80000, food: 50000, workersTotal: 1000,
      structures: { outpost: 1, solar_generator: 1, barracks: 1 },
    });
    const ctl = new GameController(state);
    expect(ctl.queueItem(1, 'soldier', 500).success).toBe(true);
    // After T1's turn runs, soldier should be ACTIVE in colonist lane,
    // clamped to ≤100 (1000 workers / 10 each), remainder dropped.
    const t2 = ctl.getStateAtTurn(2)!;
    expect(t2.lanes.colonist.active?.itemId).toBe('soldier');
    expect(t2.lanes.colonist.active!.quantity).toBeLessThanOrEqual(100);
    const stillPendingSoldier = t2.lanes.colonist.pendingQueue.some(it => it.itemId === 'soldier');
    expect(stillPendingSoldier).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Per-planet energy hard block (not a soft warning)
// ---------------------------------------------------------------------------
describe('Energy hard block (per planet)', () => {
  let defs: Record<string, ItemDefinition>;

  beforeEach(() => {
    defs = buildContractDefs();
  });

  it('rejects buildings whose upkeep would push net energy below zero', () => {
    // No solar generator -> 0 energy production. metal_mine has 10 upkeep.
    const state = buildState(defs, {
      structures: { outpost: 1 }, // outpost has no production_energy in our fixture
    });
    // Outpost in our fixture produces 100 energy (non-abundance-scaled); we need a no-energy outpost.
    // Workaround: bump energy upkeep too high or strip outpost energy.
    state.completedCounts.outpost = 1;
    // Use a copy where outpost produces no energy
    const noEnergyOutpost: ItemDefinition = {
      ...defs.outpost,
      effectsOnComplete: { ...defs.outpost.effectsOnComplete, production_energy: 0 },
    };
    state.defs = { ...defs, outpost: noEnergyOutpost };
    const ctl = new GameController(state);
    const r = ctl.queueItem(1, 'metal_mine', 1);
    expect(r.success).toBe(false);
  });

  it('allows zero-upkeep buildings even when energy is at exactly 0', () => {
    // solar_generator costs 0 energy upkeep; should always be queueable
    const state = buildState(defs, { structures: { outpost: 1 } });
    const noEnergyOutpost: ItemDefinition = {
      ...defs.outpost,
      effectsOnComplete: { ...defs.outpost.effectsOnComplete, production_energy: 0 },
    };
    state.defs = { ...defs, outpost: noEnergyOutpost };
    const ctl = new GameController(state);
    const r = ctl.queueItem(1, 'solar_generator', 1);
    expect(r.success).toBe(true);
  });
});
