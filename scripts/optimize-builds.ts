#!/usr/bin/env node
/**
 * IC Build List Optimizer
 *
 * Reverse-engineers optimal homeworld build orders using beam search over
 * plan sequences. The deterministic simulation engine drives all activation
 * timing and resource stalling — no analytical approximations needed.
 *
 * Algorithm: Beam Search over ordered build plans
 *   State      = ordered list of itemIds committed to their lane queues at T=1
 *   Branch     = append one candidate item (prereqs must already be in plan)
 *   Prune      = keep top-K candidates after scoring (beam width K)
 *   Score      = objective function evaluated by full 200-turn simulation
 *   Terminate  = no score improvement for several consecutive depth steps
 *
 * Starting premise: the homeworld's free outpost ship has already been used
 * for the first colony. We're finding the fastest way to build the NEXT one
 * (or as many as possible by T200).
 *
 * Usage:
 *   npx tsx scripts/optimize-builds.ts [objective] [options]
 *
 * Objectives (default: fastest-outpost-ship):
 *   fastest-outpost-ship   Minimise the turn on which the first new outpost ship completes
 *   max-outposts-t200      Maximise outpost ships produced by turn 200
 *
 * Options:
 *   --beam N     Beam width (default 20, higher = more thorough but slower)
 *   --verbose    Print each depth step during search
 */

import * as path from 'path';
import * as fs from 'fs';

import { loadGameData } from '../src/lib/sim/defs/adapter';
import { createStandardStart } from '../src/lib/sim/defs/seed';
import { runTurn } from '../src/lib/sim/engine/turn';
import { tryActivateNext } from '../src/lib/sim/engine/lanes';
import { CompletionBuffer } from '../src/lib/sim/engine/buffers';
import { LANE_ORDER } from '../src/lib/sim/rules/constants';
import type {
  PlanetState,
  ItemDefinition,
  WorkItem,
  LaneState,
  LaneId,
} from '../src/lib/sim/engine/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimResult {
  /** Turn on which target item count first exceeds the starting baseline. */
  firstTargetTurn: number | null;
  /** Net new completions of target item at end of simulation. */
  countAtEnd: number;
  endTurn: number;
}

interface Candidate {
  plan: string[];
  result: SimResult;
  score: number;
  /** Running net energy balance of the plan (must stay ≥ 0 at every step). */
  netEnergy: number;
}

interface Objective {
  id: string;
  label: string;
  targetItem: string;
  /** [itemId, maxTimesAllowedInPlan] pairs the optimizer may use */
  candidates: Array<[string, number]>;
  stopEarly: boolean;
  /**
   * Primary score used for beam ranking and final result.
   * Receives the sim result AND the current plan so it can apply a
   * prerequisite-chain heuristic when the target hasn't been reached yet.
   */
  score: (r: SimResult, plan: string[]) => number;
}

// ─── Objectives ───────────────────────────────────────────────────────────────

// Prerequisite-chain heuristic: gives partial credit when the target hasn't
// been produced yet. Guides the beam toward the mandatory build path even
// during early depth steps where all 200-turn simulations still score 0.
// Scale: each prerequisite milestone is worth more than any resource prep.
function prereqHeuristic(plan: string[]): number {
  let h = 0;
  // Worker-growth enablers (must come before shipyard workers are achievable)
  if (plan.includes('living_quarters')) h += 100; // housing cap 50k→100k (mandatory)
  if (plan.includes('leisure_centre'))  h +=  80; // +0.5% growth / turn
  // Mandatory prerequisite chain
  if (plan.includes('launch_site'))     h += 200;
  if (plan.includes('shipyard'))        h += 400;
  // Energy coverage (each building costs 10/turn upkeep; need extras before shipyard)
  const solars = plan.filter(x => x === 'solar_generator').length;
  h += Math.min(solars, 4) * 20;   // up to 4 extra solars worth crediting
  return h;
}

