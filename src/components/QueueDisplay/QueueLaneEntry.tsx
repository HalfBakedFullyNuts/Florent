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
}

/**
 * QueueLaneEntry - Planet Queue entry display with Add to Queue styling
 *
 * Shows: Item name, turns to completion
 * Same font size and style as TabbedItemGrid items
 */
export function QueueLaneEntry({
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
}: QueueLaneEntryProps) {
  const queueable = true; // Always show as queueable in Planet Queue
  const [confirmMode, setConfirmMode] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [quantityValue, setQuantityValue] = useState(entry.quantity.toString());

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
            {/* Quantity prefix for batches - hide when editing to avoid redundancy */}
            {entry.quantity > 1 && !editingQuantity && (
              <span className={`font-semibold ${
                queueable ? 'text-pink-400' : 'text-pink-nebula-muted'
              }`}>
                {entry.quantity}×
              </span>
            )}

            <span className={`font-semibold ${
              queueable ? 'text-white group-hover:text-pink-400' : 'text-pink-nebula-muted'
            }`}>
              {entry.itemName}
            </span>

            {/* Quantity input for ships/colonists */}
            {showQuantityInput && !disabled && entry.status !== 'completed' && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-pink-nebula-muted text-xs">×</span>
                <input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={quantityValue}
                  onChange={(e) => setQuantityValue(e.target.value)}
                  onFocus={() => setEditingQuantity(true)}
                  onBlur={handleQuantityBlur}
                  onKeyDown={handleQuantityKeyDown}
                  className="w-14 px-2 py-0.5 bg-pink-nebula-panel border border-pink-nebula-border rounded text-pink-nebula-text text-xs text-center focus:outline-none focus:border-pink-nebula-accent-primary"
                  disabled={disabled}
                />
              </div>
            )}

            {/* Turns to completion */}
            {entry.turnsRemaining > 0 && (
              <span className={queueable ? 'text-pink-nebula-muted' : 'text-pink-nebula-muted/60'}>
                {entry.turnsRemaining}T
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
