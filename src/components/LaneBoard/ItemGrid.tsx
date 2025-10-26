"use client";

import React, { useState, useMemo } from 'react';

export interface ItemGridProps {
  availableItems: Record<string, any>; // All ItemDefinitions
  onQueueItem: (itemId: string, quantity: number) => void;
  canQueueItem: (itemId: string, quantity: number) => {
    allowed: boolean;
    reason?: string;
  };
}

/**
 * ItemGrid - Multi-column item grid interface
 *
 * Displays all available items grouped by lane (Structures/Ships/Colonists)
 * in a 3-column grid layout. Clicking an item queues it directly.
 * Replaces dropdown-based selection for faster interaction.
 *
 * Ticket UI-4: One-click queueing with always-visible item grid
 */
// Exclusion list for items that cannot be queued
const EXCLUDED_ITEMS = ['worker', 'outpost'];

export function ItemGrid({
  availableItems,
  onQueueItem,
  canQueueItem,
}: ItemGridProps) {
  const [error, setError] = useState<string | null>(null);
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [batchingItem, setBatchingItem] = useState<string | null>(null);
  const [batchQuantity, setBatchQuantity] = useState<number>(1);

  // Group items by lane, excluding non-queueable items and items with unmet prerequisites
  const itemsByLane = useMemo(() => {
    return Object.values(availableItems).reduce(
      (acc: Record<string, any[]>, item: any) => {
        // Skip excluded items (workers, outpost)
        if (EXCLUDED_ITEMS.includes(item.id)) {
          return acc;
        }

        // Skip items that cannot be queued (unmet prerequisites, etc)
        // Use quantity=1 for validation since we're just checking if item is queueable at all
        const validation = canQueueItem(item.id, 1);
        if (!validation.allowed) {
          return acc;
        }

        if (!acc[item.lane]) {
          acc[item.lane] = [];
        }
        acc[item.lane].push(item);
        return acc;
      },
      {}
    );
  }, [availableItems, canQueueItem]);

  const handleItemClick = (itemId: string, laneId: string) => {
    const supportsBatching = laneId === 'ship' || laneId === 'colonist';

    if (supportsBatching) {
      // Show quantity input for ships and colonists
      setBatchingItem(itemId);
      setBatchQuantity(1);
    } else {
      // Queue immediately with quantity=1 for structures
      queueItemWithValidation(itemId, 1);
    }
  };

  const queueItemWithValidation = (itemId: string, quantity: number) => {
    const validation = canQueueItem(itemId, quantity);

    if (!validation.allowed) {
      setError(validation.reason || 'Cannot queue item');
      setTimeout(() => setError(null), 3000);
      return;
    }

    onQueueItem(itemId, quantity);
    setBatchingItem(null);
    setError(null);
  };

  const getLaneConfig = (laneId: string) => {
    switch (laneId) {
      case 'building':
        return {
          title: 'Structures',
          color: 'border-blue-400',
          bgHover: 'hover:bg-blue-400/10',
          icon: '🏗️',
        };
      case 'ship':
        return {
          title: 'Ships',
          color: 'border-purple-400',
          bgHover: 'hover:bg-purple-400/10',
          icon: '🚀',
        };
      case 'colonist':
        return {
          title: 'Colonists',
          color: 'border-green-400',
          bgHover: 'hover:bg-green-400/10',
          icon: '👥',
        };
      default:
        return {
          title: laneId,
          color: 'border-pink-nebula-border',
          bgHover: 'hover:bg-pink-nebula-bg',
          icon: '•',
        };
    }
  };

  const getResourceColor = (resource: string) => {
    switch (resource) {
      case 'metal': return 'text-pink-500';
      case 'mineral': return 'text-blue-400';
      case 'food': return 'text-green-400';
      case 'energy': return 'text-yellow-400';
      default: return 'text-pink-nebula-muted';
    }
  };

  const formatCost = (item: any) => {
    if (!item.costsPerUnit) return [];
    return Object.entries(item.costsPerUnit)
      .filter(([_, amount]) => (amount as number) > 0)
      .map(([resource, amount]) => ({
        resource,
        amount: amount as number,
        color: getResourceColor(resource),
      }));
  };

  return (
    <div className="w-full">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-400 rounded p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Desktop: 3-Column Grid */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4 max-w-[900px] mx-auto">
        {['building', 'ship', 'colonist'].map((laneId) => {
          const items = itemsByLane[laneId] || [];
          const config = getLaneConfig(laneId);

          return (
            <div
              key={laneId}
              className={`bg-pink-nebula-panel rounded-lg border-2 ${config.color} p-4 max-w-[280px]`}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-pink-nebula-border">
                <span className="text-xl">{config.icon}</span>
                <h3 className="text-lg font-bold text-pink-nebula-text">
                  {config.title}
                </h3>
                <span className="ml-auto text-xs text-pink-nebula-muted">
                  {items.length} items
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="text-center text-pink-nebula-muted text-sm py-4">
                    No items available
                  </div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id, laneId)}
                      className={`w-full text-left p-3 rounded border border-pink-nebula-border bg-pink-nebula-bg ${config.bgHover} transition-colors group`}
                    >
                      <div className="font-semibold text-sm text-pink-nebula-text group-hover:text-pink-nebula-accent-primary">
                        {item.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-pink-nebula-muted">⏱️ {item.durationTurns}T</span>
                        {formatCost(item).map(({ resource, amount, color }) => (
                          <span key={resource} className={color}>
                            {resource.charAt(0).toUpperCase()}:{amount}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile/Tablet: Accordion */}
      <div className="lg:hidden space-y-3">
        {['building', 'ship', 'colonist'].map((laneId) => {
          const items = itemsByLane[laneId] || [];
          const config = getLaneConfig(laneId);
          const isExpanded = expandedColumn === laneId;

          return (
            <div
              key={laneId}
              className={`bg-pink-nebula-panel rounded-lg border-2 ${config.color}`}
            >
              {/* Accordion Header */}
              <button
                onClick={() => setExpandedColumn(isExpanded ? null : laneId)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{config.icon}</span>
                  <h3 className="text-lg font-bold text-pink-nebula-text">
                    {config.title}
                  </h3>
                  <span className="text-xs text-pink-nebula-muted">
                    ({items.length})
                  </span>
                </div>
                <span className="text-pink-nebula-muted text-xl">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-center text-pink-nebula-muted text-sm py-4">
                      No items available
                    </div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id, laneId)}
                        className={`w-full text-left p-3 rounded border border-pink-nebula-border bg-pink-nebula-bg ${config.bgHover} transition-colors group`}
                      >
                        <div className="font-semibold text-sm text-pink-nebula-text group-hover:text-pink-nebula-accent-primary">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-pink-nebula-muted">⏱️ {item.durationTurns}T</span>
                          {formatCost(item).map(({ resource, amount, color }) => (
                            <span key={resource} className={color}>
                              {resource.charAt(0).toUpperCase()}:{amount}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quantity Selector Modal for Ships/Colonists */}
      {batchingItem && (
        <div className="mt-4 p-4 bg-pink-nebula-bg rounded-lg border-2 border-pink-nebula-accent-primary">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-pink-nebula-text mb-1">
              Select Quantity
            </h4>
            <p className="text-xs text-pink-nebula-muted">
              {availableItems[batchingItem]?.name || 'Item'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-pink-nebula-text">
              Quantity:
            </label>
            <input
              type="number"
              value={batchQuantity}
              onChange={(e) => setBatchQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="w-24 px-3 py-2 bg-pink-nebula-panel border border-pink-nebula-border rounded text-pink-nebula-text text-center focus:outline-none focus:border-pink-nebula-accent-primary"
            />
            <button
              onClick={() => queueItemWithValidation(batchingItem, batchQuantity)}
              className="px-4 py-2 bg-pink-nebula-accent-primary text-pink-nebula-text rounded hover:bg-pink-nebula-accent-secondary transition-colors font-semibold"
            >
              Queue
            </button>
            <button
              onClick={() => setBatchingItem(null)}
              className="px-4 py-2 bg-pink-nebula-bg text-pink-nebula-muted rounded hover:bg-pink-nebula-panel transition-colors border border-pink-nebula-border"
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs mt-2">
            <span className="text-pink-nebula-muted">Total cost:</span>
            {formatCost({costsPerUnit: availableItems[batchingItem]?.costsPerUnit ? Object.fromEntries(
              Object.entries(availableItems[batchingItem].costsPerUnit).map(([k, v]) => [k, (v as number) * batchQuantity])
            ) : {}}).map(({ resource, amount, color }) => (
              <span key={resource} className={color}>
                {resource.charAt(0).toUpperCase()}:{amount}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
