"use client";

import React from 'react';
import { AlertTriangle, Hammer, Hourglass, Minus, Pause, Plus, X } from 'lucide-react';
import type { LaneEntry } from '../../lib/game/selectors';
import { formatPlannedWaitTurns } from '../../lib/game/waitDuration';
import { DEMOLISH_PREFIX } from '../../lib/game/demolish';
import { formatTickTime, formatTickTimeFull } from '../../lib/utils/tickTime';
import { LANE_CONFIG } from '../../lib/constants/lanes';
import type { LaneId } from '../../lib/sim/engine/types';

export interface QueueLaneEntryProps {
  entry: LaneEntry;
  currentTurn: number;
  onCancel: () => void;
  onQuantityChange?: (newQuantity: number) => void;
  maxQuantity?: number;
  disabled?: boolean;
  isNewest?: boolean;
  def?: any; // ItemDefinition
  busyWorkers?: number;
  showQuantityInput?: boolean;
  onTurnClick?: (turn: number) => void;
  maxTurn?: number;
  showTimes?: boolean;
  roundStartMs?: number;
  laneId?: LaneId;
}

/**
 * QueueLaneEntry - one queue row on a fixed five-column grid (turns | item | qty | time | remove)
 * so every figure lines up down the list. Status is carried by tone: completed entries dim,
 * the active entry gets the H-alpha edge, invalid/delayed entries get a danger/caution edge.
 *
 * Memoized to prevent unnecessary re-renders when entry data hasn't changed
 */
