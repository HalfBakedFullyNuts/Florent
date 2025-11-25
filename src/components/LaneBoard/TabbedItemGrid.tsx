"use client";

import React, { useState } from 'react';
import type { ItemDefinition } from '../../lib/sim/engine/types';
import { Card } from '@/components/ui/card';
import { GlassQueueButton } from '@/components/ui/glass-queue-button';

export interface TabbedItemGridProps {
  availableItems: Record<string, any>;
  onQueueItem: (itemId: string, quantity: number) => void;
  canQueueItem: (itemId: string, quantity: number) => { allowed: boolean; reason?: string };
  activeTab?: 'building' | 'ship' | 'colonist' | 'research';
  onTabChange?: (tab: 'building' | 'ship' | 'colonist' | 'research') => void;
  currentTurn?: number;
}

type LaneId = 'building' | 'ship' | 'colonist' | 'research';

/**
 * TabbedItemGrid - Tabbed interface for queue items
 * Shows only the active tab's items
 */
export function TabbedItemGrid({
  availableItems,
  onQueueItem,
  canQueueItem,
  activeTab: externalActiveTab,
  onTabChange,
  currentTurn = 1,
}: TabbedItemGridProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<LaneId>('building');

  // Use external tab state if provided, otherwise use internal
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  // Group items by lane
  const itemsByLane: Record<string, any[]> = {
    building: [],
    ship: [],
    colonist: [],
    research: [],
  };

  Object.values(availableItems).forEach((item: any) => {
    // Filter out outpost and worker - they cannot be built manually
    if (item.id === 'outpost' || item.id === 'worker') {
      return;
    }
    if (item.lane && itemsByLane[item.lane]) {
      itemsByLane[item.lane].push(item);
    }
  });

  // Sort items: available first, then by duration, then by name
  Object.keys(itemsByLane).forEach(laneId => {
    itemsByLane[laneId].sort((a, b) => {
      const aQueueable = canQueueItem(a.id, 1).allowed;
      const bQueueable = canQueueItem(b.id, 1).allowed;

      if (aQueueable !== bQueueable) {
        return bQueueable ? 1 : -1;
      }

      if (a.durationTurns !== b.durationTurns) {
        return a.durationTurns - b.durationTurns;
      }

      return a.name.localeCompare(b.name);
    });
  });

  const getLaneConfig = (laneId: LaneId) => {
    switch (laneId) {
      case 'building':
        return { title: 'Structures', icon: '🏗️' };
      case 'ship':
        return { title: 'Ships', icon: '🚀' };
      case 'colonist':
        return { title: 'Colonists', icon: '👥' };
      case 'research':
        return { title: 'Research', icon: '🔬' };
      default:
        return { title: 'Unknown', icon: '❓' };
    }
  };

  const isItemQueueable = (itemId: string): boolean => {
    return canQueueItem(itemId, 1).allowed;
  };

  const formatCost = (item: any): Array<{ resource: string; amount: number }> => {
    if (!item.costsPerUnit) return [];
    return Object.entries(item.costsPerUnit)
      .filter(([_, amount]) => (amount as number) > 0)
      .map(([resource, amount]) => ({
        resource,
        amount: amount as number,
      }));
  };

  const getResourceColor = (resource: string): string => {
    switch (resource) {
      case 'metal': return 'text-gray-300'; // silver
      case 'mineral': return 'text-red-400'; // red
      case 'food': return 'text-green-400'; // green
      case 'energy': return 'text-blue-400'; // blue
      case 'research_points': return 'text-purple-400';
      case 'workers': return 'text-orange-400'; // orange
      case 'ground_space': return 'text-amber-700'; // brown
      case 'orbital_space': return 'text-blue-800'; // dark blue
      case 'space': return 'text-amber-700'; // default to ground space color
      default: return 'text-pink-nebula-muted';
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  // Define column order for costs (aligned across all items)
  const costColumns = ['metal', 'mineral', 'food', 'energy', 'research_points', 'workers', 'space'] as const;

  // Track quantities for each batchable item
  const [itemQuantities, setItemQuantities] = useState<Record<string, string>>({});

  const handleItemClick = (itemId: string, laneId: LaneId) => {
    const queueable = isItemQueueable(itemId);
    if (!queueable) return;

    if (laneId === 'building' || laneId === 'research') {
      // Structures and Research: queue immediately with quantity=1
      onQueueItem(itemId, 1);
    } else {
      // Ships/Colonists: queue with the quantity from input
      const qty = parseInt(itemQuantities[itemId] || '1') || 1;
      const validation = canQueueItem(itemId, qty);

      if (validation.allowed) {
        onQueueItem(itemId, qty);
        // Reset quantity to 1 after queueing
        setItemQuantities(prev => ({ ...prev, [itemId]: '1' }));
      }
    }
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    setItemQuantities(prev => ({ ...prev, [itemId]: value }));
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const qty = parseInt(itemQuantities[itemId] || '1') || 1;
      const validation = canQueueItem(itemId, qty);

      if (validation.allowed) {
        onQueueItem(itemId, qty);
        setItemQuantities(prev => ({ ...prev, [itemId]: '1' }));
      }
    } else if (e.key === 'Escape') {
      setItemQuantities(prev => ({ ...prev, [itemId]: '1' }));
    }
  };

  const items = itemsByLane[activeTab] || [];
  const config = getLaneConfig(activeTab);

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="flex gap-2 mb-4">
        {(['building', 'ship', 'colonist', 'research'] as LaneId[]).map((laneId) => {
          const tabConfig = getLaneConfig(laneId);
          const isActive = activeTab === laneId;

          return (
            <button
              key={laneId}
              onClick={() => setActiveTab(laneId)}
              className={`
                px-4 py-2 rounded-t-lg font-semibold transition-all duration-[350ms]
                ${isActive
                  ? 'bg-slate-800 text-pink-nebula-text border-b-2 border-pink-nebula-accent-primary'
                  : 'bg-slate-700 text-pink-nebula-muted hover:bg-slate-750'
                }
              `}
            >
              <span className="mr-2">{tabConfig.icon}</span>
              {tabConfig.title}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <Card className="p-4 h-[600px] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-pink-nebula-border">
          <span className="text-xl">{config.icon}</span>
          <h3 className="text-lg font-bold text-pink-nebula-text">
            {config.title}
          </h3>
          <span className="ml-auto text-sm text-pink-nebula-muted">
            {items.length} items
          </span>
        </div>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center text-pink-nebula-muted text-base py-4">
              No items available
            </div>
          ) : (
            items.map((item) => {
              const queueable = isItemQueueable(item.id);
              const costsMap = item.costsPerUnit || {};

              return (
                <div
                  key={item.id}
                  className={`
                    w-full text-left p-2 bg-pink-nebula-panel/50 border border-pink-nebula-border rounded
                    transition-colors group
                    ${queueable
                      ? 'hover:bg-pink-nebula-panel/70'
                      : 'opacity-50'
                    }
                  `}
                >
                  {/* Single row layout */}
                  <div className="flex items-center gap-2 text-sm font-mono">
                    {/* Item Name - fixed width for alignment */}
                    <div className="text-pink-nebula-text font-semibold whitespace-nowrap w-40 truncate">
                      {item.name}
                    </div>

                    {/* Costs in fixed-width columns (just numbers, color-coded) */}
                    {costColumns.map((resource) => {
                      const amount = costsMap[resource] || 0;
                      return (
                        <div
                          key={resource}
                          className={`w-12 text-right ${amount > 0 ? getResourceColor(resource) : 'text-transparent'}`}
                          title={resource}
                        >
                          {amount > 0 ? formatNumber(amount) : '-'}
                        </div>
                      );
                    })}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Quantity input for ships/colonists */}
                    {(activeTab === 'ship' || activeTab === 'colonist') && (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={itemQuantities[item.id] || '1'}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        onKeyDown={(e) => handleQuantityKeyDown(e, item.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!queueable}
                        className={`
                          w-14 px-2 py-0.5 bg-pink-nebula-bg border border-pink-nebula-border rounded
                          text-pink-nebula-text text-sm text-center font-mono
                          focus:outline-none focus:border-pink-nebula-accent-primary
                          ${!queueable ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        placeholder="1"
                      />
                    )}

                    {/* Duration */}
                    <div className="text-pink-nebula-muted whitespace-nowrap w-8 text-right">
                      {item.durationTurns}T
                    </div>

                    {/* Add to Queue Button */}
                    <button
                      onClick={() => handleItemClick(item.id, activeTab)}
                      disabled={!queueable}
                      className={`
                        px-2 py-0.5 rounded text-sm
                        ${queueable
                          ? 'bg-pink-nebula-accent-primary/80 hover:bg-pink-nebula-accent-primary text-white cursor-pointer'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }
                      `}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
