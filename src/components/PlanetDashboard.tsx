"use client";

import React, { useMemo } from 'react';
import type { PlanetSummary as PlanetSummaryType } from '../lib/game/selectors';
import { Card } from '@/components/ui/card';

export interface PlanetDashboardProps {
  summary: PlanetSummaryType;
  defs: Record<string, any>;
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
export function PlanetDashboard({ summary, defs }: PlanetDashboardProps) {
  const resources = [
    { id: 'metal', label: 'Metal', color: 'text-gray-300' }, // silver
    { id: 'mineral', label: 'Mineral', color: 'text-red-500' }, // red
    { id: 'food', label: 'Food', color: 'text-green-500' }, // green
    { id: 'energy', label: 'Energy', color: 'text-blue-400' }, // blue
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

  // Calculate turns until population growth stops
  const turnsUntilGrowthStops = useMemo(() => {
    // Growth stops when either:
    // 1. Workers hit housing cap
    // 2. Food output becomes <= 0

    const foodOutput = summary.outputsPerTurn.food;
    const currentWorkers = summary.population.workersTotal;
    const housingCap = summary.housing.workerCap;

    // If food is already <= 0, growth has stopped
    if (foodOutput <= 0) {
      return 0;
    }

    // If at or above housing cap, growth has stopped
    if (currentWorkers >= housingCap) {
      return 0;
    }

    // Calculate turns until housing cap is reached
    // Assuming constant growth rate from growthHint
    const growthMatch = summary.growthHint.match(/\+(\d+) workers/);
    const workersPerTurn = growthMatch ? parseInt(growthMatch[1]) : 0;

    if (workersPerTurn <= 0) {
      return 0;
    }

    const turnsToHousingCap = Math.ceil((housingCap - currentWorkers) / workersPerTurn);

    // Calculate turns until food runs out
    // Food consumption per turn = foodUpkeep
    const currentFood = summary.stocks.food;
    const turnsToNoFood = foodOutput > 0 ? Infinity : Math.floor(currentFood / summary.foodUpkeep);

    return Math.min(turnsToHousingCap, turnsToNoFood);
  }, [summary]);

  // Get ship names from item IDs
  const shipsList = Object.entries(summary.ships).map(([shipId, count]) => ({
    id: shipId,
    name: shipId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    count,
  }));

  // Get structure list with formatted display info
  const structuresList = useMemo(() => {
    const structures = Object.entries(summary.structures).map(([structureId, count]) => {
      const def = defs[structureId];
      const name = def?.name || structureId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      // Calculate individual resource outputs/consumption
      const metalOut = def?.effectsOnComplete?.production_metal || 0;
      const mineralOut = def?.effectsOnComplete?.production_mineral || 0;
      const foodOut = def?.effectsOnComplete?.production_food || 0;
      const energyOut = def?.effectsOnComplete?.production_energy || 0;
      const metalIn = def?.upkeepPerUnit?.metal || 0;
      const mineralIn = def?.upkeepPerUnit?.mineral || 0;
      const foodIn = def?.upkeepPerUnit?.food || 0;
      const energyIn = def?.upkeepPerUnit?.energy || 0;

      // Determine if this structure uses orbital space (orbital_facility subcategory)
      const isOrbital = def?.subcategory === 'orbital_facility';
      const spaceAmount = (def?.costsPerUnit?.space || 0) * count;

      return {
        id: structureId,
        name,
        count,
        tier: def?.tier || 0,
        durationTurns: def?.durationTurns || 0,
        // Total outputs/consumption for all of this structure type
        metalNet: (metalOut - metalIn) * count,
        mineralNet: (mineralOut - mineralIn) * count,
        foodNet: (foodOut - foodIn) * count,
        energyNet: (energyOut - energyIn) * count,
        space: spaceAmount,
        isOrbital,
      };
    });

    // Sort: tier (ascending) > duration (ascending) > name (alphabetical)
    structures.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.durationTurns !== b.durationTurns) return a.durationTurns - b.durationTurns;
      return a.name.localeCompare(b.name);
    });

    return structures;
  }, [summary.structures, defs]);

  return (
    <div className="w-full max-w-[1800px] mx-auto px-6 my-4">
      <Card className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 glow-tyr border-gray-400/30">
        {/* Resources Section - Table Layout */}
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
        </Card>

        {/* Population + Housing Section - Table Layout */}
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
                <td className="py-2 text-orange-400 font-semibold w-24">Workers</td>
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
          </div>
        </Card>

        {/* Space Section */}
        <Card className="p-3">
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

            {/* Population Growth Countdown */}
            <div className="mt-4 pt-3 border-t border-pink-nebula-border/50">
              <div className="text-xs text-pink-nebula-muted mb-2 font-semibold">Growth Countdown</div>
              <div className="w-full bg-pink-nebula-panel rounded-full h-3 relative overflow-hidden">
                {turnsUntilGrowthStops > 0 ? (
                  <>
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-yellow-400 transition-all"
                      style={{ width: '100%' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-pink-nebula-bg drop-shadow">
                        {turnsUntilGrowthStops}T until cap
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full bg-red-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-red-300">
                      Growth stopped
                    </span>
                  </div>
                )}
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
        </Card>

        {/* Ships Section - Fleet Overview */}
        <Card className="p-3">
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
                {shipsList.map((ship) => (
                  <tr key={ship.id} className="border-b border-pink-nebula-border/50 last:border-0">
                    <td className="py-2 text-pink-nebula-text font-semibold">
                      {ship.name}
                    </td>
                    <td className="text-right py-2 text-pink-nebula-text font-mono">
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
        </Card>
      </Card>
    </div>
  );
}
