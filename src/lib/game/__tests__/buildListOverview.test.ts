import { describe, it, expect } from 'vitest';
import { buildOverviewRows } from '../buildListOverview';
import type { LaneEntry } from '../selectors';
import type { PlanProblem } from '../planDiagnostics';

function entry(id: string, startTurn: number | undefined, completionTurn?: number, extra: Partial<LaneEntry> = {}): LaneEntry {
  return {
    id, itemId: id, itemName: id, status: 'pending', quantity: 1, turnsRemaining: 4,
    eta: completionTurn ?? null, startTurn, completionTurn, ...extra,
  };
}

const empty = { building: [], ship: [], colonist: [], research: [] };

describe('buildOverviewRows', () => {
  it('groups entries of every lane by start turn, in turn order', () => {
    const rows = buildOverviewRows({
      ...empty,
      building: [entry('farm', 1, 4), entry('mine', 5, 8)],
      colonist: [entry('scientist', 1, 8)],
      research: [entry('pm', 5, 18)],
    }, []);

    expect(rows.map((row) => row.turn)).toEqual([1, 5]);
    expect(rows[0].cells.building.map((e) => e.id)).toEqual(['farm']);
    expect(rows[0].cells.colonist.map((e) => e.id)).toEqual(['scientist']);
    expect(rows[1].cells.research.map((e) => e.id)).toEqual(['pm']);
  });

  it('adds a row where a problem starts even if nothing starts that turn', () => {
    const problem: PlanProblem = { kind: 'NEGATIVE_ENERGY', turn: 21, endTurn: 24, detail: 'net energy -40/turn' };
    const rows = buildOverviewRows({ ...empty, building: [entry('farm', 1, 4)] }, [problem]);

    expect(rows.map((row) => row.turn)).toEqual([1, 21]);
    expect(rows[1].problems).toEqual([problem]);
  });

  it('collects entries that never start in a final row without a turn', () => {
    const rows = buildOverviewRows({ ...empty, building: [entry('farm', 1, 4), entry('dock', undefined)] }, []);
    expect(rows.at(-1)).toMatchObject({ turn: null });
    expect(rows.at(-1)!.cells.building.map((e) => e.id)).toEqual(['dock']);
  });

  it('skips automatic waits but keeps player waits', () => {
    const rows = buildOverviewRows({
      ...empty,
      building: [entry('auto', 1, 3, { isWait: true, isAutoWait: true }), entry('wait', 4, 6, { isWait: true })],
    }, []);
    expect(rows.flatMap((row) => row.cells.building.map((e) => e.id))).toEqual(['wait']);
  });
});
