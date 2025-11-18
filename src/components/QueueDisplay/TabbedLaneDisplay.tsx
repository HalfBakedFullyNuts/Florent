"use client";

import React, { useState } from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { QueueLaneEntry } from './QueueLaneEntry';
import { Card } from '@/components/ui/card';

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
 */
export function TabbedLaneDisplay({
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

  const getLaneConfig = (laneId: LaneId) => {
    switch (laneId) {
      case 'building':
        return { title: 'Structures', icon: '🏗️', laneView: buildingLane };
      case 'ship':
        return { title: 'Ships', icon: '🚀', laneView: shipLane };
      case 'colonist':
        return { title: 'Colonists', icon: '👥', laneView: colonistLane };
      case 'research':
        return { title: 'Research', icon: '🔬', laneView: researchLane };
      default:
        return { title: 'Unknown', icon: '❓', laneView: buildingLane };
    }
  };

  const config = getLaneConfig(activeTab);
  const laneView = config.laneView;

  // Calculate newest item
  const nonCompletedEntries = laneView?.entries.filter(e => e.status !== 'completed') || [];
  const newestId = nonCompletedEntries.length > 0
    ? nonCompletedEntries[nonCompletedEntries.length - 1].id
    : null;

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
            {laneView && laneView.entries.length > 0 ? `${laneView.entries.length}` : '—'}
          </span>
        </div>

        <div className="space-y-2">
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
              const actualIndex = laneView.entries.length - 1 - displayIndex;
              const isDragging = draggedItem?.entryId === entry.id && draggedItem?.laneId === activeTab;
              const canDrag = !disabled && entry.status === 'pending' && !!onReorder;

              return (
                <div
                  key={entry.id}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (canDrag) {
                      e.dataTransfer.effectAllowed = 'move';
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
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedItem && onReorder && draggedItem.laneId === activeTab && draggedItem.entryId !== entry.id) {
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
                    ${isDragging ? 'opacity-50' : ''}
                    ${dragOverIndex === displayIndex ? 'border-t-2 border-pink-nebula-accent-primary' : ''}
                    ${canDrag ? 'cursor-move' : ''}
                  `}
                >
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
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-4 pt-2 border-t border-pink-nebula-border">
          <div className="text-xs text-pink-nebula-muted text-center">
            {activeTab === 'building' && 'Hover to cancel'}
            {activeTab === 'ship' && 'Batch production'}
            {activeTab === 'colonist' && 'Requires housing'}
            {activeTab === 'research' && 'Research lane'}
          </div>
        </div>
      </Card>
    </div>
  );
}
