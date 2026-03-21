"use client";

import React, { useState, useEffect } from 'react';
import type { LaneEntry } from '../../lib/game/selectors';

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
}: QueueLaneEntryProps) {
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [quantityValue, setQuantityValue] = useState(entry.quantity.toString());

  const handleQuantityBlur = () => {
    setEditingQuantity(false);
    const newQty = parseInt(quantityValue) || 1;
    const clampedQty = maxQuantity ? Math.min(Math.max(1, newQty), maxQuantity) : Math.max(1, newQty);

    if (clampedQty !== entry.quantity && onQuantityChange) {
      onQuantityChange(clampedQty);
    }
    setQuantityValue(clampedQty.toString());
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQuantityBlur();
    } else if (e.key === 'Escape') {
      setEditingQuantity(false);
      setQuantityValue(entry.quantity.toString());
    }
  };

  // Determine status color
  const statusColor = entry.status === 'active' ? 'border-l-4 border-l-yellow-500' :
    entry.status === 'pending' ? 'border-l-4 border-l-blue-500' :
      entry.status === 'completed' ? 'border-l-4 border-l-green-500 opacity-70' : '';

  const isAutoWait = entry.isAutoWait;

  return (
    <div
      className={`
        w-full text-left p-3 ${isAutoWait ? 'bg-pink-nebula-panel/20 opacity-60 italic' : 'bg-pink-nebula-panel/50'} border border-pink-nebula-border rounded
        transition-colors group
        ${statusColor}
        ${entry.invalid ? 'border-orange-500/50 bg-orange-900/10' : ''}
      `}
    >
      {/* Structured table-like layout */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center text-sm font-mono">
        {/* Turn Range: Tx - Ty */}
        <div className="text-pink-nebula-muted w-24 flex items-center gap-1">
          {(() => {
            const startT = entry.startTurn ?? entry.queuedTurn ?? '?';
            const endT = entry.completionTurn ?? (entry.eta !== null ? entry.eta : '?');
            return (
              <>
                <button
                  className="hover:text-pink-nebula-accent-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); if (startT !== '?' && onTurnClick) onTurnClick(startT as number); }}
                  title="Jump to start turn"
                >
                  T{startT}
                </button>
                <span>-</span>
                <button
                  className="hover:text-pink-nebula-accent-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); if (endT !== '?' && onTurnClick) onTurnClick(Math.min((endT as number), 199)); }}
                  title="Jump to completion turn"
                >
                  T{endT}
                </button>
              </>
            );
          })()}
        </div>

        {/* Item Name */}
        <div className={`truncate ${isAutoWait ? 'text-pink-nebula-muted' : 'text-pink-nebula-text'}`}>
          {isAutoWait ? '[Waiting for Prerequisites]' : entry.itemName}
        </div>

        {/* Quantity */}
        <div className="text-pink-nebula-text text-right w-12">
          {showQuantityInput && !disabled ? (
            <input
              type="number"
              min="1"
              max={maxQuantity}
              value={quantityValue}
              onChange={(e) => setQuantityValue(e.target.value)}
              onFocus={() => setEditingQuantity(true)}
              onBlur={handleQuantityBlur}
              onKeyDown={handleQuantityKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-12 px-1 py-0 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text text-sm text-center focus:outline-none focus:border-pink-nebula-accent-primary font-mono"
              disabled={disabled}
            />
          ) : (
            <span>×{entry.quantity}</span>
          )}
        </div>

        {/* Duration */}
        <div className="text-pink-nebula-text text-right w-10">
          {entry.turnsRemaining !== undefined ? `${entry.turnsRemaining}T` : `${def?.duration || '—'}T`}
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
              className="text-red-400 bg-red-900/30 rounded px-2 py-1 hover:bg-red-500 hover:text-white transition-all cursor-pointer text-lg font-bold leading-none"
              title="Remove from queue"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Invalid warning */}
      {entry.invalid && entry.invalidReason && (
        <div className="mt-1 text-xs text-orange-400">
          ⚠️ {entry.invalidReason}
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
    prevProps.showQuantityInput === nextProps.showQuantityInput
  );
});
