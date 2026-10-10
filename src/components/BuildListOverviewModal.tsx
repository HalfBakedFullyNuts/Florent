"use client";

import React, { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ListTree } from 'lucide-react';
import { Modal } from './ui/Modal';
import { RESOURCE_META, formatSigned, formatThousands } from './ui/resources';
import { LANE_CONFIG } from '../lib/constants/lanes';
import { buildOverviewRows, OVERVIEW_LANES, type OverviewRow } from '../lib/game/buildListOverview';
import { describePlanProblem, type PlanProblem } from '../lib/game/planDiagnostics';
import type { LaneEntry } from '../lib/game/selectors';
import type { LaneId } from '../lib/sim/engine/types';

const STAT_RESOURCES = ['metal', 'mineral', 'food', 'energy', 'research_points'] as const;
const CARD_HEIGHT_PX = 230;
type StatResource = (typeof STAT_RESOURCES)[number];

export interface TurnStats {
  stocks: Record<StatResource, number>;
  income: Record<StatResource, number>;
  population: { workers: number; soldiers: number; scientists: number };
}

export interface BuildListOverviewModalProps {
  planetName: string;
  lanes: Record<LaneId, LaneEntry[]>;
  problems: PlanProblem[];
  nameOf: (itemId: string) => string;
  statsAt: (turn: number) => TurnStats | null;
  onJumpToTurn: (turn: number) => void;
  onClose: () => void;
}

