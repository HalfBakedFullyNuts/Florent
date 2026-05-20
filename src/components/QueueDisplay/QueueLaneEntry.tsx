"use client";

import React from 'react';
import type { LaneEntry } from '../../lib/game/selectors';
import { formatPlannedWaitTurns } from '../../lib/game/waitDuration';
import { DEMOLISH_PREFIX } from '../../lib/game/demolish';
import { formatTickTime, formatTickTimeFull } from '../../lib/utils/tickTime';

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
}

/**
 * QueueLaneEntry - Planet Queue entry display with structured table-like layout
 *
 * Shows: Item name, quantity, duration, completion turn
 * Vertically aligned columns for all figures
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
  isNewest = false,
  def,
  busyWorkers = 0,
  showQuantityInput = false,
  onTurnClick,
  maxTurn = 199,
  showTimes = false,
}: QueueLaneEntryProps) {
  const isDemolish = entry.itemId?.startsWith(DEMOLISH_PREFIX) ?? false;

  // Determine status color
  const statusColor = entry.status === 'active' ? 'border-l-4 border-l-yellow-500' :
    entry.status === 'pending' ? 'border-l-4 border-l-blue-500' :
      entry.status === 'completed' ? 'border-l-4 border-l-green-500' : '';

  const isAutoWait = entry.isAutoWait;
  const waitTurns = getDisplayWaitTurns(entry, currentTurn);
  const durationTurns = getDisplayDurationTurns(entry, def, currentTurn);

  // Determine border/background override from validation state
  const outerBorder = entry.invalid
    ? 'border-red-500/60'
    : entry.resourceDelayed
      ? 'border-yellow-500/50'
      : isDemolish
        ? 'border-red-800/40'
        : 'border-pink-nebula-border';

  const outerBg = entry.invalid
    ? 'bg-red-900/10'
    : entry.resourceDelayed
      ? 'bg-yellow-900/5'
      : isAutoWait
        ? 'bg-pink-nebula-panel/20 opacity-60 italic'
        : isDemolish
          ? 'bg-red-950/30'
          : 'bg-pink-nebula-panel/50';

  return (
    <div
      className={`w-full text-left px-3 py-2 ${outerBg} border ${outerBorder} rounded transition-colors group ${statusColor}`}
    >
      {/* Structured table-like layout */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 md:gap-x-4 items-center text-xs md:text-sm font-mono">
        {/* Turn Range: Tx - Ty (or wall-clock times when showTimes) */}
        <div className={`text-pink-nebula-muted flex items-center gap-1 ${showTimes ? 'w-36 md:w-40' : 'w-20 md:w-24'}`}>
          {(() => {
            const startT = entry.startTurn ?? entry.queuedTurn ?? '?';
            const endT = entry.completionTurn ?? (entry.eta !== null ? entry.eta : '?');
            const startLabel = showTimes && startT !== '?' ? formatTickTime(startT as number) : `T${startT}`;
            const endLabel = showTimes && endT !== '?' ? formatTickTime(endT as number) : `T${endT}`;
            const startTitle = showTimes && startT !== '?' ? `T${startT} · ${formatTickTimeFull(startT as number)}` : 'Jump to start turn';
            const endTitle = showTimes && endT !== '?' ? `T${endT} · ${formatTickTimeFull(endT as number)}` : 'Jump to first turn where item is complete';
            return (
              <>
                <button
                  className="hover:text-pink-nebula-accent-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); if (startT !== '?' && onTurnClick) onTurnClick(startT as number); }}
                  title={startTitle}
                >
                  {startLabel}
                </button>
                <span>-</span>
                <button
                  className="hover:text-pink-nebula-accent-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); if (endT !== '?' && onTurnClick) onTurnClick(Math.min((endT as number) + 1, maxTurn)); }}
                  title={endTitle}
                >
                  {endLabel}
                </button>
              </>
            );
          })()}
        </div>

        {/* Item Name */}
        <div className={`truncate ${isAutoWait ? 'text-pink-nebula-muted' : isDemolish ? 'text-red-300' : 'text-pink-nebula-text'}`}>
          {isAutoWait
            ? `⏳ Auto-wait: ${waitTurns}t (resource gap)`
            : entry.isWait
              ? `⏳ Manual wait: ${waitTurns}t`
              : isDemolish
                ? `🔨 ${entry.itemName}`
                : entry.itemName}
        </div>

        {/* Quantity */}
        <div className="text-pink-nebula-text">
          {showQuantityInput && !disabled ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (onQuantityChange && entry.quantity > 1) onQuantityChange(entry.quantity - 1); }}
                disabled={entry.quantity <= 1}
                title="Decrease quantity"
                className="w-5 h-5 flex items-center justify-center bg-pink-nebula-bg/70 border border-pink-nebula-border rounded text-pink-nebula-muted hover:border-pink-nebula-accent-primary hover:text-pink-nebula-text disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-none text-base"
              >
                −
              </button>
              <span className="w-7 text-center font-mono text-sm tabular-nums select-none">{entry.quantity}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (onQuantityChange) onQuantityChange(entry.quantity + 1); }}
                disabled={maxQuantity !== undefined && entry.quantity >= maxQuantity}
                title={maxQuantity !== undefined && entry.quantity >= maxQuantity ? `Maximum: ${maxQuantity}` : 'Increase quantity'}
                className="w-5 h-5 flex items-center justify-center bg-pink-nebula-bg/70 border border-pink-nebula-border rounded text-pink-nebula-muted hover:border-pink-nebula-accent-primary hover:text-pink-nebula-text disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-none text-base"
              >
                +
              </button>
            </div>
          ) : (
            <span className="w-12 text-right block">×{entry.quantity}</span>
          )}
        </div>

        {/* Duration */}
        <div className="text-pink-nebula-text text-right w-10">
          {durationTurns}T
        </div>

        {/* Remove indicator */}
        <div className="w-8 text-right flex items-center justify-end">
          {!disabled && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="text-red-400 bg-red-900/30 rounded px-2 py-0.5 hover:bg-red-500 hover:text-white transition-all cursor-pointer text-base font-bold leading-none"
              title="Remove from queue"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Hard-block warning (missing prerequisite or constraint) */}
      {entry.invalid && entry.invalidReason && (
        <div className="mt-1 text-xs text-red-400">
          ⚠️ {entry.invalidReason}
        </div>
      )}
      {/* Resource-delay info (soft: waiting for resources to accumulate) */}
      {!entry.invalid && entry.resourceDelayed && (
        <div className="mt-1 text-xs text-yellow-400/80">
          ⏳ {entry.resourceDelayReason ?? 'Waiting for resources to accumulate'}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to optimize re-renders
  return (
    prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.status === nextProps.entry.status &&
    prevProps.entry.quantity === nextProps.entry.quantity &&
    prevProps.entry.eta === nextProps.entry.eta &&
    prevProps.entry.turnsRemaining === nextProps.entry.turnsRemaining &&
    prevProps.entry.invalid === nextProps.entry.invalid &&
    prevProps.entry.isAutoWait === nextProps.entry.isAutoWait &&
    prevProps.currentTurn === nextProps.currentTurn &&
    prevProps.entry.startTurn === nextProps.entry.startTurn &&
    prevProps.entry.queuedTurn === nextProps.entry.queuedTurn &&
    prevProps.entry.completionTurn === nextProps.entry.completionTurn &&
    prevProps.entry.invalid === nextProps.entry.invalid &&
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
