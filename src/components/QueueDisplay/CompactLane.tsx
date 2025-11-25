"use client";

import React, { useState } from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { CompactLaneEntry } from './CompactLaneEntry';

export interface CompactLaneProps {
  laneId: LaneId;
  laneView: LaneView;
  currentTurn: number;
  onCancel: (entry: LaneEntry) => void;
  onReorder?: (laneId: LaneId, entryId: string, newIndex: number) => void;
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
  onReorder,
  disabled = false,
}: CompactLaneProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const getLaneBackgroundColor = () => {
    switch (laneId) {
      case 'building':
        return 'bg-slate-800';
      case 'ship':
        return 'bg-slate-800';
      case 'colonist':
        return 'bg-slate-800';
      default:
        return 'bg-pink-nebula-panel';
    }
  };

  return (
    <div className={`
      w-[280px] ${getLaneBackgroundColor()} rounded-lg
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
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[1200px]"
        onDragOver={(e) => {
          if (draggedItem) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={() => {
          setDraggedItem(null);
          setDragOverIndex(null);
        }}
      >
        {laneView.entries.length === 0 ? (
          <div className="text-center text-pink-nebula-muted py-8 text-sm">
            Queue empty
          </div>
        ) : (
          laneView.entries.map((entry, index) => {
            // The newest item is the last non-completed item in the list
            const nonCompletedEntries = laneView.entries.filter(e => e.status !== 'completed');
            const isNewest = nonCompletedEntries.length > 0 &&
                           entry.id === nonCompletedEntries[nonCompletedEntries.length - 1].id;

            return (
              <div
                key={entry.id}
                onDragOver={(e) => {
                  if (draggedItem && draggedItem !== entry.id) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverIndex(index);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedItem && onReorder && draggedItem !== entry.id) {
                    onReorder(laneId, draggedItem, index);
                  }
                  setDraggedItem(null);
                  setDragOverIndex(null);
                }}
                className={dragOverIndex === index ? 'border-t-2 border-pink-nebula-accent-primary' : ''}
              >
                <CompactLaneEntry
                  entry={entry}
                  currentTurn={currentTurn}
                  onCancel={() => onCancel(entry)}
                  disabled={disabled}
                  isNewest={isNewest}
                  onDragStart={() => setDraggedItem(entry.id)}
                  isDragging={draggedItem === entry.id}
                />
              </div>
            );
          })
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
