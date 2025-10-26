"use client";

import React from 'react';

export interface QueueToolbarProps {
  laneItems: any[]; // ItemDefinitions for this lane
  selectedItemId: string;
  quantity: number;
  supportsBatching: boolean;
  error: string | null;
  onItemSelect: (itemId: string) => void;
  onQuantityChange: (quantity: number) => void;
  onQueue: () => void;
}

/**
 * QueueToolbar - Item selection and queueing controls
 *
 * Provides dropdown for item selection, quantity input (for batching lanes),
 * and queue button with validation feedback.
 */
export function QueueToolbar({
  laneItems,
  selectedItemId,
  quantity,
  supportsBatching,
  error,
  onItemSelect,
  onQuantityChange,
  onQueue,
}: QueueToolbarProps) {
  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onItemSelect(e.target.value);
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onQuantityChange(value);
    }
  };

  const selectedItem = laneItems.find((item) => item.id === selectedItemId);

  return (
    <div className="space-y-3">
      {/* Item Selection */}
      <div className="flex items-center gap-3">
        <label htmlFor="item-select" className="text-sm font-semibold text-pink-nebula-muted">
          Select Item:
        </label>
        <select
          id="item-select"
          value={selectedItemId}
          onChange={handleItemChange}
          className="flex-1 px-3 py-2 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text"
        >
          <option value="">-- Choose an item --</option>
          {laneItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {/* Item Details */}
      {selectedItem && (
        <div className="bg-pink-nebula-bg rounded p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-pink-nebula-muted">Duration:</span>
            <span className="text-pink-nebula-text font-semibold">
              {selectedItem.durationTurns} turn(s)
            </span>
          </div>
          {selectedItem.costsPerUnit && (
            <div className="flex items-center gap-2">
              <span className="text-pink-nebula-muted">Cost:</span>
              <span className="text-pink-nebula-text">
                {Object.entries(selectedItem.costsPerUnit)
                  .filter(([_, amount]) => (amount as number) > 0)
                  .map(([resource, amount]) => `${resource}: ${amount as number}`)
                  .join(', ')}
              </span>
            </div>
          )}
          {selectedItem.workersPerUnit > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-pink-nebula-muted">Workers:</span>
              <span className="text-pink-nebula-text">{selectedItem.workersPerUnit}</span>
            </div>
          )}
        </div>
      )}

      {/* Quantity Input (for batching lanes) */}
      {supportsBatching && selectedItemId && (
        <div className="flex items-center gap-3">
          <label htmlFor="quantity-input" className="text-sm font-semibold text-pink-nebula-muted">
            Quantity:
          </label>
          <input
            id="quantity-input"
            type="number"
            value={quantity}
            onChange={handleQuantityChange}
            min={1}
            className="w-24 px-3 py-2 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text text-center"
          />
          <span className="text-xs text-pink-nebula-muted">
            (Final quantity determined at activation)
          </span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-400 rounded p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Queue Button */}
      <button
        onClick={onQueue}
        disabled={!selectedItemId}
        className={`w-full px-4 py-2 rounded font-semibold transition-colors ${
          selectedItemId
            ? 'bg-pink-nebula-accent-primary text-pink-nebula-text hover:bg-pink-nebula-accent-secondary'
            : 'bg-pink-nebula-bg text-pink-nebula-muted cursor-not-allowed'
        }`}
      >
        Queue Item
      </button>
    </div>
  );
}
