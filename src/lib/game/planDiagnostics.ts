/**
 * Plan diagnostics: scans a planet's simulated timeline for states a real game would not allow
 * (negative net energy, negative stocks or idle workers, entries that never start, batches cut short)
 * and compares two scans so a queue change can be checked for problems it introduces.
 */

import type { LaneId, PlanetState, WorkItem } from '../sim/engine/types';
import { getDefs } from '../sim/engine/defsRegistry';
import { computeNetOutputsPerTurn } from '../sim/engine/outputs';

export type PlanProblemKind =
  | 'NEGATIVE_ENERGY'
  | 'NEGATIVE_STOCK'
  | 'NEVER_STARTS'
  | 'BATCH_REDUCED'
  | 'DELAYED';

export interface PlanProblem {
  kind: PlanProblemKind;
  /** First turn the problem applies. */
  turn: number;
  /** Last turn of a continuous range (energy / stock problems). */
  endTurn?: number;
  laneId?: LaneId;
  entryId?: string;
  itemId?: string;
  /** Short, player-facing explanation. */
  detail: string;
}

export interface PlanDiagnosis {
  problems: PlanProblem[];
  /** Start turn of every plan entry (null = never starts within the horizon). */
  starts: Map<string, number | null>;
  /** Item and lane of every plan entry, so delays can be named and highlighted. */
  items: Map<string, { itemId: string; laneId: LaneId }>;
}

export interface PlanProblemText {
  turnLabel: string;
  title: string;
  detail: string;
}

const PROBLEM_TITLES: Record<PlanProblemKind, (name: string) => string> = {
  NEGATIVE_ENERGY: () => 'Energy output negative',
  NEGATIVE_STOCK: () => 'Spending stock that is not there',
  NEVER_STARTS: (name) => `${name} never starts`,
  BATCH_REDUCED: (name) => `${name} batch cut short`,
  DELAYED: (name) => `${name} delayed`,
};

type StateAt = (turn: number) => PlanetState | undefined;

const LANES: LaneId[] = ['building', 'ship', 'colonist'];
const STOCKS = ['metal', 'mineral', 'food', 'energy'] as const;

/** Scans turns firstTurn..lastTurn of one planet and lists its problems. */
export function diagnosePlan(stateAt: StateAt, firstTurn: number, lastTurn: number): PlanDiagnosis {
  const first = stateAt(firstTurn);
  const last = stateAt(lastTurn) ?? lastComputedState(stateAt, firstTurn, lastTurn);
  if (!first || !last) return { problems: [], starts: new Map(), items: new Map() };

  const problems = [
    ...collectRangeProblems(stateAt, firstTurn, last.currentTurn),
    ...collectEntryProblems(first, last),
  ];
  const items = new Map(LANES.flatMap((laneId) => planEntriesIn(first, laneId).map((item): [string, { itemId: string; laneId: LaneId }] => [item.id, { itemId: item.itemId, laneId }])));
  return { problems, starts: collectStarts(first, last), items };
}

/** Player-facing turn label, headline and detail for one problem. */
export function describePlanProblem(problem: PlanProblem, nameOf: (itemId: string) => string): PlanProblemText {
  const range = problem.endTurn !== undefined && problem.endTurn !== problem.turn;
  return {
    turnLabel: range ? `T${problem.turn}–T${problem.endTurn}` : `T${problem.turn}`,
    title: PROBLEM_TITLES[problem.kind](problem.itemId ? nameOf(problem.itemId) : 'An entry'),
    detail: problem.detail,
  };
}

function lastComputedState(stateAt: StateAt, firstTurn: number, lastTurn: number): PlanetState | undefined {
  for (let turn = lastTurn; turn >= firstTurn; turn--) {
    const state = stateAt(turn);
    if (state) return state;
  }
  return undefined;
}

/** Per-turn conditions grouped into continuous ranges: one problem per range. */
function collectRangeProblems(stateAt: StateAt, firstTurn: number, lastTurn: number): PlanProblem[] {
  const open = new Map<string, PlanProblem>();
  const closed: PlanProblem[] = [];

  for (let turn = firstTurn; turn <= lastTurn; turn++) {
    const state = stateAt(turn);
    if (!state) break;
    const active = new Map<string, Omit<PlanProblem, 'turn'>>();
    const netEnergy = computeNetOutputsPerTurn(state).energy;
    if (netEnergy < 0) active.set('energy-net', { kind: 'NEGATIVE_ENERGY', detail: `net energy ${Math.round(netEnergy)}/turn` });
    for (const resource of STOCKS) {
      if (state.stocks[resource] < 0) active.set(`stock-${resource}`, { kind: 'NEGATIVE_STOCK', detail: `${resource} stock below zero` });
    }
    if (state.population.workersIdle < 0) active.set('stock-workers', { kind: 'NEGATIVE_STOCK', detail: 'more workers busy than available' });
    advanceRanges(open, closed, active, turn);
  }
  closed.push(...open.values());
  return closed;
}

