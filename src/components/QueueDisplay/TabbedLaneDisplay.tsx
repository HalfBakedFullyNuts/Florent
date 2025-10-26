"use client";

import React, { useState } from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { QueueLaneEntry } from './QueueLaneEntry';

export interface TabbedLaneDisplayProps {
  buildingLane: LaneView;
  shipLane: LaneView;
  colonistLane: LaneView;
  currentTurn: number;
  onCancel: (laneId: LaneId, entry: LaneEntry) => void;
  disabled?: boolean;
  defs: Record<string, any>;
}

/**
 * TabbedLaneDisplay - Compact tabbed interface for queue schedules
 *
 * - Three tabs: Structures, Ships, Colonists
 * - Active tab takes full width
 * - Inactive tabs compressed to 50% width showing minimal info
 * - Total width = 2x single column
 */
export function TabbedLaneDisplay({
  buildingLane,
  shipLane,
  colonistLane,
  currentTurn,
  onCancel,
  disabled = false,
  defs,
}: TabbedLaneDisplayProps) {
  const [activeTab, setActiveTab] = useState<LaneId>('building');

  const getLaneConfig = (laneId: LaneId) => {
    switch (laneId) {
      case 'building':
        return { title: 'Structures', icon: '🏗️', laneView: buildingLane };
      case 'ship':
        return { title: 'Ships', icon: '🚀', laneView: shipLane };
      case 'colonist':
        return { title: 'Colonists', icon: '👥', laneView: colonistLane };
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
          const config = getLaneConfig(laneId);
          const isActive = activeTab === laneId;
          const laneView = config.laneView;

          // Calculate newest item
          const nonCompletedEntries = laneView.entries.filter(e => e.status !== 'completed');
          const newestId = nonCompletedEntries.length > 0
            ? nonCompletedEntries[nonCompletedEntries.length - 1].id
            : null;

          return (
            <div
              key={laneId}
              className={`
                bg-slate-800 rounded-lg p-4 overflow-y-auto
                transition-all duration-[350ms] ease-in-out
                ${isActive ? 'flex-[2.2]' : 'flex-[0.9]'}
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
                      {laneView.entries.length > 0 ? `${laneView.entries.length}` : '—'}
                    </span>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2">
                {laneView.entries.length === 0 ? (
                  <div className="text-center text-pink-nebula-muted text-base py-8">
                    {isActive ? 'Queue empty' : '—'}
                  </div>
                ) : isActive ? (
                  // Active tab: Full display with all entries
                  laneView.entries.map((entry) => {
                    const isNewest = entry.id === newestId;
                    const def = defs[entry.itemId];
                    const busyWorkers = def?.costsPerUnit?.workers ? def.costsPerUnit.workers * entry.quantity : 0;

                    return (
                      <QueueLaneEntry
                        key={entry.id}
                        entry={entry}
                        currentTurn={currentTurn}
                        onCancel={() => onCancel(laneId, entry)}
                        disabled={disabled}
                        isNewest={isNewest}
                        def={def}
                        busyWorkers={busyWorkers}
                      />
                    );
                  })
                ) : (
                  // Inactive tab: Compressed display (just count or top entries)
                  <div className="text-center text-pink-nebula-muted text-sm py-4">
                    {laneView.entries.length} item{laneView.entries.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Footer hint - only in active tab */}
              {isActive && (
                <div className="mt-4 pt-2 border-t border-pink-nebula-border">
                  <div className="text-xs text-pink-nebula-muted text-center">
                    {laneId === 'building' && 'Hover to cancel'}
                    {laneId === 'ship' && 'Batch production'}
                    {laneId === 'colonist' && 'Requires housing'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
