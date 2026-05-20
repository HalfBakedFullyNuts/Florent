"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { QueueLaneEntry } from './QueueLaneEntry';
import { Card } from '@/components/ui/card';
import { LANE_CONFIG, ALL_LANES } from '../../lib/constants/lanes';
import { LANE_MANUAL_TOPICS, MANUAL_LINKS } from '../../lib/constants/manualLinks';
import { ManualLink } from '@/components/ui/ManualLink';
import { formatTickTime } from '../../lib/utils/tickTime';

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
  onTurnClick?: (turn: number) => void;
  maxTurn?: number;
  /** Called when an item is dragged from the Add-to-Queue panel and dropped here. */
  onDropGridItem?: (itemId: string, quantity: number) => void;
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
  onTurnClick,
  maxTurn = 199,
  onDropGridItem,
}: TabbedLaneDisplayProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<LaneId>('building');
  const [showTimes, setShowTimes] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ laneId: LaneId; entryId: string } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverExternal, setDragOverExternal] = useState(false);

  // Ref for the scrollable card so we can drive edge-scroll during drag
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const stopEdgeScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startEdgeScroll = useCallback((direction: 'up' | 'down') => {
    stopEdgeScroll();
    const speed = 8;
    const tick = () => {
      const el = scrollRef.current;
      if (el) el.scrollTop += direction === 'down' ? speed : -speed;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopEdgeScroll]);

  useEffect(() => stopEdgeScroll, [stopEdgeScroll]);

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
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ALL_LANES.map((laneId) => {
          const tabConfig = LANE_CONFIG[laneId];
          const isActive = activeTab === laneId;

          return (
            <button
              key={laneId}
              onClick={() => setActiveTab(laneId)}
              aria-pressed={isActive}
              className={laneTabClass(isActive)}
            >
              <span className={laneIconClass(isActive)} aria-hidden="true">
                {tabConfig.icon}
              </span>
              <span className="truncate">{tabConfig.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <Card
        ref={scrollRef}
        className={`scroll-nebula max-h-[60vh] overflow-y-auto p-3 pr-4 md:max-h-[600px] md:p-4 md:pr-5 transition-shadow${dragOverExternal ? ' ring-2 ring-cyan-300/40' : ''}`}
        onDragOver={(e) => {
          // Edge-scroll when an internal reorder drag is near the container boundary
          if (draggedItem) {
            const rect = scrollRef.current?.getBoundingClientRect();
            if (rect) {
              const edge = 60;
              if (e.clientY < rect.top + edge) startEdgeScroll('up');
              else if (e.clientY > rect.bottom - edge) startEdgeScroll('down');
              else stopEdgeScroll();
            }
          }
          // Accept drops from TabbedItemGrid
          if (e.dataTransfer.types.includes('application/x-florent-grid-item')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOverExternal(true);
          }
        }}
        onDragLeave={(e) => {
          if (!scrollRef.current?.contains(e.relatedTarget as Node)) {
            stopEdgeScroll();
            setDragOverExternal(false);
          }
        }}
        onDrop={(e) => {
          stopEdgeScroll();
          setDragOverExternal(false);
          const raw = e.dataTransfer.getData('application/x-florent-grid-item');
          if (raw) {
            e.preventDefault();
            e.stopPropagation();
            try {
              const { itemId, quantity } = JSON.parse(raw) as { itemId: string; quantity: number };
              onDropGridItem?.(itemId, quantity);
            } catch { /* ignore malformed data */ }
          }
        }}
        onDragEnd={() => stopEdgeScroll()}
      >
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-base shadow-[0_0_18px_rgba(34,211,238,0.12)]" aria-hidden="true">
            {config.icon}
          </span>
          {LANE_MANUAL_TOPICS[activeTab]?.[0] ? (
            <a
              href={MANUAL_LINKS[LANE_MANUAL_TOPICS[activeTab]![0]]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-bold text-pink-nebula-text hover:text-pink-nebula-text/80 hover:underline transition-colors"
            >
              {config.title}
            </a>
          ) : (
            <h3 className="text-lg font-bold text-pink-nebula-text">{config.title}</h3>
          )}
          {LANE_MANUAL_TOPICS[activeTab]?.slice(1).map((topic) => (
            <ManualLink key={topic} topic={topic} label={`IC manual: ${topic}`} />
          ))}
          <button
            onClick={() => setShowTimes(t => !t)}
            title={showTimes ? 'Show tick numbers' : 'Show GMT wall-clock times'}
            className={`ml-auto px-2 py-1 rounded text-xs font-mono border transition-colors ${
              showTimes
                ? 'border-pink-nebula-accent-primary/60 bg-pink-nebula-accent-primary/10 text-pink-nebula-accent-primary'
                : 'border-white/10 bg-white/[0.04] text-pink-nebula-muted hover:border-white/30 hover:text-pink-nebula-text'
            }`}
          >
            {showTimes ? 'T#' : '⏰'}
          </button>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-pink-nebula-muted">
            {laneView && laneView.entries.length > 0 ? `${laneView.entries.length}` : '—'}
          </span>
        </div>

        <div className="space-y-1">
          {!laneView || laneView.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/25 py-5 text-center text-sm text-pink-nebula-muted">
              Queue empty
            </div>
          ) : (() => {
            // Build the reversed list and find where the "now" boundary falls.
            // An entry is "past" if its finish turn <= currentTurn.
            // The list renders newest-first (reversed), so past entries appear at the bottom.
            const reversed = laneView.entries.slice().reverse();
            const getFinishTurn = (e: LaneEntry): number | null =>
              e.completionTurn ?? e.eta ?? null;

            // Find the first index (in reversed order) where the entry is "past".
            // We insert the divider just BEFORE that index.
            let dividerIndex: number | null = null;
            for (let i = 0; i < reversed.length; i++) {
              const finish = getFinishTurn(reversed[i]);
              const isPast = finish !== null && finish <= currentTurn;
              if (isPast) {
                dividerIndex = i;
                break;
              }
            }

            const elements: React.ReactNode[] = [];

            // Map reversed display positions to pendingQueue indices at planTurn.
            // All entries (completed + active + pending) appear in the same order
            // as the original pendingQueue at planTurn, EXCEPT the first entry is
            // active at planTurn (not in pendingQueue there), shifting every index
            // by 1. Formula: (entries.length - 1) - 1 - displayIndex.
            // Using pendingCount instead of entries.length - 1 broke when completed
            // items were visible, producing negative indices → INVALID_INDEX.
            const planQueueCount = Math.max(0, laneView.entries.length - 1);

            reversed.forEach((entry, displayIndex) => {
              const isNewest = entry.id === newestId;
              const def = defs[entry.itemId];
              const busyWorkers = def?.costsPerUnit?.workers ? def.costsPerUnit.workers * entry.quantity : 0;
              const showQuantityInput = activeTab === 'ship' || activeTab === 'colonist';
              const maxQuantity = getMaxQuantity ? getMaxQuantity(activeTab, entry) : undefined;
              const actualIndex = planQueueCount - 1 - displayIndex;
              const isDragging = draggedItem?.entryId === entry.id && draggedItem?.laneId === activeTab;
              // Allow reorder for any plan entry except auto-generated waits (they reposition on their own).
              // Past entries are still part of the plan — reordering re-runs the timeline from T1.
              const canDrag = !disabled && !!onReorder && !entry.isAutoWait;
              const isDropTarget = dragOverIndex === displayIndex && draggedItem && draggedItem.entryId !== entry.id;

              // Insert the "now" divider just before the first past entry
              if (dividerIndex === displayIndex) {
                const nowLabel = showTimes ? formatTickTime(currentTurn) : `T${currentTurn}`;
                elements.push(
                  <div key="__now-divider__" className="relative flex items-center gap-3 my-2 select-none pointer-events-none">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-nebula-accent-primary/40 to-transparent" />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-pink-nebula-accent-primary/60 whitespace-nowrap px-1">
                      {nowLabel}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-pink-nebula-accent-primary/40 to-transparent" />
                  </div>
                );
              }

              elements.push(
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
                    if (draggedItem && draggedItem.laneId === activeTab && draggedItem.entryId !== entry.id && actualIndex >= 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverIndex(displayIndex);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverIndex(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedItem && onReorder && draggedItem.laneId === activeTab && draggedItem.entryId !== entry.id && actualIndex >= 0) {
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

                  {/* Drag handle (desktop only — touch devices use the arrow buttons below) */}
                  {canDrag && (
                    <div className="hidden md:flex flex-shrink-0 w-6 flex-col items-center justify-center text-pink-nebula-muted hover:text-pink-nebula-text opacity-50 hover:opacity-100 transition-opacity">
                      <span className="text-xs leading-none">⋮⋮</span>
                    </div>
                  )}

                  {/* Mobile touch reorder buttons (replaces drag handle on small screens) */}
                  {canDrag && onReorder && (
                    <div className="md:hidden flex-shrink-0 flex flex-col gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actualIndex > 0) onReorder(activeTab, entry.id, actualIndex - 1);
                        }}
                        disabled={actualIndex <= 0}
                        aria-label="Move up"
                        className="w-7 h-7 flex items-center justify-center text-pink-nebula-muted bg-pink-nebula-bg/50 border border-pink-nebula-border rounded text-xs disabled:opacity-30 active:bg-pink-nebula-accent-primary/30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actualIndex < planQueueCount - 1) onReorder(activeTab, entry.id, actualIndex + 1);
                        }}
                        disabled={actualIndex >= planQueueCount - 1}
                        aria-label="Move down"
                        className="w-7 h-7 flex items-center justify-center text-pink-nebula-muted bg-pink-nebula-bg/50 border border-pink-nebula-border rounded text-xs disabled:opacity-30 active:bg-pink-nebula-accent-primary/30"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Queue entry */}
                  <div className="flex-1 min-w-0">
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
                      onTurnClick={onTurnClick}
                      maxTurn={maxTurn}
                      showTimes={showTimes}
                    />
                  </div>
                </div>
              );
            });

            return elements;
          })()}
        </div>

        {/* Footer hint */}
        <div className="mt-3 pt-2 border-t border-pink-nebula-border">
          <div className="text-xs text-pink-nebula-muted text-center">
            <span className="hidden md:inline">Drag ⋮⋮ to reorder</span>
            <span className="md:hidden">Tap ▲▼ to reorder</span>
            {' (active items reset) • '}
            {activeTab === 'building' && 'Click ✕ to cancel'}
            {activeTab === 'ship' && 'Batch production'}
            {activeTab === 'colonist' && 'Requires housing'}
            {activeTab === 'research' && 'Research lane'}
          </div>
        </div>
      </Card>
    </div>
  );
});

function laneTabClass(isActive: boolean): string {
  const base = 'inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold outline-none transition-colors duration-200 sm:text-base';
  if (isActive) {
    return `${base} border-cyan-200/65 bg-gradient-to-r from-cyan-400/30 via-sky-400/[0.22] to-blue-500/[0.18] text-cyan-50 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-100/15`;
  }
  return `${base} border-white/10 bg-white/[0.055] text-pink-nebula-muted hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-pink-nebula-text`;
}

function laneIconClass(isActive: boolean): string {
  return `grid h-7 w-7 shrink-0 place-items-center rounded-xl border text-sm ${
    isActive
      ? 'border-cyan-100/25 bg-cyan-50/[0.12] text-white shadow-[0_0_14px_rgba(34,211,238,0.24)]'
      : 'border-white/10 bg-white/[0.05] opacity-80'
  }`;
}