/** The whole build list of one planet: lanes side by side, rows by start turn, problems highlighted. */
export function BuildListOverviewModal({ planetName, lanes, problems, nameOf, statsAt, onJumpToTurn, onClose }: BuildListOverviewModalProps) {
  const rows = useMemo(() => buildOverviewRows(lanes, problems), [lanes, problems]);
  return (
    <Modal
      onClose={onClose}
      title="Entire build list"
      description={`${planetName} · every lane, by the turn each entry starts. Hover a turn for the planet's stats; click it to jump there.`}
      icon={<ListTree className="h-5 w-5" />}
      widthClass="max-w-6xl"
    >
      {problems.length > 0 && <ProblemSummary problems={problems} nameOf={nameOf} />}
      <div className="scroll-nebula max-h-[65vh] overflow-auto rounded-ctl border border-filament">
        <table aria-label={`Build list of ${planetName}`} className="w-full min-w-[44rem] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-dust">
            <tr>
              <th scope="col" className="eyebrow w-20 px-3 py-2 text-left">Turn</th>
              {OVERVIEW_LANES.map((laneId) => (
                <th key={laneId} scope="col" className="eyebrow px-3 py-2 text-left">{LANE_CONFIG[laneId].title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <OverviewTableRow key={row.turn ?? 'never'} row={row} nameOf={nameOf} statsAt={statsAt} onJumpToTurn={onJumpToTurn} />
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ProblemSummary({ problems, nameOf }: { problems: PlanProblem[]; nameOf: (itemId: string) => string }) {
  return (
    <div className="callout border-l-danger mb-3 flex-col gap-1">
      <span className="flex items-center gap-2 font-semibold text-danger">
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        {problems.length} problem{problems.length === 1 ? '' : 's'} in this build list, marked in red below
      </span>
      <ul className="text-ink-2">
        {problems.map((problem) => {
          const text = describePlanProblem(problem, nameOf);
          return <li key={`${problem.kind}:${problem.entryId ?? ''}:${problem.turn}`}>{text.turnLabel} · {text.title}: {text.detail}</li>;
        })}
      </ul>
    </div>
  );
}

interface RowProps {
  row: OverviewRow;
  nameOf: (itemId: string) => string;
  statsAt: (turn: number) => TurnStats | null;
  onJumpToTurn: (turn: number) => void;
}

function OverviewTableRow({ row, nameOf, statsAt, onJumpToTurn }: RowProps) {
  const hasProblem = row.problems.length > 0 || OVERVIEW_LANES.some((laneId) => row.cells[laneId].some((entry) => entry.invalid));
  return (
    <tr data-problem={hasProblem ? 'true' : undefined} className={`border-t border-filament/60 align-top ${hasProblem ? 'bg-danger/6' : ''}`}>
      <th scope="row" className="px-3 py-2 text-left font-semibold">
        {row.turn === null
          ? <span className="text-danger">Never starts</span>
          : <TurnCell turn={row.turn} hasProblem={hasProblem} statsAt={statsAt} onJumpToTurn={onJumpToTurn} />}
      </th>
      {OVERVIEW_LANES.map((laneId) => (
        <td key={laneId} className="px-3 py-2">
          {row.cells[laneId].map((entry) => <OverviewEntry key={entry.id} entry={entry} />)}
          {laneId === 'building' && row.problems.map((problem) => {
            const text = describePlanProblem(problem, nameOf);
            return <p key={`${problem.kind}:${problem.turn}`} className="text-xs font-semibold text-danger">{text.turnLabel}: {text.title} ({text.detail})</p>;
          })}
        </td>
      ))}
    </tr>
  );
}

function OverviewEntry({ entry }: { entry: LaneEntry }) {
  const name = entry.isWait ? 'Wait' : entry.itemName;
  const quantity = !entry.isWait && entry.quantity > 1 ? ` ×${formatThousands(entry.quantity)}` : '';
  const span = entry.startTurn !== undefined && entry.completionTurn !== undefined ? `T${entry.startTurn}–T${entry.completionTurn}` : '';
  return (
    <div className={`mb-1 last:mb-0 ${entry.invalid ? 'text-danger' : entry.isWait ? 'text-ink-3' : 'text-ink'}`}>
      <span className="font-semibold">{name}{quantity}</span>
      {span && <span className="ml-1.5 text-xs text-ink-3">{span}</span>}
      {entry.invalid && entry.invalidReason && <p className="text-xs">{entry.invalidReason}</p>}
    </div>
  );
}

function TurnCell({ turn, hasProblem, statsAt, onJumpToTurn }: { turn: number; hasProblem: boolean; statsAt: RowProps['statsAt']; onJumpToTurn: RowProps['onJumpToTurn'] }) {
  // Viewport anchor: the card is portalled to <body> so neither the scrolling table nor the modal clips it.
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const tooltipId = useId();
  const stats = anchor ? statsAt(turn) : null;
  const show = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    setAnchor({ left: rect.right + 8, top: Math.max(8, Math.min(rect.top, viewportHeight - CARD_HEIGHT_PX - 8)) });
  };
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => onJumpToTurn(turn)}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setAnchor(null)}
        aria-describedby={stats ? tooltipId : undefined}
        className={`rounded-sm px-1 hover:underline ${hasProblem ? 'text-danger' : 'text-halpha-soft'}`}
      >
        T{turn}
      </button>
      {stats && anchor && createPortal(<TurnStatsCard id={tooltipId} turn={turn} stats={stats} anchor={anchor} />, document.body)}
    </span>
  );
}

function TurnStatsCard({ id, turn, stats, anchor }: { id: string; turn: number; stats: TurnStats; anchor: { left: number; top: number } }) {
  return (
    <span
      id={id}
      role="tooltip"
      className="pointer-events-none fixed z-[60] block w-60 rounded-ctl border border-oiii/60 bg-veil-hi p-2.5 text-xs font-normal shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      style={{ left: anchor.left, top: anchor.top }}
    >
      <span className="eyebrow mb-1 block">Start of T{turn}</span>
      <span className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5">
        {STAT_RESOURCES.map((resource) => (
          <React.Fragment key={resource}>
            <span className={RESOURCE_META[resource].text}>{RESOURCE_META[resource].label}</span>
            <span className="text-right text-ink">{formatThousands(Math.round(stats.stocks[resource]))}</span>
            <span className="text-right text-ink-2">{formatSigned(Math.round(stats.income[resource]))}</span>
          </React.Fragment>
        ))}
      </span>
      <span className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 border-t border-filament pt-1.5">
        <span className="text-ink-2">Workers</span><span className="text-right text-ink">{formatThousands(stats.population.workers)}</span>
        <span className="text-ink-2">Soldiers</span><span className="text-right text-ink">{formatThousands(stats.population.soldiers)}</span>
        <span className="text-ink-2">Scientists</span><span className="text-right text-ink">{formatThousands(stats.population.scientists)}</span>
      </span>
    </span>
  );
}
