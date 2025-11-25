"use client";

import React from 'react';
import type { PlanetSummary as PlanetSummaryType } from '../lib/game/selectors';

export interface PlanetSummaryProps {
  summary: PlanetSummaryType;
}

/**
 * PlanetSummary - Display planet stocks, outputs, housing, space, and population
 *
 * Shows complete planet state including:
 * - Resource stocks and outputs per turn
 * - Space usage (ground/orbital)
 * - Housing capacity
 * - Population (workers, soldiers, scientists)
 * - Growth hint
 *
 * Ticket 14: UI component for planet overview
 */
export function PlanetSummary({ summary }: PlanetSummaryProps) {
  const resources = [
    { id: 'metal', label: 'Metal', color: 'text-pink-500' },
    { id: 'mineral', label: 'Mineral', color: 'text-blue-400' },
    { id: 'food', label: 'Food', color: 'text-green-400' },
    { id: 'energy', label: 'Energy', color: 'text-yellow-400' },
    { id: 'research_points', label: 'Research', color: 'text-purple-400' },
  ] as const;

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString('de-DE');
  };

  const formatOutput = (output: number) => {
    // Round to 1 decimal place for outputs
    const rounded = Math.round(output * 10) / 10;
    const formatted = rounded.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return output >= 0 ? `+${formatted}` : formatted;
  };

  const getResourceColor = (output: number) => {
    if (output > 0) return 'text-green-400';
    if (output < 0) return 'text-red-400';
    return 'text-pink-nebula-muted';
  };

  return (
    <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-6 space-y-6 w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-pink-nebula-text">Planet Summary</h2>
        <div className="text-sm text-pink-nebula-muted">Turn {summary.turn}</div>
      </div>

      {/* Resources Table */}
      <div>
        <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Resources</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-pink-nebula-muted border-b border-pink-nebula-border">
              <th className="text-left py-2">Resource</th>
              <th className="text-right py-2">Stored</th>
              <th className="text-right py-2">Abundance</th>
              <th className="text-right py-2">Output/Turn</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => {
              const stored = summary.stocks[resource.id];
              const abundance = summary.abundance[resource.id];
              const output = summary.outputsPerTurn[resource.id];
              const abundancePercent = Math.round(abundance * 100);

              // Adjust opacity based on abundance level
              const getAbundanceOpacity = (percent: number) => {
                if (percent < 50) return 'opacity-60';
                if (percent < 100) return 'opacity-80';
                return 'opacity-100';
              };

              return (
                <tr key={resource.id} className="border-b border-pink-nebula-border last:border-0">
                  <td className={`py-2 font-semibold ${resource.color}`}>{resource.label}</td>
                  <td className="text-right py-2 text-pink-nebula-text">{formatNumber(stored)}</td>
                  <td className={`text-right py-2 font-semibold ${resource.color} ${getAbundanceOpacity(abundancePercent)}`}>
                    {abundancePercent}%
                  </td>
                  <td className={`text-right py-2 font-semibold ${getResourceColor(output)}`}>
                    {formatOutput(output)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Space Usage */}
      <div>
        <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Space</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-pink-nebula-text">Ground</span>
            <span className="text-pink-nebula-text">
              {summary.space.groundUsed} / {summary.space.groundCap}
            </span>
          </div>
          <div className="w-full bg-pink-nebula-bg rounded-full h-2">
            <div
              className="bg-pink-nebula-accent-primary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (summary.space.groundUsed / summary.space.groundCap) * 100
                )}%`,
              }}
            />
          </div>

          <div className="flex justify-between items-center mt-3">
            <span className="text-pink-nebula-text">Orbital</span>
            <span className="text-pink-nebula-text">
              {summary.space.orbitalUsed} / {summary.space.orbitalCap}
            </span>
          </div>
          <div className="w-full bg-pink-nebula-bg rounded-full h-2">
            <div
              className="bg-pink-nebula-accent-secondary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (summary.space.orbitalUsed / summary.space.orbitalCap) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Population */}
      <div>
        <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Population</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-pink-nebula-bg rounded p-3">
            <div className="text-xs text-pink-nebula-muted mb-1">Workers</div>
            <div className="text-lg font-bold text-pink-nebula-text">
              {formatNumber(summary.population.workersTotal)}
            </div>
            <div className="text-xs text-pink-nebula-muted mt-1">
              {formatNumber(summary.population.workersIdle)} idle •{' '}
              {formatNumber(summary.population.workersBusy)} busy
            </div>
          </div>

          <div className="bg-pink-nebula-bg rounded p-3">
            <div className="text-xs text-pink-nebula-muted mb-1">Soldiers</div>
            <div className="text-lg font-bold text-pink-500">
              {formatNumber(summary.population.soldiers)}
            </div>
            <div className="text-xs text-pink-nebula-muted mt-1">
              Cap: {formatNumber(summary.housing.soldierCap)}
            </div>
          </div>

          <div className="bg-pink-nebula-bg rounded p-3">
            <div className="text-xs text-pink-nebula-muted mb-1">Scientists</div>
            <div className="text-lg font-bold text-blue-400">
              {formatNumber(summary.population.scientists)}
            </div>
            <div className="text-xs text-pink-nebula-muted mt-1">
              Cap: {formatNumber(summary.housing.scientistCap)}
            </div>
          </div>

          <div className="bg-pink-nebula-bg rounded p-3">
            <div className="text-xs text-pink-nebula-muted mb-1">Food Upkeep</div>
            <div className="text-lg font-bold text-green-400">
              {formatNumber(summary.foodUpkeep)}
            </div>
            <div className="text-xs text-pink-nebula-muted mt-1">per turn</div>
          </div>
        </div>
      </div>

      {/* Housing Capacity */}
      <div>
        <h3 className="text-sm font-semibold text-pink-nebula-muted mb-3">Housing Capacity</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-pink-nebula-text">Workers</span>
            <span className="text-pink-nebula-text">
              {formatNumber(summary.population.workersTotal)} /{' '}
              {formatNumber(summary.housing.workerCap)}
            </span>
          </div>
          <div className="w-full bg-pink-nebula-bg rounded-full h-2">
            <div
              className="bg-pink-nebula-accent-primary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (summary.population.workersTotal / summary.housing.workerCap) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Growth Hint */}
      <div className="bg-pink-nebula-bg rounded p-4 border-l-4 border-green-400">
        <div className="text-xs text-pink-nebula-muted mb-1">Next Turn Projection</div>
        <div className="text-sm text-pink-nebula-text font-semibold">{summary.growthHint}</div>
      </div>
    </div>
  );
}
