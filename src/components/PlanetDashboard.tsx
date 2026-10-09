"use client";

import React, { useMemo } from 'react';
import { AlertTriangle, ExternalLink, Hammer } from 'lucide-react';
import type { PlanetSummary as PlanetSummaryType } from '../lib/game/selectors';
import { ManualLink } from '@/components/ui/ManualLink';
import { MANUAL_LINKS } from '../lib/constants/manualLinks';
import { ItemIcon } from '@/components/ui/ItemIcon';
import { RESOURCE_META, formatSigned, formatThousands, formatWithK } from '@/components/ui/resources';
import { STARTING_PLANET_LIMIT, STARTING_QUEUE_LENGTH } from '../lib/sim/rules/constants';

export interface PlanetDashboardProps {
  summary: PlanetSummaryType;
  defs: Record<string, any>;
  turnsToHousingCap?: number | null;
  /** True when a building activated this turn using projected production to cover costs */
  stocksEstimated?: boolean;
  /** Called when the player clicks a building name to schedule demolition. */
  onDemolish?: (structureId: string) => void;
  /** Set of structure IDs that are safe to schedule for demolition right now. */
  demolishableIds?: ReadonlySet<string>;
}

const SHIP_SORT_ORDER: Record<string, number> = {
  outpost_ship: 0,
  scout: 1,
  freighter: 2,
  invasion_ship: 3,
  fighter: 4,
  bomber: 5,
  frigate: 6,
  destroyer: 7,
  cruiser: 8,
  battleship: 9,
};

const STOCK_RESOURCES = ['metal', 'mineral', 'food', 'energy', 'research_points'] as const;