const OBJECTIVES: Record<string, Objective> = {
  'fastest-outpost-ship': {
    id: 'fastest-outpost-ship',
    label: 'Fastest Outpost Ship',
    targetItem: 'outpost_ship',
    candidates: [
      // Resource + energy producers
      ['metal_mine',         8],
      ['mineral_extractor',  5],
      ['farm',               5],
      ['solar_generator',    6],  // critical: each building costs 10 energy upkeep
      // Worker growth — shipyard needs 60k workers; housing cap starts at 50k
      //   → living_quarters (50k cap, 6T) is mandatory
      //   → leisure_centre (+0.5% growth, 8T, needs only 10k workers) helps a lot
      ['living_quarters',    3],
      ['leisure_centre',     2],
      // Prerequisite chain
      ['launch_site',        1],
      ['shipyard',           1],
      ['outpost_ship',       1],  // ship lane
    ],
    stopEarly: true,
    score: (r, plan) =>
      r.firstTargetTurn !== null
        ? 10000 - r.firstTargetTurn        // maximise: earlier first ship = higher score
        : -500 + prereqHeuristic(plan),    // guide beam toward prerequisite chain
  },
  'max-outposts-t200': {
    id: 'max-outposts-t200',
    label: 'Maximum Outpost Ships by Turn 200',
    targetItem: 'outpost_ship',
    candidates: [
      ['metal_mine',         9],
      ['mineral_extractor',  5],
      ['farm',               5],
      ['solar_generator',    6],
      ['living_quarters',    4],
      ['leisure_centre',     2],
      ['launch_site',        1],
      ['shipyard',           1],
      ['outpost_ship',      20],
    ],
    stopEarly: false,
    score: (r, plan) =>
      r.countAtEnd > 0
        ? r.countAtEnd * 1000 - (r.firstTargetTurn ?? 200)  // more ships first, then earlier
        : -500 + prereqHeuristic(plan),
  },
};

// ─── Fast state clone ─────────────────────────────────────────────────────────
// Avoids JSON.parse/JSON.stringify from helpers.ts.
// completionHistory is omitted (not needed for scoring).
// `defs` and `abundance` are shared references (never mutated).

function cloneWorkItem(w: WorkItem): WorkItem {
  return {
    id: w.id, itemId: w.itemId, status: w.status, quantity: w.quantity,
    turnsRemaining: w.turnsRemaining, queuedTurn: w.queuedTurn,
    startTurn: w.startTurn, completionTurn: w.completionTurn,
    minStartTurn: w.minStartTurn, isWait: w.isWait, isAutoWait: w.isAutoWait,
    scheduledResearch: w.scheduledResearch ? [...w.scheduledResearch] : undefined,
    blockedResearch: w.blockedResearch ? [...w.blockedResearch] : undefined,
  };
}

function cloneLane(lane: LaneState): LaneState {
  return {
    pendingQueue: lane.pendingQueue.map(cloneWorkItem),
    active: lane.active ? cloneWorkItem(lane.active) : null,
    completionHistory: [],
    maxQueueDepth: lane.maxQueueDepth,
  };
}

function fastClone(state: PlanetState): PlanetState {
  return {
    currentTurn: state.currentTurn,
    stocks: { ...state.stocks },
    abundance: state.abundance,
    population: {
      workersTotal: state.population.workersTotal,
      workersIdle: state.population.workersIdle,
      soldiers: state.population.soldiers,
      scientists: state.population.scientists,
      busyByLane: { ...state.population.busyByLane },
    },
    space: { ...state.space },
    housing: { ...state.housing },
    planetLimit: state.planetLimit,
    completedResearch: [...state.completedResearch],
    lanes: {
      building: cloneLane(state.lanes.building),
      ship:     cloneLane(state.lanes.ship),
      colonist: cloneLane(state.lanes.colonist),
      research: cloneLane(state.lanes.research),
    },
    completedCounts: { ...state.completedCounts },
    pendingColonistConversions: state.pendingColonistConversions.map(cloneWorkItem),
    defs: state.defs,
  };
}

// ─── Optimizer base state ─────────────────────────────────────────────────────

/**
 * Derive the optimizer starting state from the standard homeworld.
 * The free outpost_ship the game grants has already been dispatched
 * to colonise the first planet — remove it so the optimizer measures
 * the time to produce the *next* one from scratch.
 */
function createOptimizerBase(defs: Record<string, ItemDefinition>): PlanetState {
  const state = createStandardStart(defs);
  delete (state.completedCounts as Record<string, number>)['outpost_ship'];
  return state;
}

// ─── Plan application ─────────────────────────────────────────────────────────

let _idCounter = 0;

/**
 * Queue every item in `plan` into its lane at T=1, then fire the first
 * activation for each lane. The engine handles all subsequent timing.
 */
