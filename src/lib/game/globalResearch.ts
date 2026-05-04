import type { GameState } from './gameState';
import type { ItemDefinition, LaneState, WorkItem } from '../sim/engine/types';
import type { LaneView } from './selectors';
import { generateWorkItemId } from '../sim/engine/helpers';
import { loadGameData } from '../sim/defs/adapter.client';
import gameDataRaw from './game_data.json';

const TOTAL_TURNS = 200;
const RESEARCH_PLAN_MAX_TURN = 1_000_000;
const BASE_PLANET_LIMIT = 4;
const defs: Record<string, ItemDefinition> = loadGameData(gameDataRaw as any);

export interface GlobalResearchSnapshot {
  turn: number;
  stock: number;
  outputPerTurn: number;
  lane: LaneState;
  completed: string[];
  planetLimit: number;
}

export interface PlanetLimitMilestone {
  turn: number;
  limit: number;
  researchId?: string;
}

export interface GlobalResearchPlanView {
  snapshot: GlobalResearchSnapshot;
  completionTurns: Map<string, number>;
  planetLimitMilestones: PlanetLimitMilestone[];
}

function cloneWorkItem(item: WorkItem): WorkItem {
  return { ...item };
}

function cloneLane(lane: LaneState): LaneState {
  return {
    pendingQueue: lane.pendingQueue.map(cloneWorkItem),
    active: lane.active ? cloneWorkItem(lane.active) : null,
    completionHistory: lane.completionHistory.map(cloneWorkItem),
    maxQueueDepth: lane.maxQueueDepth,
  };
}

function scientistOutputAtTurn(gameState: GameState, turn: number): number {
  let total = 0;
  for (const planet of gameState.planets.values()) {
    if (planet.startTurn > turn || !planet.timeline) continue;
    const finalPlanetTurn = planet.startTurn + TOTAL_TURNS - 1;
    const state = planet.timeline.getStateAtTurn(Math.min(turn, finalPlanetTurn));
    total += state?.population.scientists || 0;
  }
  return total;
}

function maxScientistOutputChangeTurn(gameState: GameState): number {
  let maxTurn = 1;
  for (const planet of gameState.planets.values()) {
    if (!planet.timeline) continue;
    maxTurn = Math.max(maxTurn, planet.startTurn + TOTAL_TURNS - 1);
  }
  return maxTurn;
}

function prereqsMet(completed: string[], def: ItemDefinition): boolean {
  return (def.prerequisites || []).every((id) => completed.includes(id));
}

function canResearchOrderProgress(items: WorkItem[], completed: string[]): boolean {
  const available = new Set(completed);
  for (const item of items) {
    if (item.isWait) continue;
    const def = defs[item.itemId];
    if (!def) return false;
    for (const prereqId of def.prerequisites || []) {
      if (!available.has(prereqId)) return false;
    }
    available.add(item.itemId);
  }
  return true;
}

function isBlockedByUnmetFrontPrereq(snapshot: GlobalResearchSnapshot): boolean {
  if (snapshot.lane.active || snapshot.lane.pendingQueue.length === 0) return false;
  const pending = snapshot.lane.pendingQueue[0];
  if (pending.isWait) return false;
  const def = defs[pending.itemId];
  return !def || !prereqsMet(snapshot.completed, def);
}

function isResearchQueuedOrActive(lane: LaneState, itemId: string): boolean {
  return lane.active?.itemId === itemId || lane.pendingQueue.some((item) => item.itemId === itemId);
}

function applyPlanetLimit(current: number, def: ItemDefinition): number {
  const limit = def.effectsOnComplete?.planet_limit;
  return limit ? Math.max(current, limit) : current;
}

