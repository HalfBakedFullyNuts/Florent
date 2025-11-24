"use client";

import React from 'react';
import type { LaneId } from '../../lib/sim/engine/types';

export interface TabHeaderProps {
  activeTab: LaneId;
  onTabChange: (tab: LaneId) => void;
  counts?: {
    building: number;
    ship: number;
    colonist: number;
    research?: number;
  };
}

/**
 * TabHeader - Tab navigation for item types
 *
 * Three tabs: Structures (🏗️), Ships (🚀), Colonists (👥)
 * Only one active at a time (accordion behavior)
 *
 * Ticket 25: Tab header component
 */
export function TabHeader({ activeTab, onTabChange, counts }: TabHeaderProps) {
  const tabs: Array<{ id: LaneId; label: string; icon: string }> = [
    { id: 'building', label: 'Structures', icon: '🏗️' },
    { id: 'ship', label: 'Ships', icon: '🚀' },
    { id: 'colonist', label: 'Colonists', icon: '👥' },
  ];

  return (
    <div className="flex border-b border-pink-nebula-border bg-pink-nebula-bg">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = counts?.[tab.id] || 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 py-3 px-3 transition-all text-sm font-semibold
              ${isActive
                ? 'bg-pink-nebula-panel border-b-2 border-pink-nebula-accent-primary text-pink-nebula-text'
                : 'text-pink-nebula-muted hover:bg-pink-nebula-panel/50'}
            `}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.id}-panel`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
            {count > 0 && (
              <span className="ml-2 text-xs bg-pink-nebula-accent-primary rounded-full px-2 py-0.5">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
