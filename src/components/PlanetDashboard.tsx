"use client";

import React, { useMemo } from 'react';
import type { PlanetSummary as PlanetSummaryType } from '../lib/game/selectors';
import { Card } from '@/components/ui/card';

export interface PlanetDashboardProps {
  summary: PlanetSummaryType;
  defs: Record<string, any>;
  turnsToHousingCap?: number | null;
  /** True when a building activated this turn using projected production to cover costs */
  stocksEstimated?: boolean;
}

const SHIP_SORT_ORDER: Record<string, number> = {
  outpost_ship: 0,
  freighter: 1,
  fighter: 2,
  bomber: 3,
  frigate: 4,
  destroyer: 5,
  cruiser: 6,
  battleship: 7,
};

export const PlanetDashboard = React.memo(function PlanetDashboard({ summary, defs, turnsToHousingCap, stocksEstimated }: PlanetDashboardProps) {
  const resources = [
    { id: 'metal', label: 'Metal', color: 'text-gray-300' },
    { id: 'mineral', label: 'Mineral', color: 'text-red-500' },
    { id: 'food', label: 'Food', color: 'text-green-500' },
    { id: 'energy', label: 'Energy', color: 'text-blue-400' },
    { id: 'research_points', label: 'RP', color: 'text-yellow-400' },
  ] as const;

  const formatNumber = useMemo(() => {
    return (num: number) => {
      const str = Math.floor(num).toString();
      return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };
  }, []);

  const formatWithK = useMemo(() => {
    return (num: number) => {
      if (num >= 1000) {
        return `${Math.floor(num / 1000)}k`;
      }
      return num.toString();
    };
  }, []);

  const formatOutput = useMemo(() => {
    return (output: number) => {
      const rounded = Math.round(output * 10) / 10;
      const sign = rounded < 0 ? '-' : '+';
      const [intStr, decStr] = Math.abs(rounded).toFixed(1).split('.');
      const intWithSep = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const isInteger = decStr === '0';
      return `${sign}${intWithSep}${isInteger ? '' : `,${decStr}`}`;
    };
  }, []);

  const formatAbundance = (abundance: number) => {
    return `${(abundance * 100).toFixed(0)}%`;
  };

  const shipsList = useMemo(() => {
    return Object.entries(summary.ships)
      .map(([shipId, count]) => ({
        id: shipId,
        name: defs[shipId]?.name || shipId.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        count,
      }))
      .sort((a, b) => {
        const pa = SHIP_SORT_ORDER[a.id] ?? 99;
        const pb = SHIP_SORT_ORDER[b.id] ?? 99;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
  }, [summary.ships, defs]);

  const structuresList = useMemo(() => {
    const structures = Object.entries(summary.structures).map(([structureId, count]) => {
      const def = defs[structureId];
      const name = def?.name || structureId.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const metalOut = def?.effectsOnComplete?.production_metal || 0;
      const mineralOut = def?.effectsOnComplete?.production_mineral || 0;
      const foodOut = def?.effectsOnComplete?.production_food || 0;
      const energyOut = def?.effectsOnComplete?.production_energy || 0;
      const metalIn = def?.upkeepPerUnit?.metal || 0;
      const mineralIn = def?.upkeepPerUnit?.mineral || 0;
      const foodIn = def?.upkeepPerUnit?.food || 0;
      const energyIn = def?.upkeepPerUnit?.energy || 0;

      const isOrbital = (def?.costsPerUnit?.space_orbital || 0) > 0;
      const spaceAmount = isOrbital
        ? (def?.costsPerUnit?.space_orbital || 0) * count
        : (def?.costsPerUnit?.space || 0) * count;

      return {
        id: structureId,
        name,
        count,
        tier: def?.tier || 0,
        durationTurns: def?.durationTurns || 0,
        metalNet: (metalOut - metalIn) * count,
        mineralNet: (mineralOut - mineralIn) * count,
        foodNet: (foodOut - foodIn) * count,
        energyNet: (energyOut - energyIn) * count,
        space: spaceAmount,
        isOrbital,
      };
    });

    structures.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.durationTurns !== b.durationTurns) return a.durationTurns - b.durationTurns;
      return a.name.localeCompare(b.name);
    });

    return structures;
  }, [summary.structures, defs]);

  const groundFree = Math.max(0, summary.space.groundCap - summary.space.groundUsed);
  const orbitalFree = Math.max(0, summary.space.orbitalCap - summary.space.orbitalUsed);

  return (
    <div className="my-4 px-3 md:px-6">
      <div className="mx-auto w-full max-w-[1800px]">
        <Card className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 p-3 md:p-4 glow-tyr border-gray-400/30">

        {/* Resources Section */}
        <Card className="p-3">
          <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Resources</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-pink-nebula-muted border-b border-pink-nebula-border">
                <th className="text-left pb-2 w-20">Type</th>
                <th className="text-right pb-2 w-24">Stock</th>
                <th className="text-right pb-2 w-14">Abund</th>
                <th className="text-right pb-2 w-20">Output/T</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => {
                const stored = summary.stocks[resource.id] ?? 0;
                const abundance = summary.abundance[resource.id] ?? 1;
                const output = summary.outputsPerTurn[resource.id] ?? 0;
                return (
                  <tr key={resource.id} className="border-b border-pink-nebula-border/50 last:border-0">
                    <td className={`py-2 font-semibold w-20 ${resource.color}`}>
                      {resource.label}
                    </td>
                    <td
                      className={`text-right py-2 font-mono w-24 ${stocksEstimated ? 'italic text-pink-nebula-muted cursor-help' : 'text-pink-nebula-text'}`}
                      title={stocksEstimated ? 'A building started this turn using this turn\'s production to cover its cost. Stocks settle within the same turn.' : undefined}
                    >
                      {formatNumber(stored)}
                    </td>
                    <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                      {formatAbundance(abundance)}
                    </td>
                    <td className={`text-right py-2 font-semibold font-mono w-20 ${resource.color}`}>
                      {formatOutput(output)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Population + Housing Section */}
        <Card className="p-3">
          <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Population</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-pink-nebula-muted border-b border-pink-nebula-border">
                <th className="text-left pb-2 w-24">Type</th>
                <th className="text-right pb-2 w-24">Count</th>
                <th className="text-right pb-2 w-14">Cap</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-pink-nebula-border/50">
                <td className="py-2 w-24">
                  <div className="relative inline-block group">
                    <button
                      type="button"
                      tabIndex={0}
                      className="text-orange-400 font-semibold cursor-help underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 rounded"
                      aria-label="Worker growth details"
                    >
                      Workers
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-56 rounded-lg border border-orange-400/30 bg-slate-900/95 p-2.5 text-xs shadow-xl group-hover:block group-focus-within:block"
                    >
                      {summary.workerGrowthDetail ? (
                        <div className="space-y-1">
                          <div className="text-orange-300 font-semibold">
                            Growth rate: {summary.workerGrowthDetail.ratePercent}%/turn
                          </div>
                          {summary.workerGrowthDetail.turnsToDouble !== null && (
                            <div className="text-pink-nebula-muted">
                              Doubles in ~{summary.workerGrowthDetail.turnsToDouble} turns
                            </div>
                          )}
                          {turnsToHousingCap != null && (
                            <div className="text-yellow-400">
                              Housing cap in {turnsToHousingCap} turn{turnsToHousingCap !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-pink-nebula-muted">No growth (need food &gt; 0)</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-right py-2 text-orange-400 font-mono w-24">
                  {formatNumber(summary.population.workersTotal)} ({formatNumber(summary.population.workersBusy)})
                </td>
                <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                  {formatWithK(summary.housing.workerCap)}
                </td>
              </tr>
              <tr className="border-b border-pink-nebula-border/50">
                <td className="py-2 text-red-300 font-semibold w-24">Soldiers</td>
                <td className="text-right py-2 text-red-300 font-mono w-24">
                  {formatNumber(summary.population.soldiers)}
                </td>
                <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                  {formatWithK(summary.housing.soldierCap)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-yellow-400 font-semibold w-24">Scientists</td>
                <td className="text-right py-2 text-yellow-400 font-mono w-24">
                  {formatNumber(summary.population.scientists)}
                </td>
                <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                  {formatWithK(summary.housing.scientistCap)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 pt-2 border-t border-pink-nebula-border/50 text-xs space-y-1">
            <div className="text-pink-nebula-muted">
              Idle workers: {formatNumber(summary.population.workersIdle)}
            </div>
            <div className="text-green-400 font-semibold">
              {summary.growthHint}
            </div>
            {turnsToHousingCap !== null && turnsToHousingCap !== undefined && turnsToHousingCap <= 6 && (
              <div className="text-yellow-500 font-semibold pt-1">
                ⚠️ Workers will reach housing cap in {turnsToHousingCap} turn{turnsToHousingCap !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </Card>

        {/* Ships Section — replaced Space Remaining */}
        <Card className="p-3">
          <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Ships</h3>
          {shipsList.length > 0 ? (
            <div className="space-y-1.5">
              {shipsList.map((ship) => (
                <div key={ship.id} className="flex justify-between items-center text-sm">
                  <span className="text-pink-nebula-text">{ship.name}</span>
                  <span className="text-pink-nebula-muted font-mono">×{ship.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-pink-nebula-muted text-center py-4">
              No ships
            </div>
          )}
          <div className="mt-3 pt-2 border-t border-pink-nebula-border/50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-yellow-400 font-semibold">Planet Limit</span>
              <span className="text-yellow-400 font-mono">{summary.planetLimit || 4}</span>
            </div>
            <div className="text-xs text-pink-nebula-muted mt-0.5">Max planets you can control</div>
          </div>
        </Card>

        {/* Buildings Section */}
        <Card className="p-3">
          <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">
            Buildings
            <span className="ml-2 text-[11px] font-normal normal-case tracking-normal">
              <span className="text-amber-600">{groundFree} GS</span>
              {' and '}
              <span className="text-blue-400">{orbitalFree} OS</span>
              {' free'}
            </span>
          </h3>
          {structuresList.length > 0 ? (
            <div className="scroll-nebula max-h-[224px] overflow-y-auto overflow-x-hidden md:overflow-x-visible">
              <table className="w-full table-fixed text-[11px] font-mono sm:text-xs md:table-auto">
                <thead>
                  <tr className="text-[10px] text-pink-nebula-muted border-b border-pink-nebula-border sticky top-0 bg-pink-nebula-panel">
                    <th className="w-[8%] pb-1 pr-1 text-right md:w-8 md:pr-2">Sp</th>
                    <th className="w-[30%] pb-1 pr-1 text-left md:w-32 md:pr-2">Building</th>
                    <th className="w-[11%] pb-1 pr-1 text-right md:w-10 md:pr-2">Qty</th>
                    <th className="w-[12%] pb-1 pr-1 text-right text-gray-300 md:w-12 md:pr-2">M</th>
                    <th className="w-[13%] pb-1 pr-1 text-right text-red-500 md:w-12 md:pr-2">Mn</th>
                    <th className="w-[12%] pb-1 pr-1 text-right text-green-500 md:w-12 md:pr-2">F</th>
                    <th className="w-[14%] pb-1 pr-1 text-right text-blue-400 md:w-14 md:pr-0">E</th>
                  </tr>
                </thead>
                <tbody>
                  {structuresList.map((structure) => {
                    const spaceColor = structure.isOrbital ? 'text-blue-600' : 'text-amber-600';
                    const spaceDisplay = structure.space > 0 ? structure.space.toString() : '';
                    let energyDisplay = '';
                    if (structure.energyNet !== 0) {
                      const sign = structure.energyNet > 0 ? '+' : '';
                      energyDisplay = `${sign}${structure.energyNet}⚡`;
                    }

                    return (
                      <tr key={structure.id} className="border-b border-pink-nebula-border/50 last:border-0">
                        <td className={`py-1.5 pr-1 text-right ${spaceColor} font-semibold md:w-8 md:pr-2`}>
                          {spaceDisplay}
                        </td>
                        <td className="break-words py-1.5 pr-1 text-pink-nebula-text font-semibold leading-tight md:w-32 md:break-normal md:pr-2 md:leading-normal">
                          {structure.name}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-1 text-right text-pink-nebula-text md:w-10 md:pr-2">
                          ×{structure.count}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-1 text-right text-gray-300 md:w-12 md:pr-2">
                          {structure.metalNet !== 0 ? (structure.metalNet > 0 ? '+' : '') + structure.metalNet : ''}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-1 text-right text-red-500 md:w-12 md:pr-2">
                          {structure.mineralNet !== 0 ? (structure.mineralNet > 0 ? '+' : '') + structure.mineralNet : ''}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-1 text-right text-green-500 md:w-12 md:pr-2">
                          {structure.foodNet !== 0 ? (structure.foodNet > 0 ? '+' : '') + structure.foodNet : ''}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-1 text-right text-blue-400 md:w-14 md:pr-0">
                          {energyDisplay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-pink-nebula-muted text-center py-4">
              No buildings
            </div>
          )}
        </Card>

        </Card>
      </div>
    </div>
  );
});