export const QueueLaneEntry = React.memo(function QueueLaneEntry({
  entry,
  currentTurn,
  onCancel,
  onQuantityChange,
  maxQuantity,
  disabled = false,
  def,
  showQuantityInput = false,
  onTurnClick,
  maxTurn = 199,
  showTimes = false,
  roundStartMs,
  laneId,
}: QueueLaneEntryProps) {
  const isDemolish = entry.itemId?.startsWith(DEMOLISH_PREFIX) ?? false;
  const isAutoWait = entry.isAutoWait;
  const durationTurns = getDisplayDurationTurns(entry, def, currentTurn);
  const tone = rowTone(entry);

  return (
    <div className={`group border-b border-filament/60 py-1.5 pl-2 pr-3 transition-colors ${tone.row}`}>
      <div className="grid min-h-[2rem] grid-cols-[minmax(0,1fr)_auto_2.75rem_1.75rem] items-center gap-x-2 gap-y-0.5 text-sm font-semibold [grid-template-areas:'name_qty_dur_rm'_'range_range_range_range'] md:grid-cols-[auto_minmax(0,1fr)_auto_2.75rem_1.75rem] md:gap-x-3 md:text-sm md:[grid-template-areas:'range_name_qty_dur_rm']">
        <TurnRange entry={entry} showTimes={showTimes} roundStartMs={roundStartMs} onTurnClick={onTurnClick} maxTurn={maxTurn} />

        <div className={`flex min-w-0 items-center gap-1.5 [grid-area:name] ${tone.name}`}>
          <EntryName entry={entry} laneId={laneId} currentTurn={currentTurn} isDemolish={isDemolish} />
        </div>

        <div className="text-ink-2 [grid-area:qty]">
          {showQuantityInput && !disabled && !entry.isWait && !isAutoWait ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (onQuantityChange && entry.quantity > 1) onQuantityChange(entry.quantity - 1); }}
                disabled={entry.quantity <= 1}
                title="Decrease quantity"
                aria-label={`Decrease ${entry.itemName} quantity`}
                className="btn btn-ghost btn-sm btn-icon !h-6 !w-6"
              >
                <Minus aria-hidden="true" className="!h-3 !w-3" />
              </button>
              <span className="w-10 select-none text-center text-ink">{entry.quantity}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (onQuantityChange) onQuantityChange(entry.quantity + 1); }}
                disabled={maxQuantity !== undefined && entry.quantity >= maxQuantity}
                title={maxQuantity !== undefined && entry.quantity >= maxQuantity ? `Maximum: ${maxQuantity}` : 'Increase quantity'}
                aria-label={`Increase ${entry.itemName} quantity`}
                className="btn btn-ghost btn-sm btn-icon !h-6 !w-6"
              >
                <Plus aria-hidden="true" className="!h-3 !w-3" />
              </button>
            </div>
          ) : (
            <span className="block min-w-[2.5rem] text-right">{entry.isWait || isAutoWait || (!showQuantityInput && entry.quantity === 1) ? '' : `×${entry.quantity}`}</span>
          )}
        </div>

        <div className="text-right text-ink-2 [grid-area:dur]">{durationTurns}T</div>

        <div className="flex justify-end [grid-area:rm]">
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="btn btn-ghost btn-sm btn-icon !h-7 !w-7 text-ink-3 hover:!bg-danger/15 hover:!text-danger"
              title="Remove from queue"
              aria-label={`Remove ${entry.itemName} from queue`}
            >
              <X aria-hidden="true" className="!h-3.5 !w-3.5" />
            </button>
          )}
        </div>
      </div>

      {entry.invalid && entry.invalidReason && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-danger">
          <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {entry.invalidReason}
        </p>
      )}
      {!entry.invalid && entry.resourceDelayed && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-caution">
          <Hourglass aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {entry.resourceDelayReason ?? 'Waiting for resources to accumulate'}
        </p>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to optimize re-renders — compares every field the
  // render body reads (deduped; keep in sync with the JSX below).
  return (
    prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.status === nextProps.entry.status &&
    prevProps.entry.quantity === nextProps.entry.quantity &&
    prevProps.entry.eta === nextProps.entry.eta &&
    prevProps.entry.turnsRemaining === nextProps.entry.turnsRemaining &&
    prevProps.entry.invalid === nextProps.entry.invalid &&
    prevProps.entry.isAutoWait === nextProps.entry.isAutoWait &&
    prevProps.entry.startTurn === nextProps.entry.startTurn &&
    prevProps.entry.queuedTurn === nextProps.entry.queuedTurn &&
    prevProps.entry.completionTurn === nextProps.entry.completionTurn &&
    prevProps.currentTurn === nextProps.currentTurn &&
    prevProps.maxQuantity === nextProps.maxQuantity &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.isNewest === nextProps.isNewest &&
    prevProps.busyWorkers === nextProps.busyWorkers &&
    prevProps.showQuantityInput === nextProps.showQuantityInput &&
    prevProps.def?.durationTurns === nextProps.def?.durationTurns &&
    prevProps.def?.duration === nextProps.def?.duration &&
    prevProps.maxTurn === nextProps.maxTurn &&
    prevProps.showTimes === nextProps.showTimes &&
    prevProps.roundStartMs === nextProps.roundStartMs &&
    prevProps.laneId === nextProps.laneId &&
    prevProps.entry.resourceDelayed === nextProps.entry.resourceDelayed &&
    prevProps.entry.resourceDelayReason === nextProps.entry.resourceDelayReason
  );
});

function getDisplayWaitTurns(entry: LaneEntry, currentTurn?: number): number | string {
  if (!entry.isWait) return entry.turnsRemaining;
  return formatPlannedWaitTurns(entry, currentTurn);
}

function getDisplayDurationTurns(entry: LaneEntry, def?: any, currentTurn?: number): number | string {
  if (entry.isWait) return getDisplayWaitTurns(entry, currentTurn);
  if (entry.status === 'active' && def?.durationTurns != null) return def.durationTurns;
  if (entry.turnsRemaining > 0) return entry.turnsRemaining;
  if (def?.durationTurns !== undefined || def?.duration !== undefined) {
    return def?.durationTurns ?? def?.duration;
  }

  const start = entry.startTurn ?? entry.queuedTurn;
  const end = entry.completionTurn ?? entry.eta ?? undefined;
  if (start !== undefined && end !== undefined && end >= start) {
    return end - start + 1;
  }

  return entry.turnsRemaining ?? '—';
}

