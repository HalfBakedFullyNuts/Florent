"use client";

import React from 'react';
import type { LaneEntry } from '../../lib/game/selectors';

export interface QueueLaneEntryProps {
  entry: LaneEntry;
  currentTurn: number;
  onCancel: () => void;
  disabled?: boolean;
  isNewest?: boolean;
  def?: any; // ItemDefinition
  busyWorkers?: number;
}

/**
 * QueueLaneEntry - Planet Queue entry display with Add to Queue styling
 *
 * Shows: Item name, busy workers, total build time
 * Same font size and style as TabbedItemGrid items
 */
export function QueueLaneEntry({
  entry,
  currentTurn,
  onCancel,
  disabled = false,
  isNewest = false,
  def,
  busyWorkers = 0,
}: QueueLaneEntryProps) {
  const queueable = true; // Always show as queueable in Planet Queue

  return (
    <div
      className={`w-full text-left p-3 rounded border transition-colors group ${
        isNewest
          ? 'border-pink-nebula-accent-primary bg-pink-nebula-bg hover:bg-slate-700 ring-2 ring-pink-nebula-accent-primary'
          : 'border-pink-nebula-border bg-pink-nebula-bg hover:bg-slate-700'
      } ${entry.status === 'completed' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className={`font-semibold ${
          queueable ? 'text-pink-nebula-text group-hover:text-pink-nebula-accent-primary' : 'text-pink-nebula-muted'
        }`}>
          {entry.itemName}
        </span>

        {/* Busy workers display */}
        {busyWorkers > 0 && (
          <span className={queueable ? 'text-orange-400' : 'text-orange-400/60'}>
            W:{busyWorkers}
          </span>
        )}

        {/* Total build time */}
        {def?.durationTurns && (
          <span className={queueable ? 'text-pink-nebula-muted' : 'text-pink-nebula-muted/60'}>
            ⏱️ {def.durationTurns}T
          </span>
        )}

        {/* Cancel button - grey X on far right - only for pending/active items */}
        {!disabled && entry.status !== 'completed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="ml-auto w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors text-xs shrink-0"
            aria-label={`Cancel ${entry.itemName}`}
            title="Cancel production"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
