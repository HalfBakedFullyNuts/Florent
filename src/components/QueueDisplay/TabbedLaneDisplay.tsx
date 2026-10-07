"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ArrowDown, ArrowUp, Clock, GripVertical, Hash, MapPin, Trash2 } from 'lucide-react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { QueueLaneEntry } from './QueueLaneEntry';
import { LANE_CONFIG } from '../../lib/constants/lanes';
import { LANE_MANUAL_TOPICS, MANUAL_LINKS } from '../../lib/constants/manualLinks';
import { ManualLink } from '@/components/ui/ManualLink';
import { formatTickTime, getRoundStartMs, setRoundStartFromTick } from '../../lib/utils/tickTime';

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
  onClearLane?: (laneId: LaneId) => void;
  disabled?: boolean;
  defs: Record<string, any>;
  activeTab?: LaneId;
  onTurnClick?: (turn: number) => void;
  maxTurn?: number;
  /** Called when an item is dragged from the Add-to-Queue panel and dropped here. */
  onDropGridItem?: (itemId: string, quantity: number) => void;
}

const LANE_HINT: Record<LaneId, string> = {
  building: 'One structure at a time',
  ship: 'Batch production',
  colonist: 'Requires housing',
  research: 'Shared by all planets',
};

/**
 * TabbedLaneDisplay - the active lane's queue, newest entry on top, with a "now" divider at the
 * viewed turn. Drag the grip (or use the arrows on phones) to reorder; drop catalog rows here to queue.
 * Memoized to prevent unnecessary re-renders.
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
  onClearLane,
  disabled = false,
  defs,
  activeTab = 'building',
  onTurnClick,
  maxTurn = 199,
  onDropGridItem,
}: TabbedLaneDisplayProps) {
  const [showTimes, setShowTimes] = useState(false);
  const [dragOverExternal, setDragOverExternal] = useState(false);
  const [showCalibrate, setShowCalibrate] = useState(false);
  // Calibrated round-start for wall-clock display. Persisted in localStorage.
  const [roundStartMs, setRoundStartMs] = useState<number>(() => getRoundStartMs());

  const scrollRef = useRef<HTMLDivElement>(null);
  const edgeScroll = useEdgeScroll(scrollRef);
  const drag = useReorderDrag();

  const laneViews: Record<LaneId, LaneView | null> = {
    building: buildingLane,
    ship: shipLane,
    colonist: colonistLane,
    research: researchLane,
  };
  const config = LANE_CONFIG[activeTab];
  const laneView = laneViews[activeTab];
  const entryCount = laneView?.entries.length ?? 0;

  // Stable reference across internal re-renders so the maxQuantities memo doesn't re-run per drag event.
  const nonCompletedEntries = useMemo(
    () => laneView?.entries.filter(e => e.status !== 'completed') ?? [],
    [laneView?.entries],
  );
  const newestId = nonCompletedEntries.length > 0 ? nonCompletedEntries[nonCompletedEntries.length - 1].id : null;

  // Only ship/colonist lanes show quantity steppers; keyed on entry ids so viewTurn changes don't recompute.
  const maxQuantities = useMemo<Record<string, number>>(() => {
    if (!getMaxQuantity || (activeTab !== 'ship' && activeTab !== 'colonist')) return {};
    const result: Record<string, number> = {};
    for (const entry of nonCompletedEntries) {
      if (entry.isWait || entry.isAutoWait) continue;
      result[entry.id] = getMaxQuantity(activeTab, entry);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonCompletedEntries, getMaxQuantity, activeTab]);

  const handleDrop = (e: React.DragEvent) => {
    edgeScroll.stop();
    setDragOverExternal(false);
    const raw = e.dataTransfer.getData('application/x-florent-grid-item');
    if (!raw) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const { itemId, quantity } = JSON.parse(raw) as { itemId: string; quantity: number };
      onDropGridItem?.(itemId, quantity);
    } catch { /* ignore malformed data */ }
  };

  return (
    <section
      aria-label="Planet Queue"
      className={`panel flex min-w-0 flex-col transition-shadow ${dragOverExternal ? 'ring-2 ring-oiii/60' : ''}`}
      onDragOver={(e) => {
        if (drag.dragged) edgeScroll.follow(e.clientY);
        if (e.dataTransfer.types.includes('application/x-florent-grid-item')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragOverExternal(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          edgeScroll.stop();
          setDragOverExternal(false);
        }
      }}
      onDrop={handleDrop}
      onDragEnd={() => edgeScroll.stop()}
    >
      <header className="panel-head flex-wrap">
        <h2 className="panel-title">Planet Queue</h2>
        <QueueLaneLink laneId={activeTab} />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setShowTimes(t => !t); if (showTimes) setShowCalibrate(false); }}
            aria-pressed={showTimes}
            title={showTimes ? 'Show turn numbers' : 'Show wall-clock times (your local timezone)'}
            className={`btn btn-ghost btn-sm btn-icon ${showTimes ? '!text-oiii' : ''}`}
            aria-label={showTimes ? 'Show turn numbers' : 'Show wall-clock times'}
          >
            {showTimes ? <Hash aria-hidden="true" /> : <Clock aria-hidden="true" />}
          </button>
          {showTimes && (
            <button
              type="button"
              onClick={() => setShowCalibrate(v => !v)}
              title="Calibrate clock: enter your current in-game tick to align displayed times"
              aria-label="Calibrate clock"
              aria-expanded={showCalibrate}
              className="btn btn-ghost btn-sm btn-icon"
            >
              <MapPin aria-hidden="true" />
            </button>
          )}
          <span className="chip" aria-label={`${entryCount} entries`}>{entryCount > 0 ? entryCount : '—'}</span>
          {onClearLane && (
            <button
              type="button"
              onClick={() => onClearLane(activeTab)}
              disabled={entryCount === 0}
              className="btn btn-ghost btn-sm text-ink-3 hover:!text-danger"
              aria-label={`Clear ${config.title} lane`}
              title={`Remove every entry from the ${config.title} lane`}
            >
              <Trash2 aria-hidden="true" className="!h-3.5 !w-3.5" />
              Clear
            </button>
          )}
        </div>
      </header>

      {showCalibrate && (
        <CalibrateForm
          onDone={() => {
            setRoundStartMs(getRoundStartMs());
            setShowCalibrate(false);
          }}
          onCancel={() => setShowCalibrate(false)}
        />
      )}

      <div ref={scrollRef} className="scroll-nebula max-h-[60vh] min-h-[12rem] overflow-y-auto md:max-h-[560px]">
        {!laneView || laneView.entries.length === 0 ? (
          <p className="m-4 rounded-ctl border border-dashed border-filament py-8 text-center text-sm text-ink-3">
            Queue empty — click or drag an item from the catalog
          </p>
        ) : (
          <QueueRows
            laneView={laneView}
            activeTab={activeTab}
            currentTurn={currentTurn}
            newestId={newestId}
            maxQuantities={maxQuantities}
            defs={defs}
            disabled={disabled}
            drag={drag}
            showTimes={showTimes}
            roundStartMs={roundStartMs}
            maxTurn={maxTurn}
            onCancel={onCancel}
            onQuantityChange={onQuantityChange}
            onReorder={onReorder}
            onTurnClick={onTurnClick}
          />
        )}
      </div>

      <footer className="border-t border-filament px-4 py-2 text-center text-xs text-ink-3">
        <span className="hidden md:inline">Drag the grip to reorder</span>
        <span className="md:hidden">Use the arrows to reorder</span>
        {' · active items restart · '}
        {LANE_HINT[activeTab]}
      </footer>
    </section>
  );
});

