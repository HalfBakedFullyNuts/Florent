/**
 * Parity / determinism harness for shared-link replays.
 *
 * 1. ALWAYS: replays the fixed payload twice in independent processes state
 *    (fresh GameState each time) and asserts byte-identical metrics — a
 *    regression guard against nondeterminism within a version.
 * 2. When FLORENT_PARITY_OUT is set: writes the full-precision metric dump to
 *    that path so two codebases (e.g. pre-refactor vs post-refactor branches)
 *    can be diffed:
 *
 *      FLORENT_PARITY_OUT=/tmp/parity-post.json npx vitest run src/lib/game/__tests__/parity-replay.test.ts
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { decodeGameState, replayCommands } from '../urlState';
import { createInitialGameState } from '../gameState';
import { getLaneView, getPlanetSummary, canQueueItem } from '../selectors';
import { getGlobalResearchLaneView } from '../globalResearch';

const ENCODED =
  'b3.AwEJSG9tZXdvcmxkGKCcAQMDAQE3BjIGNQY2BjcGOAY5AAAeAQAAIQEAABoBAAAhAQAAHgEAACYBAAAhAQAAHgEAAB4BAAAhAQAAIQEAAB4BAAAcAQAAKgEAABkBAAAoAQAAIQEAAB4BAAAeAQAAIQEAAAUBAAAcAQAAIQEAAB4BAAAqAQAACwEAACEBAAAeAQAAHgEAACEBAAALAQAAIQEAAB4BAAAQAQAAKgEAACEBAAAeAQAACwEAAB4BAAALAQAAAwEAACUBAAAlAQAAJQEAACUCAAAlAgAAJQIAACUDAAAnyAEHEU5ld2JpZSBCdWlsZCBMaXN0CFdvbGZwYWNrGDIwMjYtMDUtMDZUMTc6MjU6MjkuNTY5Wg';

const TURNS = [1, 2, 3, 5, 10, 25, 50, 100, 150, 199];

function buildReport(): string {
  const snapshot = decodeGameState(ENCODED);
  if (!snapshot) throw new Error('parity payload failed to decode');

  const gameState = replayCommands(createInitialGameState(), snapshot.cmds);

  const planetStates = (turn: number): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [planetId, planet] of gameState.planets.entries()) {
      const state = planet.timeline?.getStateAtTurn(turn);
      if (!state) {
        out[planetId] = null;
        continue;
      }
      out[planetId] = {
        stocks: state.stocks,
        population: {
          workersTotal: state.population.workersTotal,
          workersIdle: state.population.workersIdle,
          soldiers: state.population.soldiers,
          scientists: state.population.scientists,
        },
        housing: state.housing,
        space: state.space,
        completedCounts: Object.fromEntries(
          Object.entries(state.completedCounts).sort(([a], [b]) => a.localeCompare(b)),
        ),
        completedResearch: [...(state.completedResearch || [])].sort(),
        planetLimit: state.planetLimit,
      };
    }
    return out;
  };

  const laneViews: Record<string, unknown> = {};
  for (const [planetId, planet] of gameState.planets.entries()) {
    const state = planet.timeline?.getStateAtTurn(1);
    if (!state) continue;
    laneViews[planetId] = {
      building: getLaneView(state, 'building').entries.map((e) => ({
        itemId: e.itemId,
        status: e.status,
        quantity: e.quantity,
        turnsRemaining: e.turnsRemaining,
        eta: e.eta,
        startTurn: e.startTurn ?? null,
        completionTurn: e.completionTurn ?? null,
        isWait: e.isWait ?? false,
        invalid: e.invalid ?? false,
      })),
      ship: getLaneView(state, 'ship').entries.map((e) => ({
        itemId: e.itemId,
        status: e.status,
        quantity: e.quantity,
      })),
      colonist: getLaneView(state, 'colonist').entries.map((e) => ({
        itemId: e.itemId,
        status: e.status,
        quantity: e.quantity,
      })),
      research: getLaneView(state, 'research').entries.map((e) => ({
        itemId: e.itemId,
        status: e.status,
        quantity: e.quantity,
        eta: e.eta,
      })),
    };
  }

  const summaries: Record<string, unknown> = {};
  for (const [planetId, planet] of gameState.planets.entries()) {
    const state = planet.timeline?.getStateAtTurn(25);
    if (!state) continue;
    summaries[planetId] = JSON.parse(JSON.stringify(getPlanetSummary(state)));
  }

  const globalResearch = getGlobalResearchLaneView(gameState, 200);

  const canQueueProbe = (() => {
    const hw = gameState.planets.get('planet-1');
    const state = hw?.timeline?.getStateAtTurn(10);
    if (!state) return null;
    const ids = ['metal_mine', 'mineral_extractor', 'farm', 'solar_generator', 'research_lab', 'launch_site', 'comms_satellite', 'habitat'];
    return Object.fromEntries(ids.map((id) => [id, canQueueItem(state, id, 1)]));
  })();

  return JSON.stringify(
    {
      meta: {
        planetCount: snapshot.planets.length,
        commandCount: snapshot.cmds.length,
      },
      planets: Array.from(gameState.planets.entries()).map(([id, p]) => ({
        id,
        name: p.name,
        startTurn: p.startTurn,
        currentTurn: p.currentTurn,
      })),
      statesByTurn: Object.fromEntries(TURNS.map((t) => [String(t), planetStates(t)])),
      laneViewsAtTurn1: laneViews,
      summaryAtTurn25: summaries,
      globalResearchAt200: {
        entries: globalResearch.entries.map((e) => ({
          itemId: e.itemId,
          status: e.status,
          quantity: e.quantity,
          eta: e.eta,
          startTurn: e.startTurn ?? null,
          completionTurn: e.completionTurn ?? null,
        })),
      },
      canQueueProbe,
    },
    null,
    1,
  );
}

describe('shared-link replay parity', () => {
  it('produces identical metrics across two independent replays', { timeout: 60_000 }, () => {
    const first = buildReport();
    const second = buildReport();
    expect(second).toBe(first);
  });

  it('writes the cross-version artifact when FLORENT_PARITY_OUT is set', { timeout: 60_000 }, () => {
    const report = buildReport();
    const outPath = process.env.FLORENT_PARITY_OUT;
    if (outPath) {
      writeFileSync(outPath, report);
      console.log(`PARITY_DUMP_WRITTEN ${outPath}`);
    }
    expect(report.length).toBeGreaterThan(1000);
  });
});
