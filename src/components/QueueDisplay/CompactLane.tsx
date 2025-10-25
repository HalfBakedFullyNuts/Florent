"use client";

import React from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { CompactLaneEntry } from './CompactLaneEntry';

export interface CompactLaneProps {
  laneId: LaneId;
  laneView: LaneView;
  currentTurn: number;
  onCancel: (entryIndex: number) => void;
  disabled?: boolean;
}

/**
 * CompactLane - Narrow, scannable queue display
 *
 * Fixed width: 280px
 * Displays entries in compact format with minimal visual noise
 * Max height with scroll for long queues
 *
 * Ticket 23: Compact lane display component
 */
export function CompactLane({
  laneId,
  laneView,
  currentTurn,
  onCancel,
  disabled = false,
}: CompactLaneProps) {
  const getLaneTitle = () => {
    switch (laneId) {
      case 'building':
        return 'Structures';
      case 'ship':
        return 'Ships';
      case 'colonist':
        return 'Colonists';
      default:
        return laneId;
    }
  };

  const getLaneBorderColor = () => {
    switch (laneId) {
      case 'building':
        return 'border-blue-400';
      case 'ship':
        return 'border-purple-400';
      case 'colonist':
        return 'border-green-400';
      default:
        return 'border-pink-nebula-border';
    }
  };

  return (
    <div className={`
      w-[280px] bg-pink-nebula-panel rounded-lg border-2 ${getLaneBorderColor()}
      flex flex-col overflow-hidden
    `}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-pink-nebula-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-pink-nebula-text">{getLaneTitle()}</h3>
          <div className="text-xs text-pink-nebula-muted">
            {laneView.entries.length > 0
              ? `${laneView.entries.length}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Queue entries with scroll */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[400px]">
        {laneView.entries.length === 0 ? (
          <div className="text-center text-pink-nebula-muted py-8 text-sm">
            Queue empty
          </div>
        ) : (
          laneView.entries.map((entry, index) => (
            <CompactLaneEntry
              key={entry.id}
              entry={entry}
              currentTurn={currentTurn}
              onCancel={() => onCancel(index)}
              disabled={disabled}
            />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-pink-nebula-border bg-pink-nebula-bg">
        <div className="text-xs text-pink-nebula-muted text-center">
          {laneId === 'building' && 'Hover to cancel'}
          {laneId === 'ship' && 'Batch production'}
          {laneId === 'colonist' && 'Requires housing'}
        </div>
      </div>
    </div>
  );
}