function QueueLaneLink({ laneId }: { laneId: LaneId }) {
  const topics = LANE_MANUAL_TOPICS[laneId] ?? [];
  if (topics.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-sm text-ink-3">
      <span aria-hidden="true">·</span>
      <a
        href={MANUAL_LINKS[topics[0]]}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`IC manual: ${LANE_CONFIG[laneId].title}`}
        className="rounded px-1 hover:text-ink hover:underline"
      >
        {LANE_CONFIG[laneId].title}
      </a>
      {topics.slice(1).map((topic) => (
        <ManualLink key={topic} topic={topic} label={`IC manual: ${topic}`} />
      ))}
    </span>
  );
}

function CalibrateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [tickInput, setTickInput] = useState('');
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-b border-filament bg-veil px-4 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        const tick = parseInt(tickInput, 10);
        if (!Number.isFinite(tick) || tick < 1) return;
        setRoundStartFromTick(tick);
        onDone();
      }}
    >
      <label htmlFor="calibrate-tick" className="text-sm text-ink-2">Current in-game tick</label>
      <input
        id="calibrate-tick"
        type="number"
        min={1}
        value={tickInput}
        onChange={(e) => setTickInput(e.target.value)}
        placeholder="e.g. 245"
        className="field field-sm w-24"
        autoFocus
      />
      <button type="submit" className="btn btn-primary btn-sm">Set</button>
      <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
    </form>
  );
}

