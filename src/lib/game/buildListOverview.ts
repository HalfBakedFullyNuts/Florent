/**
 * Turn-aligned view of a planet's whole build list: one row per turn where an entry starts
 * (or a plan problem begins), with each lane's entries side by side.
 */

import type { LaneId } from '../sim/engine/types';
import type { LaneEntry } from './selectors';
import type { PlanProblem } from './planDiagnostics';

export const OVERVIEW_LANES: LaneId[] = ['building', 'ship', 'colonist', 'research'];

export interface OverviewRow {
  /** Start turn of the row's entries; null collects entries that never start. */
  turn: number | null;
  cells: Record<LaneId, LaneEntry[]>;
  /** Plan-wide problems (energy, stock) that begin on this turn. */
  problems: PlanProblem[];
}

function emptyCells(): Record<LaneId, LaneEntry[]> {
  return { building: [], ship: [], colonist: [], research: [] };
}

export function buildOverviewRows(lanes: Record<LaneId, LaneEntry[]>, problems: PlanProblem[]): OverviewRow[] {
  const byTurn = new Map<number | null, OverviewRow>();
  const rowFor = (turn: number | null): OverviewRow => {
    let row = byTurn.get(turn);
    if (!row) {
      row = { turn, cells: emptyCells(), problems: [] };
      byTurn.set(turn, row);
    }
    return row;
  };

  for (const laneId of OVERVIEW_LANES) {
    for (const entry of lanes[laneId]) {
      if (entry.isAutoWait) continue;
      rowFor(entry.startTurn ?? null).cells[laneId].push(entry);
    }
  }
  // Entry problems show on their entry; only plan-wide ones need a row of their own.
  for (const problem of problems) {
    if (!problem.entryId) rowFor(problem.turn).problems.push(problem);
  }

  return [...byTurn.values()].sort((a, b) => (a.turn ?? Number.POSITIVE_INFINITY) - (b.turn ?? Number.POSITIVE_INFINITY));
}
