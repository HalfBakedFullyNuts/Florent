"use client";

import React, { useState } from 'react';
import type { LaneEntry } from '../../lib/game/selectors';

export interface CompactLaneEntryProps {
  entry: LaneEntry;
  currentTurn: number;
  onCancel: () => void;
  disabled?: boolean;
  queuedTurn?: number; // When item was queued
  isNewest?: boolean; // Whether this is the most recently added item
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
  isNewest = false,
}: CompactLaneEntryProps) {
  // Calculate turn range - use startTurn (activation) to completionTurn
  // For pending items, we don't know when they'll activate yet
  const startTurn = entry.startTurn ?? (queuedTurn || currentTurn);
  const endTurn = entry.completionTurn ?? (entry.eta !== null ? entry.eta : startTurn + entry.turnsRemaining);

  // Format entry text
  const formatEntry = () => {
    const turnRange = `T${startTurn}-T${endTurn}`;
    const batchIndicator = entry.quantity > 1 ? `×${entry.quantity} ` : '';
    const name = entry.itemName;

    // Status indicators
    let statusIcon = '';
    if (entry.status === 'completed') {
      statusIcon = '✓';
    } else if (entry.status === 'active') {
      statusIcon = `⏳${entry.turnsRemaining}`;
    } else if (entry.status === 'pending') {
      statusIcon = '⏸';
    }

    return `${turnRange} ${batchIndicator}${name} ${statusIcon}`;
  };

  // Get visual state classes with newest highlight
  const getStatusClasses = () => {
    const highlightClass = isNewest ? 'ring-2 ring-pink-nebula-accent-primary' : '';

    switch (entry.status) {
      case 'active':
        return `bg-green-900/10 border-l-green-400 hover:bg-green-900/20 ${highlightClass}`;
      case 'pending':
        return `bg-blue-900/10 border-l-blue-400 hover:bg-blue-900/20 ${highlightClass}`;
      case 'completed':
        return `bg-pink-nebula-bg/50 border-l-pink-nebula-muted opacity-60 ${highlightClass}`;
      default:
        return `bg-pink-nebula-bg border-l-pink-nebula-border ${highlightClass}`;
    }
  };

  // Calculate progress percentage
  const progressPercent = entry.status === 'active' && entry.eta !== null
    ? Math.round(((endTurn - startTurn - entry.turnsRemaining) / (endTurn - startTurn)) * 100)
    : 0;

  return (
    <div className="relative group">
      {/* Entry content */}
      <div className={`
        flex items-center justify-between px-3 py-2 rounded
        border-l-4 transition-all text-sm
        ${getStatusClasses()}
      `}>
        <span className="text-pink-nebula-text font-mono text-xs flex-1">
          {formatEntry()}
        </span>

        {/* Cancel button - grey X on the right - only for pending/active items */}
        {!disabled && entry.status !== 'completed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors text-xs ml-2 shrink-0"
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