interface QueueRowsProps {
  laneView: LaneView;
  activeTab: LaneId;
  currentTurn: number;
  newestId: string | null;
  maxQuantities: Record<string, number>;
  defs: Record<string, any>;
  disabled: boolean;
  drag: ReorderDrag;
  showTimes: boolean;
  roundStartMs: number;
  maxTurn: number;
  onCancel: TabbedLaneDisplayProps['onCancel'];
  onQuantityChange?: TabbedLaneDisplayProps['onQuantityChange'];
  onReorder?: TabbedLaneDisplayProps['onReorder'];
  onTurnClick?: TabbedLaneDisplayProps['onTurnClick'];
}

/**
 * Newest-first rows with a "now" divider before the first entry that finished by the viewed turn.
 * Drop targets map to pendingQueue indices — anything else returns INVALID_INDEX from the controller.
 */
function QueueRows(props: QueueRowsProps) {
  const { laneView, activeTab, currentTurn, showTimes, roundStartMs } = props;
  const reversed = laneView.entries.slice().reverse();
  const finishTurn = (e: LaneEntry): number | null => e.completionTurn ?? e.eta ?? null;
  const dividerIndex = reversed.findIndex((e) => {
    const finish = finishTurn(e);
    return finish !== null && finish <= currentTurn;
  });

  const pendingEntries = laneView.entries.filter(e => e.status === 'pending');
  const pendingIndexById = new Map<string, number>(pendingEntries.map((e, i): [string, number] => [e.id, i]));
  const reorder = {
    pendingCount: pendingEntries.length,
    dropIndexFor: (e: LaneEntry) => (e.status === 'pending' ? (pendingIndexById.get(e.id) ?? -1) : -1),
    sourceIndexFor: (e: LaneEntry) => {
      if (e.status === 'pending') return pendingIndexById.get(e.id) ?? -1;
      return e.status === 'active' ? pendingEntries.length : -1;
    },
  };

  return (
    <ol aria-label={`${LANE_CONFIG[activeTab].title} queue, newest first`}>
      {reversed.map((entry, displayIndex) => (
        <React.Fragment key={entry.id}>
          {dividerIndex === displayIndex && (
            <li aria-hidden="true" className="pointer-events-none flex select-none items-center gap-3 px-4 py-1.5">
              <span className="h-px flex-1 bg-halpha/50" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-halpha-soft">
                {showTimes ? formatTickTime(currentTurn, roundStartMs) : `T${currentTurn}`}
              </span>
              <span className="h-px flex-1 bg-halpha/50" />
            </li>
          )}
          <QueueRow {...props} entry={entry} displayIndex={displayIndex} reorder={reorder} />
        </React.Fragment>
      ))}
    </ol>
  );
}

interface QueueRowProps extends QueueRowsProps {
  entry: LaneEntry;
  displayIndex: number;
  reorder: {
    pendingCount: number;
    dropIndexFor: (e: LaneEntry) => number;
    sourceIndexFor: (e: LaneEntry) => number;
  };
}

