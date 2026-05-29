"use client";

import { useMemo, useState } from 'react';
import gameDataRaw from '../../lib/game/game_data.json';
import {
  buildGameDefs,
  calculateCargoPlan,
  calculateFleetBalancePlan,
  calculateFleetScoreBreakdown,
  fleetFromBudget,
  formatHumanNumber,
  optimizeBuildForScore,
  parseCompositionInput,
  parseRatioInput,
  parseSnapshotInput,
  projectAvailableResources,
  type ParsedSnapshot,
  type ResourceId,
} from '../../lib/calculators/engine';

const RESOURCE_ORDER: ResourceId[] = ['metal', 'mineral', 'food', 'energy'];

const DEFAULT_INPUT = `Paste either:
- Discord ANSI empire/planet blocks
- Ctrl+A from planet view

Example mini-input:
Metal 2.5M +110.9K/tick 83%
Mineral 1.2M +70.2K/tick 80%
Food 719.5K +18.6K/tick 80%
Energy 258.1K +1.6K/tick 74%
Worker 450k /450k (120k busy)
Ground Space 24
Orbital Space 18
19x Metal Mine
18x Mineral Extractor
6x Farm
4x Hydroponics Lab`;

const DEFAULT_FLEET_COMPOSITION = `Destroyer: 120
Cruiser: 50
Battleship: 20`;

const DEFAULT_RATIO = `Destroyer: 6
Cruiser: 3
Battleship: 1`;