function runGlobalResearchTurn(
  gameState: GameState,
  snapshot: GlobalResearchSnapshot
): GlobalResearchSnapshot {
  const lane = cloneLane(snapshot.lane);
  const completed = [...snapshot.completed];
  let stock = snapshot.stock;
  let planetLimit = snapshot.planetLimit;
  const currentTurn = snapshot.turn;

  if (!lane.active && lane.pendingQueue.length > 0) {
    const pending = lane.pendingQueue[0];
    if (pending.isWait) {
      lane.active = {
        ...pending,
        status: 'active',
        startTurn: currentTurn,
      };
      lane.pendingQueue.shift();
    } else {
      const def = defs[pending.itemId];
      const cost = def?.costsPerUnit.research_points || 0;
      if (def && prereqsMet(completed, def) && stock >= cost) {
        stock -= cost;
        lane.active = {
          ...pending,
          status: 'active',
          turnsRemaining: def.durationTurns,
          startTurn: currentTurn,
        };
        lane.pendingQueue.shift();
      }
    }
  }

  if (lane.active) {
    lane.active.turnsRemaining -= 1;
    if (lane.active.turnsRemaining <= 0) {
      const completedItem = {
        ...lane.active,
        status: 'completed' as const,
        completionTurn: currentTurn,
      };
      lane.completionHistory.push(completedItem);
      if (!completedItem.isWait && !completed.includes(completedItem.itemId)) {
        completed.push(completedItem.itemId);
        const def = defs[completedItem.itemId];
        if (def) {
          planetLimit = applyPlanetLimit(planetLimit, def);
        }
      }
      lane.active = null;
    }
  }

  const outputPerTurn = scientistOutputAtTurn(gameState, currentTurn);
  stock += outputPerTurn;

  return {
    turn: currentTurn + 1,
    stock,
    outputPerTurn,
    lane,
    completed,
    planetLimit,
  };
}

function createInitialSnapshot(gameState: GameState): GlobalResearchSnapshot {
  const snapshot: GlobalResearchSnapshot = {
    turn: 1,
    stock: gameState.globalResearch.stock || 0,
    outputPerTurn: scientistOutputAtTurn(gameState, 1),
    lane: cloneLane(gameState.globalResearch.lane),
    completed: [...(gameState.globalResearch.completed || [])],
    planetLimit: BASE_PLANET_LIMIT,
  };

  for (const researchId of snapshot.completed) {
    const def = defs[researchId];
    if (def) snapshot.planetLimit = applyPlanetLimit(snapshot.planetLimit, def);
  }

  return snapshot;
}

function getPendingResearchStockCost(snapshot: GlobalResearchSnapshot): number | null {
  if (snapshot.lane.active || snapshot.lane.pendingQueue.length === 0) {
    return null;
  }

  const pending = snapshot.lane.pendingQueue[0];
  if (pending.isWait) {
    return null;
  }

  const def = defs[pending.itemId];
  if (!def || !prereqsMet(snapshot.completed, def)) {
    return null;
  }

  const cost = def.costsPerUnit.research_points || 0;
  return snapshot.stock < cost ? cost : null;
}

function advanceResearchStockWait(
  gameState: GameState,
  snapshot: GlobalResearchSnapshot,
  targetStock: number,
  maxTurn: number
): GlobalResearchSnapshot {
  let stock = snapshot.stock;
  let turn = snapshot.turn;
  const variableOutputEnd = maxScientistOutputChangeTurn(gameState);

  while (stock < targetStock && turn <= maxTurn && turn <= variableOutputEnd) {
    stock += scientistOutputAtTurn(gameState, turn);
    turn += 1;
  }

  if (stock < targetStock && turn <= maxTurn) {
    const outputPerTurn = scientistOutputAtTurn(gameState, turn);
    if (outputPerTurn > 0) {
      const turnsNeeded = Math.ceil((targetStock - stock) / outputPerTurn);
      const turnsToApply = Math.min(turnsNeeded, maxTurn - turn + 1);
      stock += turnsToApply * outputPerTurn;
      turn += turnsToApply;
    } else {
      turn = maxTurn + 1;
    }
  }

  if (turn === snapshot.turn) {
    return snapshot;
  }

  return {
    ...snapshot,
    turn,
    stock,
    outputPerTurn: scientistOutputAtTurn(gameState, Math.max(1, turn - 1)),
  };
}

