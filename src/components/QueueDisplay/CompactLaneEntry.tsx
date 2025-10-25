"use client";

import React, { useState } from 'react';
import type { LaneEntry } from '../../lib/game/selectors';

export interface CompactLaneEntryProps {
  entry: LaneEntry;
  currentTurn: number;
  onCancel: () => void;
  disabled?: boolean;
  queuedTurn?: number; // When item was queued
}

/**
 * CompactLaneEntry - Ultra-compact queue entry display
 *
 * Format: T{start}-T{end} [×{qty}] {name} {status}
 * Example: "T1-T5 Metal Mine ⏳4" or "T2-T6 ×5 Fighter ⏳5"
 *
 * Ticket 23: Compact queue display with hover-based cancel
 */
export function CompactLaneEntry({
  entry,
  currentTurn,
  onCancel,
  disabled = false,
  queuedTurn = 0,
}: CompactLaneEntryProps) {
  const [showCancel, setShowCancel] = useState(false);

  // Calculate turn range
  const startTurn = queuedTurn || currentTurn;
  const endTurn = entry.eta !== null ? entry.eta : startTurn + entry.turnsRemaining;

  // Format entry text
  const formatEntry = () => {
    const turnRange = `T${startTurn}-T${endTurn}`;
    const batchIndicator = entry.quantity > 1 ? `×${entry.quantity} ` : '';
    const name = entry.itemName;

    // Status indicators
    let statusIcon = '';
    if (entry.status === 'active') {
      statusIcon = `⏳${entry.turnsRemaining}`;
    } else if (entry.status === 'pending') {
      statusIcon = '⏸';
    } else if (entry.turnsRemaining === 0) {
      statusIcon = '✓';
    }

    return `${turnRange} ${batchIndicator}${name} ${statusIcon}`;
  };

  // Get visual state classes
  const getStatusClasses = () => {
    switch (entry.status) {
      case 'active':
        return 'bg-green-900/10 border-l-green-400 hover:bg-green-900/20';
      case 'pending':
        return 'bg-blue-900/10 border-l-blue-400 hover:bg-blue-900/20';
      case 'completed':
        return 'bg-yellow-900/10 border-l-yellow-400 hover:bg-yellow-900/20';
      default:
        return 'bg-pink-nebula-bg border-l-pink-nebula-border';
    }
  };

  // Calculate progress percentage
  const progressPercent = entry.status === 'active' && entry.eta !== null
    ? Math.round(((endTurn - startTurn - entry.turnsRemaining) / (endTurn - startTurn)) * 100)
    : 0;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowCancel(true)}
      onMouseLeave={() => setShowCancel(false)}
    >
      {/* Entry content */}
      <div className={`
        flex items-center justify-between px-3 py-2 rounded
        border-l-4 transition-all text-sm
        ${getStatusClasses()}
      `}>
        <span className="text-pink-nebula-text font-mono text-xs flex-1">
          {formatEntry()}
        </span>

        {/* Cancel button - appears on hover */}
        {showCancel && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="w-5 h-5 rounded flex items-center justify-center bg-red-600/80 hover:bg-red-600 transition-colors text-white text-xs font-bold ml-2"
            aria-label={`Cancel ${entry.itemName}`}
            title="Cancel production"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar for active items */}
      {entry.status === 'active' && progressPercent > 0 && (
        <div className="h-1 bg-pink-nebula-bg rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-pink-nebula-accent-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