function idLabel(id: string): string {
  return id
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ResourceRow({ title, values }: { title: string; values: Record<ResourceId, number> }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-pink-nebula-muted">{title}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {RESOURCE_ORDER.map((resource) => (
          <div key={resource} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1">
            <div className="text-[11px] uppercase tracking-[0.12em] text-pink-nebula-muted">{resource}</div>
            <div className="text-sm font-semibold text-pink-nebula-text">{formatHumanNumber(values[resource])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-[#120c18]/70 p-4 shadow-lg shadow-black/30 backdrop-blur-xl">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/90">{title}</h3>
      {children}
    </section>
  );
}

export default function CalculatorsPage() {
  const defs = useMemo(() => buildGameDefs(gameDataRaw), []);

  const [rawInput, setRawInput] = useState(DEFAULT_INPUT);
  const [fleetInput, setFleetInput] = useState(DEFAULT_FLEET_COMPOSITION);
  const [ratioInput, setRatioInput] = useState(DEFAULT_RATIO);
  const [projectionTicks, setProjectionTicks] = useState(0);
  const [buildSteps, setBuildSteps] = useState(12);

  const parsed = useMemo<ParsedSnapshot>(() => parseSnapshotInput(rawInput, defs), [rawInput, defs]);

  const parsedFleet = useMemo(
    () => parseCompositionInput(fleetInput, defs.shipNameToId),
    [fleetInput, defs.shipNameToId],
  );

  const ratioWeights = useMemo(
    () => parseRatioInput(ratioInput, defs.shipNameToId),
    [ratioInput, defs.shipNameToId],
  );

  const cargoPlan = useMemo(() => calculateCargoPlan(parsed, defs.cargoShips), [parsed, defs.cargoShips]);

  const fleetScore = useMemo(
    () => calculateFleetScoreBreakdown(parsedFleet, defs.shipsById),
    [parsedFleet, defs.shipsById],
  );

  const fleetBalance = useMemo(
    () => calculateFleetBalancePlan(parsedFleet, ratioWeights),
    [parsedFleet, ratioWeights],
  );

  const buildOptimization = useMemo(
    () => optimizeBuildForScore(parsed, defs.structuresById, Math.max(1, Math.floor(buildSteps))),
    [parsed, defs.structuresById, buildSteps],
  );

  const availableNow = useMemo(() => projectAvailableResources(parsed, Math.max(0, Math.floor(projectionTicks))), [parsed, projectionTicks]);

  const budgetFleet = useMemo(
    () => fleetFromBudget(availableNow, ratioWeights, defs.shipsById),
    [availableNow, ratioWeights, defs.shipsById],
  );

  const totalOtherStored = parsed.resourcesStored.food + parsed.resourcesStored.energy;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-transparent text-pink-nebula-text">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(233,30,99,0.25),transparent_42%),radial-gradient(circle_at_80%_12%,rgba(0,176,255,0.22),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(255,64,129,0.2),transparent_48%)]" />

      <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <header className="rounded-2xl border border-pink-300/25 bg-gradient-to-r from-pink-nebula-panel/95 via-[#180f23]/95 to-pink-nebula-panel/85 p-4 shadow-2xl shadow-black/25 backdrop-blur-2xl md:p-6">
          <div className="text-[11px] uppercase tracking-[0.32em] text-pink-nebula-accent-secondary/80">Infinite Conflict</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-pink-nebula-text md:text-3xl">Calculator Companion</h1>
          <p className="mt-2 max-w-4xl text-sm text-pink-nebula-muted">
            Separate companion surface using the same game data mechanics for cargo, fleet score, ratio balancing, build optimization, and budget-based fleet planning.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#160f21]/70 p-4 shadow-xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-pink-nebula-muted">Paste Input</div>
            <textarea
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              className="h-[350px] w-full rounded-xl border border-cyan-300/20 bg-black/35 p-3 text-sm text-pink-nebula-text outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
              spellCheck={false}
            />
            <div className="mt-2 text-xs text-pink-nebula-muted">Parser supports Discord ANSI blocks and Ctrl+A planet view paste.</div>
          </div>

          <div className="space-y-3">
            <ResourceRow title="Stored" values={parsed.resourcesStored} />
            <ResourceRow title="Output per Tick" values={parsed.resourcesOutput} />
            <ResourceRow title="Abundance %" values={parsed.abundance} />
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-pink-nebula-muted">Parsed Snapshot</div>
              <div className="grid grid-cols-2 gap-2">
                <div>Planet: <span className="font-semibold">{parsed.planetName || 'Unknown'}</span></div>
                <div>Asset Score: <span className="font-semibold">{parsed.assetScore ? formatHumanNumber(parsed.assetScore) : 'n/a'}</span></div>
                <div>Workers Free: <span className="font-semibold">{parsed.workersFree !== undefined ? formatHumanNumber(parsed.workersFree) : 'n/a'}</span></div>
                <div>Ground Space Free: <span className="font-semibold">{parsed.groundSpaceFree !== undefined ? formatHumanNumber(parsed.groundSpaceFree) : 'n/a'}</span></div>
                <div>Orbital Space Free: <span className="font-semibold">{parsed.orbitalSpaceFree !== undefined ? formatHumanNumber(parsed.orbitalSpaceFree) : 'n/a'}</span></div>
                <div>Structures Parsed: <span className="font-semibold">{Object.keys(parsed.structures).length}</span></div>
              </div>
            </div>
            {parsed.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-900/20 p-3 text-xs text-amber-200">
                {parsed.warnings.map((warning) => (
                  <div key={warning}>• {warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <TableCard title="1) Cargo Fleet Perfect Empty">
            {!cargoPlan ? (
              <div className="text-sm text-pink-nebula-muted">No cargo plan available from current data.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {defs.cargoShips.map((ship) => (
                    <div key={ship.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                      <div className="font-semibold text-cyan-100">{ship.name}</div>
                      <div className="mt-1 text-pink-nebula-muted">count: {cargoPlan.shipCounts[ship.id] || 0}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">Ships: <span className="font-semibold">{cargoPlan.totals.ships}</span></div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">Metal overflow: <span className="font-semibold">{formatHumanNumber(cargoPlan.overflow.metal)}</span></div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">Mineral overflow: <span className="font-semibold">{formatHumanNumber(cargoPlan.overflow.mineral)}</span></div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">Food+Energy overflow: <span className="font-semibold">{formatHumanNumber(cargoPlan.overflow.other)}</span></div>
                </div>
                <div className="mt-3 text-xs text-pink-nebula-muted">
                  Target load: Metal {formatHumanNumber(parsed.resourcesStored.metal)}, Mineral {formatHumanNumber(parsed.resourcesStored.mineral)}, Food+Energy {formatHumanNumber(totalOtherStored)}
                </div>
              </>
            )}
          </TableCard>

          <TableCard title="2) Fleet Score and Cost Ratios">
            <textarea
              value={fleetInput}
              onChange={(event) => setFleetInput(event.target.value)}
              className="h-24 w-full rounded-lg border border-cyan-300/20 bg-black/35 p-2 text-xs text-pink-nebula-text outline-none"
              spellCheck={false}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">Raw score points: <span className="font-semibold">{formatHumanNumber(fleetScore.totalScoreValue)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">Displayed score: <span className="font-semibold">{fleetScore.totalDisplayedScore.toFixed(2)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">Weighted cost: <span className="font-semibold">{formatHumanNumber(fleetScore.weightedCost)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm">Score / weighted 1k: <span className="font-semibold">{fleetScore.scorePerWeightedK.toFixed(2)}</span></div>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-black/30 text-pink-nebula-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Ship</th>
                    <th className="px-2 py-1 text-right">Count</th>
                    <th className="px-2 py-1 text-right">Total Score Pts</th>
                    <th className="px-2 py-1 text-right">Score / Weighted 1k</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetScore.entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/10">
                      <td className="px-2 py-1">{entry.name}</td>
                      <td className="px-2 py-1 text-right">{entry.count}</td>
                      <td className="px-2 py-1 text-right">{formatHumanNumber(entry.totalScoreValue)}</td>
                      <td className="px-2 py-1 text-right">{entry.scorePerWeightedK.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <TableCard title="3) Fleet Ratio Balancer">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs uppercase tracking-[0.12em] text-pink-nebula-muted">Target Ratio</div>
                <textarea
                  value={ratioInput}
                  onChange={(event) => setRatioInput(event.target.value)}
                  className="h-24 w-full rounded-lg border border-cyan-300/20 bg-black/35 p-2 text-xs text-pink-nebula-text outline-none"
                  spellCheck={false}
                />
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-[0.12em] text-pink-nebula-muted">Current Fleet (editable)</div>
                <textarea
                  value={fleetInput}
                  onChange={(event) => setFleetInput(event.target.value)}
                  className="h-24 w-full rounded-lg border border-cyan-300/20 bg-black/35 p-2 text-xs text-pink-nebula-text outline-none"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-black/30 text-pink-nebula-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Ship</th>
                    <th className="px-2 py-1 text-right">Current</th>
                    <th className="px-2 py-1 text-right">Add</th>
                    <th className="px-2 py-1 text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(fleetBalance.targetWeights).map((id) => (
                    <tr key={id} className="border-t border-white/10">
                      <td className="px-2 py-1">{defs.shipsById[id]?.name || idLabel(id)}</td>
                      <td className="px-2 py-1 text-right">{parsedFleet[id] || 0}</td>
                      <td className="px-2 py-1 text-right">{fleetBalance.additions[id] || 0}</td>
                      <td className="px-2 py-1 text-right">{fleetBalance.resulting[id] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>

          <TableCard title="4) Build Optimizer: Output per Score">
            <div className="mb-3 flex items-center gap-2 text-xs">
              <label className="uppercase tracking-[0.12em] text-pink-nebula-muted">Steps</label>
              <input
                type="number"
                min={1}
                max={100}
                value={buildSteps}
                onChange={(event) => setBuildSteps(Number(event.target.value || 12))}
                className="w-20 rounded-md border border-cyan-300/20 bg-black/35 px-2 py-1 text-sm text-pink-nebula-text outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Added score: <span className="font-semibold">{formatHumanNumber(buildOptimization.totalScoreDelta)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Weighted output delta: <span className="font-semibold">{formatHumanNumber(buildOptimization.totalWeightedOutputDelta)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Workers left: <span className="font-semibold">{formatHumanNumber(buildOptimization.remaining.workersFree)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Ground/Orbital left: <span className="font-semibold">{formatHumanNumber(buildOptimization.remaining.groundSpaceFree)} / {formatHumanNumber(buildOptimization.remaining.orbitalSpaceFree)}</span></div>
            </div>
            <div className="mt-3 max-h-[250px] overflow-auto rounded-lg border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-black/30 text-pink-nebula-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Build</th>
                    <th className="px-2 py-1 text-right">Eff.</th>
                    <th className="px-2 py-1 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {buildOptimization.steps.map((step, index) => (
                    <tr key={`${step.id}-${index}`} className="border-t border-white/10">
                      <td className="px-2 py-1">{index + 1}</td>
                      <td className="px-2 py-1">{step.name}</td>
                      <td className="px-2 py-1 text-right">{step.efficiency.toFixed(4)}</td>
                      <td className="px-2 py-1 text-right">{step.scoreDelta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <TableCard title="5) Fleet from Budget / Outputs">
            <div className="mb-3 flex items-center gap-2 text-xs">
              <label className="uppercase tracking-[0.12em] text-pink-nebula-muted">Projection Ticks</label>
              <input
                type="number"
                min={0}
                max={5000}
                value={projectionTicks}
                onChange={(event) => setProjectionTicks(Number(event.target.value || 0))}
                className="w-28 rounded-md border border-cyan-300/20 bg-black/35 px-2 py-1 text-sm text-pink-nebula-text outline-none"
              />
            </div>

            <ResourceRow title="Available Budget" values={availableNow} />

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Multiplier: <span className="font-semibold">{budgetFleet.multiplier}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Metal Used: <span className="font-semibold">{formatHumanNumber(budgetFleet.used.metal)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Mineral Used: <span className="font-semibold">{formatHumanNumber(budgetFleet.used.mineral)}</span></div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">Food/Energy Used: <span className="font-semibold">{formatHumanNumber(budgetFleet.used.food + budgetFleet.used.energy)}</span></div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-black/30 text-pink-nebula-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Ship</th>
                    <th className="px-2 py-1 text-right">Build Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(budgetFleet.composition).map(([id, count]) => (
                    <tr key={id} className="border-t border-white/10">
                      <td className="px-2 py-1">{defs.shipsById[id]?.name || idLabel(id)}</td>
                      <td className="px-2 py-1 text-right">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ResourceRow title="Leftover After Build" values={budgetFleet.leftover} />
          </TableCard>

          <TableCard title="Method Notes">
            <ul className="space-y-2 text-sm text-pink-nebula-muted">
              <li>• Mechanics are read from game_data definitions already used by the planner.</li>
              <li>• Cargo calculator minimizes overflow and ship count for one-trip extraction.</li>
              <li>• Score calculator uses ship score values and weighted resource cost ratios.</li>
              <li>• Ratio balancer computes minimal additions for scaled target ratios.</li>
              <li>• Build optimizer runs a greedy output-per-score recommendation loop.</li>
              <li>• Budget fleet solver uses exact ratio bundles and maximizes multiplier under budget.</li>
            </ul>
          </TableCard>
        </section>
      </div>
    </main>
  );
}
