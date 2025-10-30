"use client";

import React, { useState } from 'react';
import type { ItemDefinition } from '../../lib/sim/engine/types';
import { Card } from '@/components/ui/card';
import { GlassQueueButton } from '@/components/ui/glass-queue-button';

export interface TabbedItemGridProps {
  availableItems: Record<string, any>;
  onQueueItem: (itemId: string, quantity: number) => void;
  canQueueItem: (itemId: string, quantity: number) => { allowed: boolean; reason?: string };
}

type LaneId = 'building' | 'ship' | 'colonist';

/**
 * TabbedItemGrid - Compact tabbed interface for queue items
 *
 * - Three tabs: Structures, Ships, Colonists
 * - Active tab takes full width
 * - Inactive tabs compressed to 50% width showing minimal info
 * - Total width = 2x single column
 */
export function TabbedItemGrid({
  availableItems,
  onQueueItem,
  canQueueItem,
}: TabbedItemGridProps) {
  const [activeTab, setActiveTab] = useState<LaneId>('building');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [quantityValue, setQuantityValue] = useState('1');

  // Group items by lane
  const itemsByLane: Record<string, any[]> = {
    building: [],
    ship: [],
    colonist: [],
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

  const handleItemClick = (itemId: string, laneId: LaneId) => {
    const queueable = isItemQueueable(itemId);
    if (!queueable) return;

    if (laneId === 'building') {
      // Structures: queue immediately with quantity=1
      onQueueItem(itemId, 1);
    } else {
      // Ships/Colonists: show inline quantity input
      if (editingItem === itemId) {
        // If clicking same item, queue with current quantity
        const qty = parseInt(quantityValue) || 1;
        const validation = canQueueItem(itemId, qty);

        if (validation.allowed) {
          onQueueItem(itemId, qty);
          setEditingItem(null);
        }
      } else {
        // Show quantity input for this item
        setEditingItem(itemId);
        setQuantityValue('1');
      }
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      const qty = parseInt(quantityValue) || 1;
      const validation = canQueueItem(itemId, qty);

      if (validation.allowed) {
        onQueueItem(itemId, qty);
        setEditingItem(null);
      }
    } else if (e.key === 'Escape') {
      setEditingItem(null);
      setQuantityValue('1');
    }
  };

  const handleQuantityBlur = (itemId: string) => {
    // Queue with current quantity on blur
    const qty = parseInt(quantityValue) || 1;
    const validation = canQueueItem(itemId, qty);

    if (validation.allowed) {
      onQueueItem(itemId, qty);
      setEditingItem(null);
    }
  };

  return (
    <div className="w-full max-w-[916px]">
      {/* Tab Headers */}
      <div className="flex gap-2 mb-4">
        {(['building', 'ship', 'colonist'] as LaneId[]).map((laneId) => {
          const config = getLaneConfig(laneId);
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
              <span className="mr-2">{config.icon}</span>
              {config.title}
            </button>
          );
        })}
      </div>

      {/* Tabbed Content Area */}
      <div className="flex gap-2 h-[600px]">
        {(['building', 'ship', 'colonist'] as LaneId[]).map((laneId) => {
          const items = itemsByLane[laneId] || [];
          const isActive = activeTab === laneId;
          const config = getLaneConfig(laneId);

          return (
            <Card
              key={laneId}
              onClick={() => !isActive && setActiveTab(laneId)}
              className={`
                p-4 overflow-y-auto
                transition-all duration-[350ms] ease-in-out
                ${isActive ? 'flex-[2]' : 'flex-1 cursor-pointer hover:bg-white/10'}
              `}
            >
              {/* Header - visible in all states */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-pink-nebula-border">
                <span className="text-xl">{config.icon}</span>
                {isActive && (
                  <>
                    <h3 className="text-lg font-bold text-pink-nebula-text">
                      {config.title}
                    </h3>
                    <span className="ml-auto text-sm text-pink-nebula-muted">
                      {items.length} items
                    </span>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-center text-pink-nebula-muted text-base py-4">
                    {isActive ? 'No items available' : '—'}
                  </div>
                ) : (
                  items.map((item) => {
                    const queueable = isItemQueueable(item.id);
                    const costs = formatCost(item);

                    if (isActive) {
                      // Active tab: Full display with costs
                      const isEditing = editingItem === item.id;

                      return (
                        <GlassQueueButton
                          key={item.id}
                          itemName={item.name}
                          costs={costs}
                          turnsRemaining={item.durationTurns}
                          disabled={!queueable}
                          onClick={() => handleItemClick(item.id, laneId)}
                        >
                          {/* Inline quantity input for ships/colonists */}
                          {isEditing && (laneId === 'ship' || laneId === 'colonist') && (
                            <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                              <span className="text-pink-nebula-muted text-xs">×</span>
                              <input
                                type="number"
                                min="1"
                                value={quantityValue}
                                onChange={(e) => setQuantityValue(e.target.value)}
                                onKeyDown={(e) => handleQuantityKeyDown(e, item.id)}
                                onBlur={() => handleQuantityBlur(item.id)}
                                autoFocus
                                className="w-14 px-2 py-0.5 bg-pink-nebula-panel border border-pink-nebula-border rounded text-pink-nebula-text text-xs text-center focus:outline-none focus:border-pink-nebula-accent-primary"
                              />
                            </div>
                          )}
                        </GlassQueueButton>
                      );
                    } else {
                      // Inactive tab: Compressed display (name + time only)
                      // Clicking expands the tab
                      return (
                        <GlassQueueButton
                          key={item.id}
                          itemName={item.name}
                          turnsRemaining={item.durationTurns}
                          disabled={!queueable}
                          onClick={() => setActiveTab(laneId)}
                          className="py-1 px-2"
                        />
                      );
                    }
                  })
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