function applyPlan(
  baseState: PlanetState,
  plan: string[],
  defs: Record<string, ItemDefinition>,
): PlanetState {
  const state = fastClone(baseState);

  for (const itemId of plan) {
    const def = defs[itemId];
    if (!def) continue;
    const laneId = def.lane as LaneId;
    state.lanes[laneId].pendingQueue.push({
      id: `opt_${++_idCounter}`, itemId, status: 'pending',
      quantity: 1, turnsRemaining: def.durationTurns, queuedTurn: 1,
    });
  }

  for (const laneId of LANE_ORDER as LaneId[]) {
    if (state.lanes[laneId].pendingQueue.length > 0 && !state.lanes[laneId].active) {
      tryActivateNext(state, laneId);
    }
  }

  return state;
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function simulatePlan(
  initialState: PlanetState,
  maxTurns: number,
  targetItem: string,
  stopEarly: boolean,
): SimResult {
  const state = initialState;
  const buffer = new CompletionBuffer();
  let firstTargetTurn: number | null = null;

  for (let t = 0; t < maxTurns; t++) {
    runTurn(state, buffer);
    if (firstTargetTurn === null && (state.completedCounts[targetItem] ?? 0) > 0) {
      firstTargetTurn = state.currentTurn;
      if (stopEarly) break;
    }
  }

  return {
    firstTargetTurn,
    countAtEnd: state.completedCounts[targetItem] ?? 0,
    endTurn: state.currentTurn,
  };
}

function evalPlan(
  baseState: PlanetState,
  plan: string[],
  defs: Record<string, ItemDefinition>,
  objective: Objective,
  netEnergy: number,
): Candidate {
  const state = applyPlan(baseState, plan, defs);
  const result = simulatePlan(state, 200, objective.targetItem, objective.stopEarly);
  return { plan, result, score: objective.score(result, plan), netEnergy };
}

// ─── Energy tracking ─────────────────────────────────────────────────────────

/** Net energy produced per completed unit (positive = produces, negative = consumes). */
function itemEnergyDelta(def: ItemDefinition): number {
  return (def.effectsOnComplete?.production_energy ?? 0)
       - (def.upkeepPerUnit?.energy ?? 0);
}

/**
 * Compute the net energy balance of the base state (from its completedCounts).
 * This is the starting value all plans begin from.
 */
function baseNetEnergy(
  baseState: PlanetState,
  defs: Record<string, ItemDefinition>,
): number {
  let net = 0;
  for (const [id, cnt] of Object.entries(baseState.completedCounts)) {
    const def = defs[id];
    if (def) net += itemEnergyDelta(def) * cnt;
  }
  return net;
}

// ─── Candidate validity ───────────────────────────────────────────────────────

/**
 * Returns true if `itemId` can legally be appended to `plan`.
 *
 * Three constraints must hold:
 *  1. All prerequisites satisfied — either in baseCompleted (already built
 *     in the starting state) or present earlier in the plan.
 *  2. Max-repeat budget not exceeded for this item.
 *  3. Net energy remains ≥ 0 after this item completes — mirrors the real
 *     game's energyNonNegativeAfterCompletion guard in canQueue. Without this,
 *     the optimizer generates plans the game would hard-block at queue time.
 *
 * Worker, resource, and space constraints are enforced by the engine at
 * activation time inside the simulation, so no pre-check is needed here.
 */
function canAppend(
  plan: string[],
  currentNetEnergy: number,
  itemId: string,
  maxCount: number,
  def: ItemDefinition,
  baseCompleted: ReadonlySet<string>,
): boolean {
  // 1. Repeat budget
  let count = 0;
  for (const id of plan) if (id === itemId) count++;
  if (count >= maxCount) return false;

  // 2. Prerequisites
  for (const prereqId of def.prerequisites) {
    if (!baseCompleted.has(prereqId) && !plan.includes(prereqId)) return false;
  }

  // 3. Energy balance (real game blocks queueing items that would push net energy < 0)
  if (currentNetEnergy + itemEnergyDelta(def) < 0) return false;

  return true;
}

// ─── Beam search ──────────────────────────────────────────────────────────────

function beamSearch(
  baseState: PlanetState,
  defs: Record<string, ItemDefinition>,
  objective: Objective,
  beamWidth: number,
  verbose: boolean,
): Candidate {
  const MAX_DEPTH = 50;
  const STALE_LIMIT = 12; // Heuristic guides beam so score rarely stalls; bigger safety margin
  const seen = new Set<string>();
  const planKey = (plan: string[]) => plan.join(',');

  // Items already present in the base state satisfy prerequisites without
  // needing to be queued again.
  const baseCompleted = new Set<string>([
    ...Object.entries(baseState.completedCounts)
      .filter(([, cnt]) => cnt > 0)
      .map(([id]) => id),
    ...baseState.completedResearch,
  ]);

  const startNetEnergy = baseNetEnergy(baseState, defs);
  let beams: Candidate[] = [evalPlan(baseState, [], defs, objective, startNetEnergy)];
  seen.add(planKey([]));

  let best: Candidate = beams[0];
  let staleCount = 0;

  if (verbose) {
    console.log(`\nObjective: ${objective.label}  |  beam width: ${beamWidth}`);
    console.log('─'.repeat(72));
  }

  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const candidates: Candidate[] = [];

    for (const beam of beams) {
      for (const [itemId, maxCount] of objective.candidates) {
        const def = defs[itemId];
        if (!def) continue;
        if (!canAppend(beam.plan, beam.netEnergy, itemId, maxCount, def, baseCompleted)) continue;
        const newPlan = [...beam.plan, itemId];
        const key = planKey(newPlan);
        if (seen.has(key)) continue;
        seen.add(key);
        const newNetEnergy = beam.netEnergy + itemEnergyDelta(def);
        candidates.push(evalPlan(baseState, newPlan, defs, objective, newNetEnergy));
      }
    }

    if (candidates.length === 0) break;

    candidates.sort((a, b) => b.score - a.score);
    beams = candidates.slice(0, beamWidth);
    const stepBest = beams[0];

    if (stepBest.score > best.score) {
      best = stepBest;
      staleCount = 0;
    } else {
      staleCount++;
    }

    if (verbose) {
      const t = stepBest.result.firstTargetTurn;
      console.log(
        `  depth ${String(depth).padStart(2)} │ score ${String(stepBest.score).padStart(4)}` +
        ` │ first ${t !== null ? `T${String(t).padStart(3)}` : ' none'}` +
        ` │ count ${String(stepBest.result.countAtEnd).padStart(3)}` +
        ` │ ${stepBest.plan.join(' → ')}`,
      );
    }

    if (staleCount >= STALE_LIMIT) {
      if (verbose) console.log(`\n  Converged (score stable for ${STALE_LIMIT} steps).`);
      break;
    }
  }

  return best;
}

