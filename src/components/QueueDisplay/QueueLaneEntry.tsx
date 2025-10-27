"use client";

import React, { useState, useEffect } from 'react';
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
  const [confirmMode, setConfirmMode] = useState(false);

  // Reset confirmation mode after 3 seconds
  useEffect(() => {
    if (confirmMode) {
      const timer = setTimeout(() => {
        setConfirmMode(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmMode]);

  const handleClick = () => {
    if (confirmMode) {
      // Second click - actually remove
      onCancel();
    } else {
      // First click - enter confirm mode
      setConfirmMode(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-3 rounded border transition-colors group ${
        confirmMode
          ? 'border-red-500 bg-red-900/20 ring-2 ring-red-500 cursor-pointer hover:bg-slate-700'
          : 'border-pink-nebula-border bg-pink-nebula-bg hover:bg-slate-700 cursor-pointer'
      } ${entry.status === 'completed' ? 'opacity-60' : ''}`}
      title={confirmMode ? 'Click again to confirm removal' : 'Click to remove from queue'}
    >
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {confirmMode ? (
          <>
            <span className="font-semibold text-red-400 flex-1">
              Remove {entry.itemName}?
            </span>
            <span className="text-red-400 font-bold text-xs">
              CLICK TO CONFIRM
            </span>
          </>
        ) : (
          <>
            <span className={`font-semibold ${
              queueable ? 'text-white group-hover:text-pink-400' : 'text-pink-nebula-muted'
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

            {/* Remove indicator - only for pending/active items */}
            {!disabled && entry.status !== 'completed' && (
              <span className="ml-auto text-gray-500 group-hover:text-pink-nebula-accent-primary transition-colors text-xs shrink-0">
                ✕
              </span>
            )}
          </>
        )}
      </div>
    </button>
  );
}
