"use client";

import React, { useMemo } from 'react';
import type { PlanetSummary as PlanetSummaryType } from '../lib/game/selectors';

export interface PlanetDashboardProps {
  summary: PlanetSummaryType;
}

/**
 * PlanetDashboard - Horizontal planet overview dashboard
 *
 * Redesigned with table-based layout for clean alignment
 * - Resources: Stocks, abundance, outputs
 * - Population: Workers, soldiers, scientists with housing
 * - Space: Ground/Orbital progress bars
 * - Ships: Fleet overview
 * - Growth: Next turn projection
 */
export function PlanetDashboard({ summary }: PlanetDashboardProps) {
  const resources = [
    { id: 'metal', label: 'Metal', color: 'text-pink-500' },
    { id: 'mineral', label: 'Mineral', color: 'text-blue-400' },
    { id: 'food', label: 'Food', color: 'text-green-400' },
    { id: 'energy', label: 'Energy', color: 'text-yellow-400' },
  ] as const;

  // Memoize formatting functions for performance
  const formatNumber = useMemo(() => {
    return (num: number) => Math.floor(num).toLocaleString('de-DE');
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
      const formatted = rounded.toLocaleString('de-DE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      });
      return output >= 0 ? `+${formatted}` : formatted;
    };
  }, []);

  const formatAbundance = (abundance: number) => {
    return `${(abundance * 100).toFixed(0)}%`;
  };

  const getOutputColor = (output: number) => {
    if (output > 0) return 'text-green-400';
    if (output < 0) return 'text-red-400';
    return 'text-pink-nebula-muted';
  };

  // Get ship names from item IDs
  const shipsList = Object.entries(summary.ships).map(([shipId, count]) => ({
    id: shipId,
    name: shipId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    count,
  }));

  return (
    <div className="w-full max-w-[1800px] mx-auto px-6 my-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-pink-nebula-panel rounded-lg p-4 border border-pink-nebula-border">
        {/* Resources Section - Table Layout */}
        <div className="xl:col-span-2 bg-pink-nebula-bg rounded-lg p-3">
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
                const stored = summary.stocks[resource.id];
                const abundance = summary.abundance[resource.id];
                const output = summary.outputsPerTurn[resource.id];
                return (
                  <tr key={resource.id} className="border-b border-pink-nebula-border/50 last:border-0">
                    <td className={`py-2 font-semibold w-20 ${resource.color}`}>
                      {resource.label}
                    </td>
                    <td className="text-right py-2 text-pink-nebula-text font-mono w-24">
                      {formatNumber(stored)}
                    </td>
                    <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                      {formatAbundance(abundance)}
                    </td>
                    <td className={`text-right py-2 font-semibold font-mono w-20 ${getOutputColor(output)}`}>
                      {formatOutput(output)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Population + Housing Section - Table Layout */}
        <div className="bg-pink-nebula-bg rounded-lg p-3">
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
                <td className="py-2 text-pink-nebula-text font-semibold w-24">Workers</td>
                <td className="text-right py-2 text-pink-nebula-text font-mono w-24">
                  {formatNumber(summary.population.workersTotal)}
                </td>
                <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                  {formatWithK(summary.housing.workerCap)}
                </td>
              </tr>
              <tr className="border-b border-pink-nebula-border/50">
                <td className="py-2 text-pink-500 font-semibold w-24">Soldiers</td>
                <td className="text-right py-2 text-pink-500 font-mono w-24">
                  {formatNumber(summary.population.soldiers)}
                </td>
                <td className="text-right py-2 text-pink-nebula-muted font-mono w-14">
                  {formatWithK(summary.housing.soldierCap)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-blue-400 font-semibold w-24">Scientists</td>
                <td className="text-right py-2 text-blue-400 font-mono w-24">
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
          </div>
        </div>

        {/* Space Section */}
        <div className="bg-pink-nebula-bg rounded-lg p-3">
          <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Space Remaining</h3>
          <div className="space-y-3">
            {/* Ground */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-pink-nebula-text font-semibold">Ground</span>
                <span className="text-pink-nebula-text font-mono">
                  {summary.space.groundCap - summary.space.groundUsed}
                </span>
              </div>
              <div className="w-full bg-pink-nebula-panel rounded-full h-2">
                <div
                  className="bg-pink-nebula-accent-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((summary.space.groundCap - summary.space.groundUsed) / summary.space.groundCap) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
            {/* Orbital */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-pink-nebula-text font-semibold">Orbital</span>
                <span className="text-pink-nebula-text font-mono">
                  {summary.space.orbitalCap - summary.space.orbitalUsed}
                </span>
              </div>
              <div className="w-full bg-pink-nebula-panel rounded-full h-2">
                <div
                  className="bg-pink-nebula-accent-secondary h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((summary.space.orbitalCap - summary.space.orbitalUsed) / summary.space.orbitalCap) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Colonist Population Bars (UI-3) */}
            <div className="mt-4 pt-3 border-t border-pink-nebula-border/50">
              <div className="text-xs text-pink-nebula-muted mb-2 font-semibold">Population Capacity</div>
              <div className="flex items-end justify-between gap-2 h-24">
                {/* Workers Bar */}
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex flex-col justify-end">
                    <div
                      className="w-full bg-pink-nebula-text rounded-t transition-all"
                      style={{
                        height: `${Math.min(
                          100,
                          (summary.population.workersTotal / summary.housing.workerCap) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-pink-nebula-text font-mono">
                    {formatWithK(summary.population.workersTotal)}
                  </div>
                  <div className="text-xs text-pink-nebula-muted">Workers</div>
                </div>

                {/* Soldiers Bar */}
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex flex-col justify-end">
                    <div
                      className="w-full bg-pink-500 rounded-t transition-all"
                      style={{
                        height: `${Math.min(
                          100,
                          (summary.population.soldiers / summary.housing.soldierCap) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-pink-500 font-mono">
                    {formatWithK(summary.population.soldiers)}
                  </div>
                  <div className="text-xs text-pink-nebula-muted">Soldiers</div>
                </div>

                {/* Scientists Bar */}
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex-1 flex flex-col justify-end">
                    <div
                      className="w-full bg-blue-400 rounded-t transition-all"
                      style={{
                        height: `${Math.min(
                          100,
                          (summary.population.scientists / summary.housing.scientistCap) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-blue-400 font-mono">
                    {formatWithK(summary.population.scientists)}
                  </div>
                  <div className="text-xs text-pink-nebula-muted">Scientists</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ships Section - Table Layout */}
        <div className="bg-pink-nebula-bg rounded-lg p-3">
          <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Ships</h3>
          {shipsList.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-pink-nebula-muted border-b border-pink-nebula-border">
                  <th className="text-left pb-2">Type</th>
                  <th className="text-right pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {shipsList.map((ship, index) => (
                  <tr
                    key={ship.id}
                    className={`${index < shipsList.length - 1 ? 'border-b border-pink-nebula-border/50' : ''}`}
                  >
                    <td className="py-2 text-pink-nebula-text font-semibold">{ship.name}</td>
                    <td className="text-right py-2 text-pink-nebula-accent-secondary font-mono font-bold">
                      {ship.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-pink-nebula-muted text-center py-4">
              No ships built
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