// ─── Timeline trace ───────────────────────────────────────────────────────────

interface BuildEvent {
  slotIndex: number;
  itemId: string;
  name: string;
  lane: LaneId;
  activatedTurn: number | null;
  completedTurn: number | null;
  /** How many turns did the item sit in the queue waiting before it could activate. */
  waitedTurns: number;
  /** Primary reason for waiting, if any. */
  waitReason: string;
  /** Workers idle at activation time. */
  workersAtActivation: number;
  /** Key resources at activation time. */
  metalAtActivation: number;
  mineralAtActivation: number;
  energyNetAtActivation: number;
}

/**
 * Re-simulate the best plan to get per-item timing with constraint annotations.
 * Captures activation/completion turns, wait durations, and resource/worker
 * state at the moment each item activates — so the output can explain WHY
 * gaps exist (worker growth, resource accumulation, etc.).
 */
function traceTimeline(
  baseState: PlanetState,
  plan: string[],
  defs: Record<string, ItemDefinition>,
): BuildEvent[] {
  const state = applyPlan(baseState, plan, defs);
  const buffer = new CompletionBuffer();

  // Items already completed in the base state — used to identify non-base prerequisites
  const baseCompleted = new Set<string>([
    ...Object.entries(baseState.completedCounts).filter(([, c]) => c > 0).map(([id]) => id),
    ...baseState.completedResearch,
  ]);

  const events: BuildEvent[] = plan.map((itemId, i) => ({
    slotIndex: i,
    itemId,
    name: defs[itemId]?.name ?? itemId,
    lane: (defs[itemId]?.lane ?? 'building') as LaneId,
    activatedTurn: null,
    completedTurn: null,
    waitedTurns: 0,
    waitReason: '',
    workersAtActivation: 0,
    metalAtActivation: 0,
    mineralAtActivation: 0,
    energyNetAtActivation: 0,
  }));

  const actCursor: Record<string, number> = {};
  const doneCursor: Record<string, number> = {};

  // Track when each item first became front-of-queue in its lane
  const queueFrontTurn: Record<LaneId, number> = {
    building: 1, ship: 1, colonist: 1, research: 1,
  };

  // Compute net energy at a given state
  function computeNetEnergy(s: PlanetState): number {
    let net = 0;
    for (const [id, cnt] of Object.entries(s.completedCounts)) {
      const def = defs[id];
      if (def) net += itemEnergyDelta(def) * cnt;
    }
    // Also include active items (their upkeep kicks in on completion, but close enough)
    return net;
  }

  function recordActivation(itemId: string, turn: number, frontTurn: number) {
    const cursor = actCursor[itemId] ?? 0;
    let idx = 0;
    for (const ev of events) {
      if (ev.itemId !== itemId) continue;
      if (ev.activatedTurn !== null) { idx++; continue; }
      if (idx === cursor) {
        ev.activatedTurn = turn;
        ev.waitedTurns = Math.max(0, turn - frontTurn);
        ev.workersAtActivation = state.population.workersIdle + (defs[itemId]?.costsPerUnit.workers ?? 0);
        ev.metalAtActivation = state.stocks.metal + (defs[itemId]?.costsPerUnit.metal ?? 0);
        ev.mineralAtActivation = state.stocks.mineral + (defs[itemId]?.costsPerUnit.mineral ?? 0);
        ev.energyNetAtActivation = computeNetEnergy(state);
        // Determine the stall reason for the wait period.
        // A non-base prerequisite is "blocking" only if it completed on or after
        // the turn the item first became front-of-queue (earlier completions are
        // irrelevant — the item was stalling for a different reason at that point).
        if (ev.waitedTurns > 0) {
          const def = defs[itemId];
          const needed = def?.costsPerUnit.workers ?? 0;
          const workersBefore = ev.workersAtActivation;
          const frontTurn = turn - ev.waitedTurns; // approx turn item became front-of-queue
          const blockingPrereqs = (def?.prerequisites ?? []).filter((prereqId) => {
            if (baseCompleted.has(prereqId)) return false; // already done in base state
            const prereqEv = events.find((e) => e.itemId === prereqId);
            // Prereq is "blocking" if it completed at or after the item became front-of-queue
            return prereqEv?.completedTurn != null && prereqEv.completedTurn >= frontTurn;
          });
          if (blockingPrereqs.length > 0) {
            ev.waitReason = `prereq: ${blockingPrereqs.join(', ')}`;
          } else if (needed > 0 && workersBefore < needed + 5000) {
            ev.waitReason = `workers growing to ${(needed / 1000).toFixed(0)}k`;
          } else {
            ev.waitReason = 'resource accumulation';
          }
        }
        actCursor[itemId] = cursor + 1;
        return;
      }
      idx++;
    }
  }

  function recordCompletion(itemId: string, turn: number) {
    const cursor = doneCursor[itemId] ?? 0;
    let idx = 0;
    for (const ev of events) {
      if (ev.itemId !== itemId) continue;
      if (ev.completedTurn !== null) { idx++; continue; }
      if (idx === cursor) {
        ev.completedTurn = turn;
        doneCursor[itemId] = cursor + 1;
        return;
      }
      idx++;
    }
  }

  // Track which item is active per lane and when the lane's active slot last became free.
  // "Lane free since T" = the turn after the previous item completed, which is the first
  // turn the current front-of-queue item could theoretically start (if constraints allowed).
  const prevActiveId: Record<LaneId, string | null> = {} as any;
  const laneFreeSince: Record<LaneId, number> = { building: 1, ship: 1, colonist: 1, research: 1 };

  for (const laneId of LANE_ORDER as LaneId[]) {
    const active = state.lanes[laneId].active;
    prevActiveId[laneId] = active?.id ?? null;
    if (active) {
      // Item activated by applyPlan's initial tryActivateNext — started at T1
      recordActivation(active.itemId, active.startTurn ?? 1, 1);
      laneFreeSince[laneId] = 999; // lane is occupied, not free
    }
  }

  const prevCounts: Record<string, number> = { ...state.completedCounts };

  for (let t = 0; t < 200; t++) {
    runTurn(state, buffer);

    // Record completions FIRST so prereq.completedTurn is set before
    // recordActivation looks it up (items can activate in the same runTurn
    // that their prerequisite completes via the phase-4 re-activation pass).
    for (const [itemId, newCount] of Object.entries(state.completedCounts)) {
      const prev = prevCounts[itemId] ?? 0;
      for (let d = 0; d < newCount - prev; d++) recordCompletion(itemId, state.currentTurn);
      prevCounts[itemId] = newCount;
    }

    // Detect new activations after completions are recorded
    for (const laneId of LANE_ORDER as LaneId[]) {
      const curr = state.lanes[laneId].active;
      const currId = curr?.id ?? null;
      if (currId && currId !== prevActiveId[laneId]) {
        const startT = curr!.startTurn ?? state.currentTurn - 1;
        recordActivation(curr!.itemId, startT, laneFreeSince[laneId]);
        laneFreeSince[laneId] = 999;
      }
      if (!curr && prevActiveId[laneId] !== null) {
        laneFreeSince[laneId] = state.currentTurn;
      }
      prevActiveId[laneId] = currId;
    }
  }

  return events;
}

