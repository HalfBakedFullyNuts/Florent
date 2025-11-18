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
 * QueueLaneEntry - Planet Queue entry display with structured table-like layout
 *
 * Shows: Item name, quantity, duration, completion turn
 * Vertically aligned columns for all figures
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
    if (disabled || entry.status === 'completed') return;

    if (confirmMode) {
      onCancel();
    } else {
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

  // Determine status color
  const statusColor = entry.status === 'active' ? 'border-l-4 border-l-yellow-500' :
                      entry.status === 'pending' ? 'border-l-4 border-l-blue-500' :
                      entry.status === 'completed' ? 'border-l-4 border-l-green-500 opacity-70' : '';

  if (confirmMode) {
    return (
      <button
        onClick={handleClick}
        className="w-full text-left p-3 bg-red-900/30 border border-red-500 rounded ring-2 ring-red-500 hover:bg-red-900/40 transition-colors"
        title="Click again to confirm removal"
      >
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-red-400">
            Remove {entry.itemName}?
          </span>
          <span className="text-red-400 font-bold text-xs">
            CLICK TO CONFIRM
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || entry.status === 'completed'}
      className={`
        w-full text-left p-3 bg-pink-nebula-panel/50 border border-pink-nebula-border rounded
        hover:bg-pink-nebula-panel/70 transition-colors group
        ${statusColor}
        ${entry.invalid ? 'border-orange-500/50 bg-orange-900/10' : ''}
        ${disabled || entry.status === 'completed' ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      {/* Structured table-like layout */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center text-sm font-mono">
        {/* Item Name */}
        <div className="text-pink-nebula-text truncate">
          {entry.itemName}
        </div>

        {/* Quantity */}
        <div className="text-pink-nebula-text text-right w-12">
          {showQuantityInput && !disabled && entry.status !== 'completed' ? (
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

        {/* Completion Turn */}
        <div className="text-pink-nebula-muted text-right w-32">
          {entry.completionTurn ? `(Completes T${entry.completionTurn})` : ''}
        </div>

        {/* Remove indicator */}
        <div className="w-4 text-right">
          {!disabled && entry.status !== 'completed' && (
            <span className="text-gray-500 group-hover:text-pink-nebula-accent-primary transition-colors">
              ✕
            </span>
          )}
        </div>
      </div>

      {/* Invalid warning */}
      {entry.invalid && entry.invalidReason && (
        <div className="mt-1 text-xs text-orange-400">
          ⚠️ {entry.invalidReason}
        </div>
      )}
    </button>
  );
}