function advanceResearchStockThroughTurn(
  gameState: GameState,
  snapshot: GlobalResearchSnapshot,
  targetTurn: number
): GlobalResearchSnapshot {
  let stock = snapshot.stock;
  let turn = snapshot.turn;
  const target = Math.min(RESEARCH_PLAN_MAX_TURN, targetTurn);
  const variableOutputEnd = maxScientistOutputChangeTurn(gameState);

  while (turn <= target && turn <= variableOutputEnd) {
    stock += scientistOutputAtTurn(gameState, turn);
    turn += 1;
  }

  if (turn <= target) {
    const outputPerTurn = scientistOutputAtTurn(gameState, turn);
    if (outputPerTurn > 0) {
      stock += (target - turn + 1) * outputPerTurn;
    }
    turn = target + 1;
  }

  return {
    ...snapshot,
    turn,
    stock,
    outputPerTurn: scientistOutputAtTurn(gameState, target),
  };
}

function simulateGlobalResearch(
  gameState: GameState,
  targetTurn: number,
  untilLaneSettled = false
): GlobalResearchSnapshot {
  let snapshot = createInitialSnapshot(gameState);
  const target = Math.max(1, Math.min(RESEARCH_PLAN_MAX_TURN, targetTurn));

  while (
    snapshot.turn <= RESEARCH_PLAN_MAX_TURN &&
    (snapshot.turn <= target || (untilLaneSettled && (snapshot.lane.active || snapshot.lane.pendingQueue.length > 0)))
  ) {
    const stockCost = getPendingResearchStockCost(snapshot);
    if (stockCost !== null) {
      snapshot = advanceResearchStockWait(
        gameState,
        snapshot,
        stockCost,
        untilLaneSettled ? RESEARCH_PLAN_MAX_TURN : target
      );
      if (!untilLaneSettled && snapshot.turn > target) {
        break;
      }
      if (untilLaneSettled && snapshot.turn > RESEARCH_PLAN_MAX_TURN) {
        break;
      }
    }

    if (isBlockedByUnmetFrontPrereq(snapshot)) {
      snapshot = advanceResearchStockThroughTurn(gameState, snapshot, target);
      break;
    }

    snapshot = runGlobalResearchTurn(gameState, snapshot);
  }

  return {
    ...snapshot,
    turn: Math.min(target, snapshot.turn),
    outputPerTurn: scientistOutputAtTurn(gameState, target),
    lane: cloneLane(snapshot.lane),
    completed: [...snapshot.completed],
  };
}

export function getGlobalResearchAtTurn(gameState: GameState, turn: number): GlobalResearchSnapshot {
  return simulateGlobalResearch(gameState, turn);
}

function buildPlanView(gameState: GameState): GlobalResearchPlanView {
  const snapshot = simulateGlobalResearch(gameState, TOTAL_TURNS, true);
  const completionTurns = new Map<string, number>();
  const planetLimitMilestones: Array<PlanetLimitMilestone & { order: number }> = [];
  let order = 0;

  for (const researchId of gameState.globalResearch.completed || []) {
    const def = defs[researchId];
    const limit = def?.effectsOnComplete?.planet_limit;
    if (limit) {
      planetLimitMilestones.push({ turn: 1, limit, researchId, order: order++ });
    }
  }

  for (const item of snapshot.lane.completionHistory) {
    if (item.isWait || item.completionTurn === undefined) {
      continue;
    }

    completionTurns.set(item.itemId, item.completionTurn);

    const def = defs[item.itemId];
    const limit = def?.effectsOnComplete?.planet_limit;
    if (limit) {
      planetLimitMilestones.push({
        turn: item.completionTurn,
        limit,
        researchId: item.itemId,
        order: order++,
      });
    }
  }

  planetLimitMilestones.sort((a, b) => {
    if (a.turn !== b.turn) return a.turn - b.turn;
    if (a.limit !== b.limit) return a.limit - b.limit;
    return a.order - b.order;
  });

  return {
    snapshot,
    completionTurns,
    planetLimitMilestones: planetLimitMilestones.map(({ order: _order, ...milestone }) => milestone),
  };
}