function rowTone(entry: LaneEntry): { row: string; name: string } {
  if (entry.invalid) return { row: 'bg-danger/[0.06] shadow-[inset_2px_0_0_#FF7A7A]', name: 'text-ink' };
  if (entry.resourceDelayed) return { row: 'shadow-[inset_2px_0_0_#F5B544]', name: 'text-ink' };
  if (entry.status === 'active') return { row: 'bg-halpha-deep shadow-[inset_2px_0_0_#F2508C]', name: 'text-ink' };
  if (entry.status === 'completed') return { row: '', name: 'text-ink-3' };
  return { row: 'hover:bg-veil/60', name: 'text-ink' };
}

interface TurnRangeProps {
  entry: LaneEntry;
  showTimes: boolean;
  roundStartMs?: number;
  onTurnClick?: (turn: number) => void;
  maxTurn: number;
}

/** "T5 – T8" as two jump buttons: start turn, and the first turn the item is complete. */
function TurnRange({ entry, showTimes, roundStartMs, onTurnClick, maxTurn }: TurnRangeProps) {
  const startT = entry.startTurn ?? entry.queuedTurn ?? '?';
  const endT = entry.completionTurn ?? (entry.eta !== null ? entry.eta : '?');
  const label = (t: number | string) => (showTimes && t !== '?' ? formatTickTime(t as number, roundStartMs) : `T${t}`);
  const fullTitle = (t: number | string, fallback: string) =>
    showTimes && t !== '?' ? `T${t} · ${formatTickTimeFull(t as number, roundStartMs)}` : fallback;
  const linkClass = 'rounded px-0.5 text-ink-2 hover:bg-veil hover:text-ink';

  return (
    <div className={`flex items-center gap-0.5 text-xs font-medium text-ink-3 [grid-area:range] md:text-[13px] ${showTimes ? 'md:w-40' : 'md:w-28'}`}>
      <button
        type="button"
        className={linkClass}
        onClick={(e) => { e.stopPropagation(); if (startT !== '?' && onTurnClick) onTurnClick(startT as number); }}
        title={fullTitle(startT, 'Jump to start turn')}
      >
        {label(startT)}
      </button>
      <span aria-hidden="true">–</span>
      <button
        type="button"
        className={linkClass}
        onClick={(e) => { e.stopPropagation(); if (endT !== '?' && onTurnClick) onTurnClick(Math.min((endT as number) + 1, maxTurn)); }}
        title={fullTitle(endT, 'Jump to first turn where item is complete')}
      >
        {label(endT)}
      </button>
    </div>
  );
}

function EntryName({ entry, laneId, currentTurn, isDemolish }: { entry: LaneEntry; laneId?: LaneId; currentTurn: number; isDemolish: boolean }) {
  const laneSuffix = laneId ? ` [${LANE_CONFIG[laneId].title}]` : '';
  const waitTurns = getDisplayWaitTurns(entry, currentTurn);
  if (entry.isAutoWait) {
    const text = `Auto-wait${laneSuffix}: ${waitTurns}t (resource gap)`;
    return (
      <>
        <Hourglass aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-3" />
        <span className="truncate italic text-ink-3" title={text}>{text}</span>
      </>
    );
  }
  if (entry.isWait) {
    const text = `Manual wait${laneSuffix}: ${waitTurns}t`;
    return (
      <>
        <Pause aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-3" />
        <span className="truncate text-ink-2" title={text}>{text}</span>
      </>
    );
  }
  if (isDemolish) {
    return (
      <>
        <Hammer aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-danger" />
        <span className="truncate text-danger" title={entry.itemName}>{entry.itemName}</span>
      </>
    );
  }
  return <span className="truncate" title={entry.itemName}>{entry.itemName}</span>;
}