function titleCaseId(id: string): string {
  return id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function signedOrBlank(value: number): string {
  return value !== 0 ? formatSigned(value) : '';
}

interface DashPanelProps {
  title: string;
  href: string;
  manualLabel: string;
  extra?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}

/** One economy panel: linked title (opens the IC manual), optional meta on the right, body. */
function DashPanel({ title, href, manualLabel, extra, meta, children }: DashPanelProps) {
  return (
    <section className="panel flex min-w-0 flex-col">
      <header className="panel-head">
        <h2 className="panel-title">
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={manualLabel} className="group inline-flex items-center gap-1.5 hover:text-ink">
            {title}
            <ExternalLink aria-hidden="true" className="h-3 w-3 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </a>
        </h2>
        {extra}
        {meta && <div className="ml-auto text-xs font-semibold text-ink-3">{meta}</div>}
      </header>
      <div className="flex flex-1 flex-col px-4 pb-3 pt-2">{children}</div>
    </section>
  );
}

export const PlanetDashboard = React.memo(function PlanetDashboard({ summary, defs, turnsToHousingCap, stocksEstimated, onDemolish, demolishableIds }: PlanetDashboardProps) {
  const shipsList = useMemo(() => {
    return Object.entries(summary.ships)
      .map(([shipId, count]) => ({ id: shipId, name: defs[shipId]?.name || titleCaseId(shipId), count }))
      .sort((a, b) => {
        const pa = SHIP_SORT_ORDER[a.id] ?? 99;
        const pb = SHIP_SORT_ORDER[b.id] ?? 99;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
  }, [summary.ships, defs]);

  const structuresList = useMemo(
    () => buildStructureRows(summary, defs),
    [summary, defs],
  );

  const groundFree = Math.max(0, summary.space.groundCap - summary.space.groundUsed);
  const orbitalFree = Math.max(0, summary.space.orbitalCap - summary.space.orbitalUsed);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1.5fr)]">
      <DashPanel title="Resources" href={MANUAL_LINKS.resources} manualLabel="IC manual: resources">
        <ResourcesTable summary={summary} stocksEstimated={stocksEstimated} />
      </DashPanel>

      <DashPanel title="Population" href={MANUAL_LINKS.colonists} manualLabel="IC manual: colonists">
        <PopulationTable summary={summary} turnsToHousingCap={turnsToHousingCap} />
      </DashPanel>

      <DashPanel
        title="Ships"
        href={MANUAL_LINKS.ships}
        manualLabel="IC manual: ships"
        extra={<ManualLink topic="travelTimes" label="IC manual: travel times" />}
      >
        {shipsList.length > 0 ? (
          <ul className="flex flex-col">
            {shipsList.map((ship) => (
              <li key={ship.id} className="flex h-8 items-center justify-between border-b border-filament/60 text-sm font-semibold last:border-0">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <ItemIcon itemId={ship.id} size={18} />
                  <span className="truncate">{ship.name}</span>
                </span>
                <span className="text-ink-2">×{ship.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-ink-3">No ships</p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-filament pt-2 text-sm font-semibold">
          <span className="text-ink-2">Planet limit</span>
          <span className="font-semibold text-ink">{summary.planetLimit || STARTING_PLANET_LIMIT}</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-sm font-semibold">
          <span className="text-ink-2">Queue length</span>
          <span className="font-semibold text-ink">{summary.queueLength || STARTING_QUEUE_LENGTH}</span>
        </div>
      </DashPanel>

      <DashPanel
        title="Buildings"
        href={MANUAL_LINKS.structures}
        manualLabel="IC manual: structures"
        meta={<><span className={RESOURCE_META.space.text}>{groundFree} GS</span>{' · '}<span className={RESOURCE_META.space_orbital.text}>{orbitalFree} OS</span>{' free'}</>}
      >
        {structuresList.length > 0 ? (
          <BuildingsTable rows={structuresList} defs={defs} onDemolish={onDemolish} demolishableIds={demolishableIds} />
        ) : (
          <p className="py-4 text-center text-sm text-ink-3">No buildings</p>
        )}
      </DashPanel>
    </div>
  );
});

function ResourcesTable({ summary, stocksEstimated }: { summary: PlanetSummaryType; stocksEstimated?: boolean }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th className="text-left">Resource</th>
          <th className="text-right">Stock</th>
          <th className="text-right">Abund.</th>
          <th className="text-right">Per turn</th>
        </tr>
      </thead>
      <tbody>
        {STOCK_RESOURCES.map((id) => {
          const meta = RESOURCE_META[id];
          const output = summary.outputsPerTurn[id] ?? 0;
          return (
            <tr key={id}>
              <td className={`font-semibold ${meta.text}`}>{meta.label}</td>
              <td
                className={`text-right ${stocksEstimated ? 'cursor-help italic text-ink-2' : 'text-ink'}`}
                title={stocksEstimated ? 'A building started this turn using this turn\'s production to cover its cost. Stocks settle within the same turn.' : undefined}
              >
                {formatThousands(summary.stocks[id] ?? 0)}
              </td>
              <td className="text-right text-ink-3">{`${((summary.abundance[id] ?? 1) * 100).toFixed(0)}%`}</td>
              <td className={`text-right font-semibold ${output < 0 ? 'text-danger' : meta.text}`}>{formatSigned(output)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PopulationTable({ summary, turnsToHousingCap }: { summary: PlanetSummaryType; turnsToHousingCap?: number | null }) {
  const plural = (n: number) => (n !== 1 ? 's' : '');
  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th className="text-left">Type</th>
            <th className="text-right">Count</th>
            <th className="text-right">Cap</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <WorkerGrowthTip summary={summary} turnsToHousingCap={turnsToHousingCap} />
            </td>
            <td className="text-right text-ink">{formatThousands(summary.population.workersTotal)}</td>
            <td className="text-right text-ink-3">{formatWithK(summary.housing.workerCap)}</td>
          </tr>
          <tr>
            <td className={`font-semibold ${RESOURCE_META.soldiers.text}`}>Soldiers</td>
            <td className="text-right text-ink">{formatThousands(summary.population.soldiers)}</td>
            <td className="text-right text-ink-3">{formatWithK(summary.housing.soldierCap)}</td>
          </tr>
          <tr>
            <td className={`font-semibold ${RESOURCE_META.scientists.text}`}>Scientists</td>
            <td className="text-right text-ink">{formatThousands(summary.population.scientists)}</td>
            <td className="text-right text-ink-3">{formatWithK(summary.housing.scientistCap)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-auto space-y-1 border-t border-filament pt-2 text-sm font-semibold">
        <div className="flex justify-between text-ink-2">
          <span>Busy {formatThousands(summary.population.workersBusy)}</span>
          <span>Idle {formatThousands(summary.population.workersIdle)}</span>
        </div>
        <div className="text-res-food">{summary.growthHint}</div>
        {turnsToHousingCap != null && turnsToHousingCap <= 6 && (
          <div className="flex items-center gap-1.5 font-semibold text-caution">
            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
            Workers reach housing cap in {turnsToHousingCap} turn{plural(turnsToHousingCap)}
          </div>
        )}
      </div>
    </>
  );
}

function WorkerGrowthTip({ summary, turnsToHousingCap }: { summary: PlanetSummaryType; turnsToHousingCap?: number | null }) {
  const detail = summary.workerGrowthDetail;
  return (
    <div className="group relative inline-block">
      <button
        type="button"
        className={`cursor-help rounded-sm font-semibold underline decoration-dotted underline-offset-2 ${RESOURCE_META.workers.text}`}
        aria-label="Worker growth details"
      >
        Workers
      </button>
      <div role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-56 rounded-ctl border border-filament bg-veil-hi p-2.5 text-xs shadow-xl group-focus-within:block group-hover:block">
        {detail ? (
          <div className="space-y-1">
            <div className="font-semibold text-ink">Growth rate: {detail.ratePercent}%/turn</div>
            {detail.turnsToDouble !== null && <div className="text-ink-2">Doubles in ~{detail.turnsToDouble} turns</div>}
            {turnsToHousingCap != null && (
              <div className="text-caution">Housing cap in {turnsToHousingCap} turn{turnsToHousingCap !== 1 ? 's' : ''}</div>
            )}
          </div>
        ) : (
          <div className="text-ink-2">No growth (need food &gt; 0)</div>
        )}
      </div>
    </div>
  );
}

interface StructureRow {
  id: string;
  name: string;
  count: number;
  tier: number;
  durationTurns: number;
  metalNet: number;
  mineralNet: number;
  foodNet: number;
  energyNet: number;
  space: number;
  isOrbital: boolean;
}

/** Net per-turn effect of every completed structure, abundance-scaled, sorted by tier then build time. */
function buildStructureRows(summary: PlanetSummaryType, defs: Record<string, any>): StructureRow[] {
  const rows = Object.entries(summary.structures).map(([structureId, count]) => {
    const def = defs[structureId];
    const scale = (resourceId: 'metal' | 'mineral' | 'food' | 'energy', production: number) =>
      def?.isAbundanceScaled ? production * summary.abundance[resourceId] : production;
    const net = (resourceId: 'metal' | 'mineral' | 'food' | 'energy') =>
      (scale(resourceId, def?.effectsOnComplete?.[`production_${resourceId}`] || 0) - (def?.upkeepPerUnit?.[resourceId] || 0)) * count;
    const isOrbital = (def?.costsPerUnit?.space_orbital || 0) > 0;
    return {
      id: structureId,
      name: def?.name || titleCaseId(structureId),
      count,
      tier: def?.tier || 0,
      durationTurns: def?.durationTurns || 0,
      metalNet: net('metal'),
      mineralNet: net('mineral'),
      foodNet: net('food'),
      energyNet: net('energy'),
      space: (isOrbital ? def?.costsPerUnit?.space_orbital || 0 : def?.costsPerUnit?.space || 0) * count,
      isOrbital,
    };
  });
  return rows.sort((a, b) => a.tier - b.tier || a.durationTurns - b.durationTurns || a.name.localeCompare(b.name));
}

interface BuildingsTableProps {
  rows: StructureRow[];
  defs: Record<string, any>;
  onDemolish?: (structureId: string) => void;
  demolishableIds?: ReadonlySet<string>;
}

function BuildingsTable({ rows, defs, onDemolish, demolishableIds }: BuildingsTableProps) {
  const netColumns = [
    { key: 'metalNet', meta: RESOURCE_META.metal },
    { key: 'mineralNet', meta: RESOURCE_META.mineral },
    { key: 'foodNet', meta: RESOURCE_META.food },
    { key: 'energyNet', meta: RESOURCE_META.energy },
  ] as const;

  return (
    <div className="scroll-nebula -mr-2 max-h-[232px] overflow-auto pr-2">
      <table className="data-table min-w-104">
        <thead className="sticky top-0 z-10 bg-dust">
          <tr>
            <th className="text-left">Building</th>
            <th className="w-9 text-right">Qty</th>
            <th className="w-9 text-right" title="Space used (ground or orbital)">Sp</th>
            {netColumns.map((col) => (
              <th key={col.key} className={`w-12 text-right ${col.meta.text}`} title={`${col.meta.label} per turn`}>{col.meta.short}</th>
            ))}
            {onDemolish && <th className="w-7"><span className="sr-only">Demolish</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="min-w-34 max-w-0">
                <span className="flex min-w-0 items-center gap-1.5 text-ink" title={row.name}>
                  <ItemIcon itemId={row.id} size={16} />
                  <span className="truncate">{row.name}</span>
                </span>
              </td>
              <td className="text-right text-ink-2">×{row.count}</td>
              <td className={`text-right ${row.isOrbital ? RESOURCE_META.space_orbital.text : RESOURCE_META.space.text}`}>{row.space > 0 ? row.space : ''}</td>
              {netColumns.map((col) => (
                <td key={col.key} className={`text-right ${row[col.key] < 0 ? 'text-ink-3' : col.meta.text}`}>{signedOrBlank(row[col.key])}</td>
              ))}
              {onDemolish && (
                <td className="text-right">
                  <DemolishButton row={row} defs={defs} onDemolish={onDemolish} demolishable={demolishableIds?.has(row.id) ?? false} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemolishButton({ row, defs, onDemolish, demolishable }: { row: StructureRow; defs: Record<string, any>; onDemolish: (id: string) => void; demolishable: boolean }) {
  const turns = Math.max(1, Math.ceil((defs[row.id]?.durationTurns ?? 1) / 2));
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (demolishable) onDemolish(row.id); }}
      title={demolishable ? `Demolish ${row.name} (${turns}T) — click to queue` : `Cannot demolish: another completed building requires ${row.name}`}
      aria-label={`Demolish ${row.name}`}
      disabled={!demolishable}
      className="btn btn-ghost btn-sm btn-icon text-ink-3 hover:text-danger! disabled:opacity-30"
    >
      <Hammer aria-hidden="true" className="h-3.5! w-3.5!" />
    </button>
  );
}