// ─── Output ───────────────────────────────────────────────────────────────────

function printResults(
  objective: Objective,
  best: Candidate,
  baseState: PlanetState,
  defs: Record<string, ItemDefinition>,
): void {
  const W = 70;
  const sep = '─'.repeat(W);
  const doubleSep = '═'.repeat(W);

  console.log(`\n${doubleSep}`);
  console.log(`  ${objective.label}`);
  console.log(doubleSep);

  if (best.result.firstTargetTurn === null) {
    console.log('\n  ✗  Target item was never produced within 200 turns.');
    console.log('     Try a wider beam (--beam 30) or check item prerequisites.\n');
    return;
  }

  console.log();

  const events = traceTimeline(baseState, best.plan, defs);
  const laneOrder: LaneId[] = ['building', 'ship', 'colonist', 'research'];
  const laneLabels: Record<LaneId, string> = {
    building: 'Building Lane',
    ship: 'Ship Lane',
    colonist: 'Colonist Lane',
    research: 'Research Lane',
  };

  let usedLanes = new Set(events.map((e) => e.lane));

  for (const laneId of laneOrder) {
    if (!usedLanes.has(laneId)) continue;
    const laneEvents = events.filter((e) => e.lane === laneId);
    console.log(`  ${laneLabels[laneId]}`);
    console.log(`  ${'─'.repeat(W - 2)}`);
    console.log(`    ${'Start'.padEnd(6)}  ${'Done'.padEnd(6)}  ${'Wait'.padEnd(8)}  Item`);

    let prevDone: number | null = null;

    for (const ev of laneEvents) {
      const act = ev.activatedTurn !== null ? `T${ev.activatedTurn}` : '?';
      const done = ev.completedTurn !== null ? `T${ev.completedTurn}` : '?';

      // Show idle gap between previous item finishing and this one starting
      if (prevDone !== null && ev.activatedTurn !== null && ev.activatedTurn > prevDone + 1) {
        const idleTurns = ev.activatedTurn - prevDone - 1;
        const gapReason = ev.waitReason ? ` — stalled: ${ev.waitReason}` : '';
        console.log(`    ${'·'.repeat(14)}  (${idleTurns}T idle${gapReason})`);
      }

      const waitStr = ev.waitedTurns > 0
        ? `${ev.waitedTurns}T queued`
        : 'immediate';
      const constraintNote = ev.waitedTurns > 0 && ev.waitReason ? ` [${ev.waitReason}]` : '';

      console.log(
        `    ${act.padEnd(6)}  ${done.padEnd(6)}  ${waitStr.padEnd(8)}  ${ev.name}${constraintNote}`,
      );

      // Resource state at activation
      if (ev.activatedTurn !== null) {
        const def = defs[ev.itemId];
        const costs: string[] = [];
        if ((def?.costsPerUnit.metal ?? 0) > 0)
          costs.push(`-${(def!.costsPerUnit.metal!).toLocaleString()} metal (had ${ev.metalAtActivation.toLocaleString()})`);
        if ((def?.costsPerUnit.mineral ?? 0) > 0)
          costs.push(`-${(def!.costsPerUnit.mineral!).toLocaleString()} mineral (had ${ev.mineralAtActivation.toLocaleString()})`);
        if ((def?.costsPerUnit.workers ?? 0) > 0)
          costs.push(`${(def!.costsPerUnit.workers!).toLocaleString()} workers (idle: ${ev.workersAtActivation.toLocaleString()})`);
        if (costs.length > 0) {
          console.log(`    ${''.padEnd(6)}  ${''.padEnd(6)}  ${''.padEnd(8)}  ↳ ${costs.join(', ')}`);
        }
      }

      prevDone = ev.completedTurn;
    }
    console.log();
  }

  console.log(sep);

  if (objective.id === 'fastest-outpost-ship') {
    console.log(`  ✓  First new outpost ship completed at turn ${best.result.firstTargetTurn}`);
  } else {
    console.log(`  ✓  ${best.result.countAtEnd} outpost ships completed by turn 200`);
    if (best.result.firstTargetTurn !== null) {
      console.log(`     (first at turn ${best.result.firstTargetTurn})`);
    }
  }

  console.log();
  console.log(`  Net energy after plan: ${best.netEnergy >= 0 ? '+' : ''}${best.netEnergy}/turn`);
  console.log(`  Plan: ${best.plan.join(' → ')}`);
  console.log();
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let objectiveId = 'fastest-outpost-ship';
  let beamWidth = 20;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--beam' || a === '-b') && args[i + 1]) {
      beamWidth = parseInt(args[++i], 10) || 20;
    } else if (a === '--verbose' || a === '-v') {
      verbose = true;
    } else if (!a.startsWith('-')) {
      objectiveId = a;
    }
  }

  const objective = OBJECTIVES[objectiveId];
  if (!objective) {
    console.error(`Unknown objective: "${objectiveId}"`);
    console.error(`Available: ${Object.keys(OBJECTIVES).join(', ')}`);
    process.exit(1);
  }
  return { objective, beamWidth, verbose };
}