function advanceRanges(
  open: Map<string, PlanProblem>,
  closed: PlanProblem[],
  active: Map<string, Omit<PlanProblem, 'turn'>>,
  turn: number,
): void {
  for (const [key, problem] of open) {
    if (active.has(key)) continue;
    closed.push(problem);
    open.delete(key);
  }
  for (const [key, problem] of active) {
    const running = open.get(key);
    if (running) running.endTurn = turn;
    else open.set(key, { ...problem, turn, endTurn: turn });
  }
}

/** Entry-level problems: never started by the horizon, or activated with fewer units than planned. */
function collectEntryProblems(first: PlanetState, last: PlanetState): PlanProblem[] {
  const problems: PlanProblem[] = [];
  const requested = new Map(planEntries(first).map((item) => [item.id, item.quantity]));
  for (const laneId of LANES) {
    const lane = last.lanes[laneId];
    for (const item of lane.pendingQueue) {
      if (item.isWait || !requested.has(item.id)) continue;
      problems.push({ kind: 'NEVER_STARTS', turn: last.currentTurn, laneId, entryId: item.id, itemId: item.itemId, detail: neverStartsDetail(last, item) });
    }
    for (const item of [...lane.completionHistory, ...(lane.active ? [lane.active] : [])]) {
      const planned = requested.get(item.id);
      if (item.isWait || planned === undefined || item.quantity >= planned) continue;
      problems.push({ kind: 'BATCH_REDUCED', turn: item.startTurn ?? last.currentTurn, laneId, entryId: item.id, itemId: item.itemId, detail: `only ${item.quantity} of ${planned} could start` });
    }
  }
  return problems;
}

function neverStartsDetail(state: PlanetState, item: WorkItem): string {
  const defs = getDefs();
  const def = defs[item.itemId];
  const missing = (def?.prerequisites ?? []).filter(
    (id) => (state.completedCounts[id] || 0) <= 0 && !state.completedResearch?.includes(id),
  );
  if (missing.length > 0) return `never starts: missing ${missing.map((id) => defs[id]?.name ?? id).join(', ')}`;
  return 'never starts: resources, workers or housing never become available';
}

function planEntriesIn(state: PlanetState, laneId: LaneId): WorkItem[] {
  const lane = state.lanes[laneId];
  return [...(lane.active ? [lane.active] : []), ...lane.pendingQueue].filter((item) => !item.isWait);
}

function planEntries(state: PlanetState): WorkItem[] {
  return LANES.flatMap((laneId) => planEntriesIn(state, laneId));
}

function collectStarts(first: PlanetState, last: PlanetState): Map<string, number | null> {
  const started = new Map<string, number>();
  for (const laneId of LANES) {
    const lane = last.lanes[laneId];
    for (const item of [...lane.completionHistory, ...(lane.active ? [lane.active] : [])]) {
      if (item.startTurn !== undefined) started.set(item.id, item.startTurn);
    }
  }
  return new Map(planEntries(first).map((item) => [item.id, started.get(item.id) ?? null]));
}

/** Problems in `after` that `before` didn't have, plus existing entries the change pushed later. */
export function findNewProblems(
  before: PlanDiagnosis,
  after: PlanDiagnosis,
  options: { changedEntryId?: string } = {},
): PlanProblem[] {
  const known = new Set(before.problems.map(problemKey));
  const added = after.problems.filter((problem) => !known.has(problemKey(problem)));
  return [...added, ...findDelays(before, after, options.changedEntryId)];
}

function problemKey(problem: PlanProblem): string {
  return problem.entryId ? `${problem.kind}:${problem.entryId}` : `${problem.kind}:${problem.detail.split(' ')[0]}:${problem.turn}`;
}

function findDelays(before: PlanDiagnosis, after: PlanDiagnosis, changedEntryId?: string): PlanProblem[] {
  const delays: PlanProblem[] = [];
  for (const [entryId, oldStart] of before.starts) {
    if (entryId === changedEntryId || oldStart === null || !after.starts.has(entryId)) continue;
    const newStart = after.starts.get(entryId) ?? null;
    if (newStart !== null && newStart <= oldStart) continue;
    const item = after.items?.get(entryId) ?? before.items?.get(entryId);
    delays.push({
      kind: 'DELAYED',
      turn: newStart ?? oldStart,
      entryId,
      ...(item ? { itemId: item.itemId, laneId: item.laneId } : {}),
      detail: newStart === null ? `no longer starts (was T${oldStart})` : `starts T${newStart} instead of T${oldStart}`,
    });
  }
  return delays;
}
