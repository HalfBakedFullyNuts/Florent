"use client";

import React, { useState } from 'react';
import type { ItemDefinition } from '../../lib/sim/engine/types';

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

  const handleItemClick = (itemId: string) => {
    const queueable = isItemQueueable(itemId);
    if (queueable) {
      onQueueItem(itemId, 1);
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
            <div
              key={laneId}
              className={`
                bg-slate-800 rounded-lg p-4 overflow-y-auto
                transition-all duration-[350ms] ease-in-out
                ${isActive ? 'flex-[2]' : 'flex-1'}
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

                    if (isActive) {
                      // Active tab: Full display with costs
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          className={`w-full text-left p-3 rounded border transition-colors group ${
                            queueable
                              ? 'border-pink-nebula-border bg-pink-nebula-bg hover:bg-slate-700 cursor-pointer'
                              : 'border-pink-nebula-muted bg-pink-nebula-bg/50 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className={`font-semibold ${
                              queueable ? 'text-pink-nebula-text group-hover:text-pink-nebula-accent-primary' : 'text-pink-nebula-muted'
                            }`}>
                              {item.name}
                            </span>
                            <span className={queueable ? 'text-pink-nebula-muted' : 'text-pink-nebula-muted/60'}>
                              ⏱️ {item.durationTurns}T
                            </span>
                            {/* Show costs for active tab */}
                            {item.costsPerUnit && Object.entries(item.costsPerUnit)
                              .filter(([_, amount]) => (amount as number) > 0)
                              .map(([resource, amount]) => {
                                const color = resource === 'metal' ? 'text-gray-300' :
                                             resource === 'mineral' ? 'text-red-500' :
                                             resource === 'food' ? 'text-green-500' :
                                             resource === 'energy' ? 'text-blue-400' : 'text-pink-nebula-muted';
                                return (
                                  <span key={resource} className={queueable ? color : `${color}/60`}>
                                    {resource.charAt(0).toUpperCase()}:{amount}
                                  </span>
                                );
                              })
                            }
                          </div>
                        </button>
                      );
                    } else {
                      // Inactive tab: Compressed display (name + time only)
                      return (
                        <div
                          key={item.id}
                          className={`text-sm py-1 px-2 ${
                            queueable ? 'text-pink-nebula-text' : 'text-pink-nebula-muted opacity-60'
                          }`}
                        >
                          <div className="truncate">
                            {item.name} <span className="text-pink-nebula-muted">({item.durationTurns}T)</span>
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