async function main(): Promise<void> {
  const { objective, beamWidth, verbose } = parseArgs();

  const gameDataPath = path.join(__dirname, '../src/lib/game/game_data.json');
  const gameDataRaw = JSON.parse(fs.readFileSync(gameDataPath, 'utf-8'));
  const defs = loadGameData(gameDataRaw);
  const baseState = createOptimizerBase(defs);

  // Starting production summary
  const startMetal = Object.entries(baseState.completedCounts).reduce((sum, [id, cnt]) => {
    return sum + (defs[id]?.effectsOnComplete?.production_metal ?? 0) * cnt;
  }, 0);

  console.log('\n  IC Build List Optimizer');
  console.log('  ══════════════════════════════════════════════════════════════════════');
  console.log(`  Objective  : ${objective.label}`);
  console.log(`  Beam width : ${beamWidth}`);
  console.log(`  Start      : ${baseState.stocks.metal.toLocaleString()} metal, `
    + `${baseState.stocks.mineral.toLocaleString()} mineral, `
    + `${baseState.population.workersTotal.toLocaleString()} workers`);
  console.log(`  Production : ~${startMetal.toLocaleString()} metal/turn at start`);
  const startEnergy = baseNetEnergy(baseState, defs);
  console.log(`  Net energy : ${startEnergy >= 0 ? '+' : ''}${startEnergy}/turn`
    + `  (each building costs 10/turn — solar_generator needed before energy-draining items)`);
  console.log(`  Housing cap: ${baseState.housing.workerCap.toLocaleString()} workers`
    + `  (shipyard needs 60,000 idle workers → living_quarters is mandatory)`);

  // Baseline: no preparation, just the mandatory chain
  const baselinePlan = ['launch_site', 'shipyard', 'outpost_ship'];
  const baselineResult = evalPlan(baseState, baselinePlan, defs, objective, startEnergy);
  const baselineT = baselineResult.result.firstTargetTurn;
  console.log(`\n  Baseline (no resource prep): ${baselineT !== null ? `T${baselineT}` : 'never'}`);

  console.log('\n  Searching...\n');

  const t0 = Date.now();
  const best = beamSearch(baseState, defs, objective, beamWidth, verbose);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n  Done in ${elapsed}s`);

  if (baselineT !== null && best.result.firstTargetTurn !== null) {
    const gain = baselineT - best.result.firstTargetTurn;
    if (gain > 0) {
      console.log(`  Improvement over baseline: ${gain} turns faster`);
    }
  }

  printResults(objective, best, baseState, defs);
}

main().catch((err) => {
  console.error('Optimizer error:', err);
  process.exit(1);
});