export function getGlobalResearchPlanView(gameState: GameState): GlobalResearchPlanView {
  return buildPlanView(gameState);
}

function getPlanetLimitFromMilestones(milestones: PlanetLimitMilestone[], turn: number): number {
  let limit = BASE_PLANET_LIMIT;
  for (const milestone of milestones) {
    if (milestone.turn > turn) break;
    limit = Math.max(limit, milestone.limit);
  }
  return limit;
}

export function getPlanetLimitAtTurn(gameState: GameState, turn: number): number {
  const lane = gameState.globalResearch.lane;
  if (
    gameState.globalResearch.completed.length === 0 &&
    !lane.active &&
    lane.pendingQueue.length === 0 &&
    lane.completionHistory.length === 0
  ) {
    return BASE_PLANET_LIMIT;
  }
  return getPlanetLimitFromMilestones(getGlobalResearchPlanView(gameState).planetLimitMilestones, turn);
}

export function getEarliestPlanetStartTurn(
  gameState: GameState,
  planetNumber: number,
  fromTurn: number = 1
): number | null {
  const startTurn = Math.max(1, fromTurn);
  if (planetNumber <= BASE_PLANET_LIMIT) {
    return startTurn;
  }

  const { planetLimitMilestones } = getGlobalResearchPlanView(gameState);
  if (getPlanetLimitFromMilestones(planetLimitMilestones, startTurn) >= planetNumber) {
    return startTurn;
  }

  for (const milestone of planetLimitMilestones) {
    if (milestone.turn >= startTurn && getPlanetLimitFromMilestones(planetLimitMilestones, milestone.turn) >= planetNumber) {
      return milestone.turn;
    }
  }
  return null;
}

export function getResearchCompletionTurns(gameState: GameState): Map<string, number> {
  const lane = gameState.globalResearch.lane;
  if (!lane.active && lane.pendingQueue.length === 0 && lane.completionHistory.length === 0) {
    return new Map();
  }
  return getGlobalResearchPlanView(gameState).completionTurns;
}

export function getCompletedResearchAtTurn(gameState: GameState, turn: number): string[] {
  return getGlobalResearchAtTurn(gameState, turn).completed;
}

export function getGlobalResearchLaneView(gameState: GameState, turn: number): LaneView {
  const planSnapshot = getGlobalResearchPlanView(gameState).snapshot;
  const entries: Array<{ entry: LaneView['entries'][number]; order: number }> = [];
  let order = 0;

  const addEntry = (item: WorkItem) => {
    const start = item.startTurn;
    const finish = item.completionTurn;
    let status: 'pending' | 'active' | 'completed' = 'pending';
    if (finish !== undefined && finish <= turn) {
      status = 'completed';
    } else if (start !== undefined && start <= turn) {
      status = 'active';
    }

    entries.push({
      order: order++,
      entry: {
        id: item.id,
        itemId: item.itemId,
        itemName: item.isWait ? 'Wait' : defs[item.itemId]?.name || item.itemId,
        status,
        quantity: item.quantity,
        turnsRemaining: item.turnsRemaining,
        eta: finish ?? null,
        queuedTurn: item.queuedTurn,
        startTurn: item.startTurn,
        completionTurn: item.completionTurn,
        isWait: item.isWait,
        isAutoWait: item.isAutoWait,
      },
    });
  };

  for (const completed of planSnapshot.lane.completionHistory) {
    addEntry(completed);
  }

  if (planSnapshot.lane.active) {
    addEntry(planSnapshot.lane.active);
  }

  for (const pending of planSnapshot.lane.pendingQueue) {
    addEntry(pending);
  }

  entries.sort((a, b) => {
    const finishA = a.entry.completionTurn ?? a.entry.eta ?? Number.MAX_SAFE_INTEGER;
    const finishB = b.entry.completionTurn ?? b.entry.eta ?? Number.MAX_SAFE_INTEGER;
    if (finishA !== finishB) return finishA - finishB;

    const startA = a.entry.startTurn ?? a.entry.queuedTurn ?? finishA;
    const startB = b.entry.startTurn ?? b.entry.queuedTurn ?? finishB;
    if (startA !== startB) return startA - startB;

    return a.order - b.order;
  });

  return { laneId: 'research', entries: entries.map(({ entry }) => entry) };
}