function QueueRow({ entry, displayIndex, reorder, activeTab, currentTurn, newestId, maxQuantities, defs, disabled, drag, showTimes, roundStartMs, maxTurn, onCancel, onQuantityChange, onReorder, onTurnClick }: QueueRowProps) {
  const def = defs[entry.itemId];
  const dropIndex = reorder.dropIndexFor(entry);
  const sourceIndex = reorder.sourceIndexFor(entry);
  const downBoundExclusive = entry.status === 'active' ? reorder.pendingCount : reorder.pendingCount - 1;
  // Auto-generated waits reposition on their own; every other plan entry can move (re-runs from T1).
  const canDrag = !disabled && !!onReorder && !entry.isAutoWait;
  const isDragging = drag.dragged?.entryId === entry.id && drag.dragged?.laneId === activeTab;
  const isDropTarget = drag.overIndex === displayIndex && drag.dragged && drag.dragged.entryId !== entry.id;
  const acceptsDrop = !!drag.dragged && drag.dragged.laneId === activeTab && drag.dragged.entryId !== entry.id && dropIndex >= 0;

  return (
    <li
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', entry.id);
        drag.start({ laneId: activeTab, entryId: entry.id });
      }}
      onDragOver={(e) => {
        if (!acceptsDrop) return;
        e.preventDefault();
        e.stopPropagation();
        drag.over(displayIndex);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) drag.over(null);
      }}
      onDrop={(e) => {
        // Internal reorder is consumed here; external catalog drops bubble to the panel handler.
        if (acceptsDrop && onReorder && drag.dragged) {
          e.preventDefault();
          e.stopPropagation();
          onReorder(activeTab, drag.dragged.entryId, dropIndex);
        }
        drag.end();
      }}
      onDragEnd={drag.end}
      className={`relative flex items-stretch ${isDragging ? 'opacity-40' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {isDropTarget && <span aria-hidden="true" className="absolute inset-x-0 -top-px z-10 h-0.5 bg-oiii" />}

      {canDrag && (
        <span aria-hidden="true" className="hidden w-6 shrink-0 items-center justify-center text-ink-3 md:flex">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      {canDrag && onReorder && (
        <span className="flex shrink-0 flex-col justify-center gap-0.5 pl-2 md:hidden">
          <button type="button" onClick={() => sourceIndex > 0 && onReorder(activeTab, entry.id, sourceIndex - 1)} disabled={sourceIndex <= 0} aria-label="Move up" className="btn btn-ghost btn-sm btn-icon !h-6">
            <ArrowUp aria-hidden="true" className="!h-3.5 !w-3.5" />
          </button>
          <button type="button" onClick={() => sourceIndex >= 0 && sourceIndex < downBoundExclusive && onReorder(activeTab, entry.id, sourceIndex + 1)} disabled={sourceIndex < 0 || sourceIndex >= downBoundExclusive} aria-label="Move down" className="btn btn-ghost btn-sm btn-icon !h-6">
            <ArrowDown aria-hidden="true" className="!h-3.5 !w-3.5" />
          </button>
        </span>
      )}

      <div className={`min-w-0 flex-1 ${canDrag ? '' : 'md:pl-6'}`}>
        <QueueLaneEntry
          entry={entry}
          currentTurn={currentTurn}
          onCancel={() => onCancel(activeTab, entry)}
          onQuantityChange={onQuantityChange ? (newQty) => onQuantityChange(activeTab, entry, newQty) : undefined}
          maxQuantity={maxQuantities[entry.id]}
          showQuantityInput={activeTab === 'ship' || activeTab === 'colonist'}
          disabled={disabled}
          isNewest={entry.id === newestId}
          def={def}
          busyWorkers={def?.costsPerUnit?.workers ? def.costsPerUnit.workers * entry.quantity : 0}
          onTurnClick={onTurnClick}
          maxTurn={maxTurn}
          showTimes={showTimes}
          roundStartMs={roundStartMs}
          laneId={activeTab}
        />
      </div>
    </li>
  );
}

interface DraggedEntry {
  laneId: LaneId;
  entryId: string;
}

interface ReorderDrag {
  dragged: DraggedEntry | null;
  overIndex: number | null;
  start: (item: DraggedEntry) => void;
  over: (index: number | null) => void;
  end: () => void;
}

function useReorderDrag(): ReorderDrag {
  const [dragged, setDragged] = useState<DraggedEntry | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const over = useCallback((index: number | null) => setOverIndex((prev) => (prev === index ? prev : index)), []);
  const end = useCallback(() => {
    setDragged(null);
    setOverIndex(null);
  }, []);
  return { dragged, overIndex, start: setDragged, over, end };
}

/** Scrolls the queue while a reorder drag hovers within 60px of its top or bottom edge. */
function useEdgeScroll(scrollRef: React.RefObject<HTMLDivElement>) {
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const run = useCallback((direction: 'up' | 'down') => {
    stop();
    const speed = 8;
    const tick = () => {
      const el = scrollRef.current;
      if (el) el.scrollTop += direction === 'down' ? speed : -speed;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stop, scrollRef]);

  const follow = useCallback((clientY: number) => {
    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;
    const edge = 60;
    if (clientY < rect.top + edge) run('up');
    else if (clientY > rect.bottom - edge) run('down');
    else stop();
  }, [run, stop, scrollRef]);

  useEffect(() => stop, [stop]);
  return { follow, stop };
}
