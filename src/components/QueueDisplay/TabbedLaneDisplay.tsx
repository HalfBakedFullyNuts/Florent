"use client";

import React, { useState, useCallback } from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { QueueLaneEntry } from './QueueLaneEntry';
import { Card } from '@/components/ui/card';
import { LANE_CONFIG, ALL_LANES } from '../../lib/constants/lanes';

export interface TabbedLaneDisplayProps {
  buildingLane: LaneView | null;
  shipLane: LaneView | null;
  colonistLane: LaneView | null;
  researchLane: LaneView | null;
  currentTurn: number;
  onCancel: (laneId: LaneId, entry: LaneEntry) => void;
  onQuantityChange?: (laneId: LaneId, entry: LaneEntry, newQuantity: number) => void;
  getMaxQuantity?: (laneId: LaneId, entry: LaneEntry) => number;
  onReorder?: (laneId: LaneId, entryId: string, newIndex: number) => void;
  disabled?: boolean;
  defs: Record<string, any>;
  activeTab?: LaneId;
  onTabChange?: (tab: LaneId) => void;
}

/**
 * TabbedLaneDisplay - Tabbed interface for queue schedules
 * Shows only the active tab's queue entries
 * Memoized to prevent unnecessary re-renders
 */
export const TabbedLaneDisplay = React.memo(function TabbedLaneDisplay({
  buildingLane,
  shipLane,
  colonistLane,
  researchLane,
  currentTurn,
  onCancel,
  onQuantityChange,
  getMaxQuantity,
  onReorder,
  disabled = false,
  defs,
  activeTab: externalActiveTab,
  onTabChange,
}: TabbedLaneDisplayProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<LaneId>('building');
  const [draggedItem, setDraggedItem] = useState<{ laneId: LaneId; entryId: string } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Use external tab state if provided, otherwise use internal
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  // Map laneId to its lane view
  const laneViews: Record<LaneId, LaneView | null> = {
    building: buildingLane,
    ship: shipLane,
    colonist: colonistLane,
    research: researchLane,
  };

  const config = LANE_CONFIG[activeTab];
  const laneView = laneViews[activeTab];

  // Calculate newest item
  const nonCompletedEntries = laneView?.entries.filter(e => e.status !== 'completed') || [];
  const newestId = nonCompletedEntries.length > 0
    ? nonCompletedEntries[nonCompletedEntries.length - 1].id
    : null;

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="flex gap-2 mb-4">
        {ALL_LANES.map((laneId) => {
          const tabConfig = LANE_CONFIG[laneId];
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
            {laneView && laneView.entries.length > 0 ? `${laneView.entries.length}` : '—'}
          </span>
        </div>

        <div className="space-y-1">
          {!laneView || laneView.entries.length === 0 ? (
            <div className="text-center text-pink-nebula-muted text-base py-8">
              Queue empty
            </div>
          ) : (
            // Full display with all entries (most recent first)
            laneView.entries.slice().reverse().map((entry, displayIndex) => {
              const isNewest = entry.id === newestId;
              const def = defs[entry.itemId];
              const busyWorkers = def?.costsPerUnit?.workers ? def.costsPerUnit.workers * entry.quantity : 0;
              const showQuantityInput = activeTab === 'ship' || activeTab === 'colonist';
              const maxQuantity = getMaxQuantity ? getMaxQuantity(activeTab, entry) : undefined;

              // Calculate actual index in pendingQueue (reversed from display)
              // Display is reversed: displayIndex 0 = last item in queue (newest)
              // To place BEFORE an item in display = place AFTER it in actual queue
              const actualIndex = laneView.entries.length - 1 - displayIndex;
              const isDragging = draggedItem?.entryId === entry.id && draggedItem?.laneId === activeTab;
              // Allow dragging both pending and active items (active will be deactivated on drop)
              const canDrag = !disabled && (entry.status === 'pending' || entry.status === 'active') && !!onReorder;
              const isDropTarget = dragOverIndex === displayIndex && draggedItem && draggedItem.entryId !== entry.id;

              return (
                <div
                  key={entry.id}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (canDrag) {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', entry.id);
                      setDraggedItem({ laneId: activeTab, entryId: entry.id });
                    }
                  }}
                  onDragOver={(e) => {
                    if (draggedItem && draggedItem.laneId === activeTab && draggedItem.entryId !== entry.id) {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverIndex(displayIndex);
                    }
                  }}
                  onDragLeave={(e) => {
                    // Only clear if leaving the container entirely
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverIndex(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedItem && onReorder && draggedItem.laneId === activeTab && draggedItem.entryId !== entry.id) {
                      // Convert display index back to actual queue index
                      // Since display is reversed, dropping at displayIndex N means placing at actualIndex
                      onReorder(activeTab, draggedItem.entryId, actualIndex);
                    }
                    setDraggedItem(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedItem(null);
                    setDragOverIndex(null);
                  }}
                  className={`
                    relative flex items-center gap-2
                    ${isDragging ? 'opacity-40 scale-95' : ''}
                    ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}
                    transition-all duration-150
                  `}
                >
                  {/* Drop indicator line */}
                  {isDropTarget && (
                    <div className="absolute -top-1 left-0 right-0 h-0.5 bg-pink-nebula-accent-primary rounded-full z-10" />
                  )}

                  {/* Drag handle */}
                  {canDrag && (
                    <div className="flex-shrink-0 w-6 flex flex-col items-center justify-center text-pink-nebula-muted hover:text-pink-nebula-text opacity-50 hover:opacity-100 transition-opacity">
                      <span className="text-xs leading-none">⋮⋮</span>
                    </div>
                  )}

                  {/* Queue entry */}
                  <div className="flex-1">
                    <QueueLaneEntry
                      entry={entry}
                      currentTurn={currentTurn}
                      onCancel={() => onCancel(activeTab, entry)}
                      onQuantityChange={onQuantityChange ? (newQty) => onQuantityChange(activeTab, entry, newQty) : undefined}
                      maxQuantity={maxQuantity}
                      showQuantityInput={showQuantityInput}
                      disabled={disabled}
                      isNewest={isNewest}
                      def={def}
                      busyWorkers={busyWorkers}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-4 pt-2 border-t border-pink-nebula-border">
          <div className="text-xs text-pink-nebula-muted text-center">
            {activeTab === 'building' && 'Drag ⋮⋮ to reorder (active items reset) • Click to cancel'}
            {activeTab === 'ship' && 'Drag ⋮⋮ to reorder (active items reset) • Batch production'}
            {activeTab === 'colonist' && 'Drag ⋮⋮ to reorder (active items reset) • Requires housing'}
            {activeTab === 'research' && 'Drag ⋮⋮ to reorder (active items reset) • Research lane'}
          </div>
        </div>
      </Card>
    </div>
  );
});