export function canQueueGlobalResearch(gameState: GameState, itemId: string): { allowed: boolean; reason?: string } {
  const def = defs[itemId];
  if (!def || def.lane !== 'research') return { allowed: false, reason: 'Unknown research' };
  const lane = gameState.globalResearch.lane;
  const completed = gameState.globalResearch.completed || [];
  if (completed.includes(itemId) || isResearchQueuedOrActive(lane, itemId)) {
    return { allowed: false, reason: 'Already researched or queued' };
  }
  for (const prereqId of def.prerequisites || []) {
    if (!completed.includes(prereqId) && !isResearchQueuedOrActive(lane, prereqId)) {
      return { allowed: false, reason: 'REQ_MISSING' };
    }
  }
  return { allowed: true };
}

export function queueGlobalResearch(gameState: GameState, itemId: string, preserveId?: string): GameState {
  const check = canQueueGlobalResearch(gameState, itemId);
  if (!check.allowed) throw new Error(check.reason || 'Cannot queue research');
  const def = defs[itemId];
  const item: WorkItem = {
    id: preserveId ?? generateWorkItemId(),
    itemId,
    status: 'pending',
    quantity: 1,
    turnsRemaining: def.durationTurns,
    queuedTurn: 1,
  };
  return {
    ...gameState,
    globalResearch: {
      ...gameState.globalResearch,
      lane: {
        ...gameState.globalResearch.lane,
        pendingQueue: [...gameState.globalResearch.lane.pendingQueue, item],
      },
    },
  };
}

export function queueGlobalResearchWait(gameState: GameState, turns: number, preserveId?: string): GameState {
  const item: WorkItem = {
    id: preserveId ?? generateWorkItemId(),
    itemId: '__wait__',
    status: 'pending',
    quantity: 1,
    turnsRemaining: turns,
    queuedTurn: 1,
    isWait: true,
  };
  return {
    ...gameState,
    globalResearch: {
      ...gameState.globalResearch,
      lane: {
        ...gameState.globalResearch.lane,
        pendingQueue: [...gameState.globalResearch.lane.pendingQueue, item],
      },
    },
  };
}

export function cancelGlobalResearch(gameState: GameState, entryId: string): GameState {
  const lane = cloneLane(gameState.globalResearch.lane);
  if (lane.active?.id === entryId) {
    lane.active = null;
  }
  lane.pendingQueue = lane.pendingQueue.filter((item) => item.id !== entryId);
  return {
    ...gameState,
    globalResearch: {
      ...gameState.globalResearch,
      lane,
    },
  };
}

export function reorderGlobalResearch(gameState: GameState, entryId: string, newIndex: number): GameState {
  const lane = cloneLane(gameState.globalResearch.lane);
  const all = [
    ...(lane.active ? [{ ...lane.active, status: 'pending' as const }] : []),
    ...lane.pendingQueue,
  ];
  const oldIndex = all.findIndex((item) => item.id === entryId);
  if (oldIndex === -1) return gameState;
  const [item] = all.splice(oldIndex, 1);
  all.splice(Math.max(0, Math.min(newIndex, all.length)), 0, item);
  if (!canResearchOrderProgress(all, gameState.globalResearch.completed || [])) {
    return gameState;
  }
  lane.active = null;
  lane.pendingQueue = all;
  return {
    ...gameState,
    globalResearch: {
      ...gameState.globalResearch,
      lane,
    },
  };
}
