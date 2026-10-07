"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Hourglass, Infinity as InfinityIcon, Pause } from 'lucide-react';
import type { ItemDefinition, LaneId } from '../../lib/sim/engine/types';
import { LANE_CONFIG } from '../../lib/constants/lanes';
import { LANE_MANUAL_TOPICS, MANUAL_LINKS } from '../../lib/constants/manualLinks';
import { ManualLink } from '@/components/ui/ManualLink';
import { ItemIcon } from '@/components/ui/ItemIcon';
import { RESOURCE_META, formatThousands, type ResourceKey } from '@/components/ui/resources';

export interface SmartQueueCheckShape {
  allowed: boolean;
  canQueueEventually?: boolean;
  waitTurnsNeeded?: number;
  blockers?: unknown[];
  reason?: string;
}

export interface TabbedItemGridProps {
  availableItems: Record<string, any>;
  onQueueItem: (itemId: string, quantity: number) => void;
  onQueueWait?: (laneId: LaneId, waitTurns: number) => void;
  canQueueItem: (itemId: string, quantity: number) => SmartQueueCheckShape;
  activeTab?: LaneId;
  currentTurn?: number;
}

export function getMaxImmediateQueueQuantity(
  itemId: string,
  canQueueItem: (itemId: string, quantity: number) => SmartQueueCheckShape
): number {
  const canQueueNow = (quantity: number) => canQueueItem(itemId, quantity).allowed;
  if (!canQueueNow(1)) return 0;

  let low = 1;
  let high = 2;
  const MAX_SEARCH_QUANTITY = 1_000_000;

  while (high < MAX_SEARCH_QUANTITY && canQueueNow(high)) {
    low = high;
    high *= 2;
  }

  high = Math.min(high, MAX_SEARCH_QUANTITY);
  if (canQueueNow(high)) return high;

  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (canQueueNow(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

export function getMaxQueueableQuantity(
  itemId: string,
  canQueueItem: (itemId: string, quantity: number) => SmartQueueCheckShape
): number {
  const canQueueEventually = (quantity: number) => {
    const check = canQueueItem(itemId, quantity);
    return check.canQueueEventually ?? check.allowed;
  };
  if (!canQueueEventually(1)) return 0;

  let low = 1;
  let high = 2;
  const MAX_SEARCH_QUANTITY = 1_000_000;

  while (high < MAX_SEARCH_QUANTITY && canQueueEventually(high)) {
    low = high;
    high *= 2;
  }

  high = Math.min(high, MAX_SEARCH_QUANTITY);
  if (canQueueEventually(high)) return high;

  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (canQueueEventually(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/** Cost columns in display order; ground and orbital space share one "Space" column. */
const COST_COLUMNS: ReadonlyArray<{ key: ResourceKey; label: string }> = [
  { key: 'metal', label: 'Metal' },
  { key: 'mineral', label: 'Mineral' },
  { key: 'food', label: 'Food' },
  { key: 'energy', label: 'Energy' },
  { key: 'research_points', label: 'RP' },
  { key: 'workers', label: 'Workers' },
  { key: 'space', label: 'Space' },
];

type CostColumn = (typeof COST_COLUMNS)[number];

function costAmount(item: any, key: ResourceKey): number {
  const costs = item.costsPerUnit || {};
  if (key === 'space') return (costs.space || 0) + (costs.space_orbital || 0);
  return costs[key] || 0;
}

/** Only the columns some item in this lane actually uses, so no column is all dashes. */
function visibleColumnsFor(items: any[]): { costs: CostColumn[]; showUpkeep: boolean } {
  return {
    costs: COST_COLUMNS.filter((col) => items.some((item) => costAmount(item, col.key) > 0)),
    showUpkeep: items.some((item) => (item.upkeepPerUnit?.energy || 0) > 0),
  };
}

function gridTemplate(costCount: number, showUpkeep: boolean, isBatchable: boolean): string {
  const parts = ['minmax(9rem,1fr)', `repeat(${costCount}, 4.5rem)`];
  if (showUpkeep) parts.push('4rem');
  parts.push('3rem');
  if (isBatchable) parts.push('auto');
  return parts.join(' ');
}

/**
 * TabbedItemGrid - the catalog for the active lane: a wait control, a labelled column header,
 * and one row per item. Structures and research queue on click or Enter; ships and colonists
 * take a quantity. The lane switcher lives outside (LaneTabs) because the queue shares it.
 */
function TabbedItemGridInner({
  availableItems,
  onQueueItem,
  onQueueWait,
  canQueueItem,
  activeTab = 'building',
}: TabbedItemGridProps) {
  const [waitTurnsInput, setWaitTurnsInput] = useState<string>('5');

  // Pre-compute canQueueItem(id, 1) for all items once per render to avoid
  // O(N log N) redundant calls inside the sort comparator.
  const queueChecks = useMemo(() => {
    const map = new Map<string, ReturnType<typeof canQueueItem>>();
    Object.values(availableItems).forEach((item: any) => {
      map.set(item.id, canQueueItem(item.id, 1));
    });
    return map;
  }, [availableItems, canQueueItem]);

  const prereqDepths = usePrereqDepths(availableItems);
  const itemsByLane = useMemo(
    () => groupAndSortItems(availableItems, queueChecks, canQueueItem, prereqDepths),
    [availableItems, queueChecks, canQueueItem, prereqDepths],
  );

  const handleQueueWait = (e: React.MouseEvent) => {
    e.stopPropagation();
    const turns = parseInt(waitTurnsInput, 10);
    if (!isNaN(turns) && turns > 0 && onQueueWait) {
      onQueueWait(activeTab, turns);
      setWaitTurnsInput('5'); // Reset to default
    }
  };

  // Hide +/++/+++ stepper buttons when the panel is too narrow to fit them
  const gridRef = useRef<HTMLDivElement>(null);
  const [showSteppers, setShowSteppers] = useState(true);
  const [controlsInline, setControlsInline] = useState(true);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setShowSteppers(entry.contentRect.width >= 400);
      setControlsInline(entry.contentRect.width >= 700);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const batch = useBatchQuantities(availableItems, canQueueItem, onQueueItem);

  const items = useMemo(() => itemsByLane[activeTab] || [], [itemsByLane, activeTab]);
  const config = LANE_CONFIG[activeTab];
  const isBatchable = activeTab === 'ship' || activeTab === 'colonist';
  const columns = useMemo(() => visibleColumnsFor(items), [items]);
  const template = gridTemplate(columns.costs.length, columns.showUpkeep, isBatchable && controlsInline);

  const isItemQueueable = (itemId: string): boolean => {
    const check = queueChecks.get(itemId) ?? canQueueItem(itemId, 1);
    return check.canQueueEventually ?? check.allowed;
  };

  const handleItemActivate = (itemId: string) => {
    if (!isItemQueueable(itemId)) return;
    if (isBatchable) {
      batch.tryQueue(itemId);
    } else {
      onQueueItem(itemId, 1);
    }
  };

  return (
    <section className="panel flex min-w-0 flex-col" aria-label="Add to Queue">
      <header className="panel-head">
        <h2 className="panel-title">Add to Queue</h2>
        <CatalogLaneLink laneId={activeTab} />
        <span className="chip ml-auto">{items.length} items</span>
      </header>

      {onQueueWait && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-filament px-4 py-2.5">
          <Pause aria-hidden="true" className="h-4 w-4 text-ink-3" />
          <label htmlFor="wait-turns" className="text-sm text-ink-2">
            Pause the {config.title.toLowerCase()} lane for
          </label>
          <div className="ml-auto flex items-center gap-2">
            <input
              id="wait-turns"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="field field-sm w-14 text-center"
              value={waitTurnsInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d+$/.test(v)) setWaitTurnsInput(v);
              }}
            />
            <span className="text-sm text-ink-3">turns</span>
            <button type="button" onClick={handleQueueWait} className="btn btn-secondary btn-sm">
              Inject wait
            </button>
          </div>
        </div>
      )}

      <div ref={gridRef} className="scroll-nebula h-[60vh] overflow-y-auto md:h-[560px]">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">No items available</p>
        ) : (
          <div role="list" aria-label={`${config.title} catalog`}>
            <ColumnHeader template={template} columns={columns} isBatchable={isBatchable && controlsInline} />
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                template={template}
                columns={columns}
                isBatchable={isBatchable}
                queueCheck={queueChecks.get(item.id) ?? canQueueItem(item.id, 1)}
                queueable={isItemQueueable(item.id)}
                onActivate={handleItemActivate}
                batch={batch}
                showSteppers={showSteppers}
                controlsInline={controlsInline}
                canQueueItem={canQueueItem}
                onQueueItem={onQueueItem}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const TabbedItemGrid = React.memo(TabbedItemGridInner);

function CatalogLaneLink({ laneId }: { laneId: LaneId }) {
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
        className="rounded-sm px-1 hover:text-ink hover:underline"
      >
        {LANE_CONFIG[laneId].title}
      </a>
      {topics.slice(1).map((topic) => (
        <ManualLink key={topic} topic={topic} label={`IC manual: ${topic}`} />
      ))}
    </span>
  );
}

interface ColumnsInfo {
  costs: CostColumn[];
  showUpkeep: boolean;
}

function ColumnHeader({ template, columns, isBatchable }: { template: string; columns: ColumnsInfo; isBatchable: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="sticky top-0 z-10 hidden h-8 items-center gap-x-2 border-b border-filament bg-dust px-4 md:grid"
      style={{ gridTemplateColumns: template }}
    >
      <span className="eyebrow">Item</span>
      {columns.costs.map((col) => (
        <span key={col.key} className="eyebrow text-right" title={RESOURCE_META[col.key].label}>{col.label}</span>
      ))}
      {columns.showUpkeep && <span className="eyebrow text-right" title="Energy used per turn once built">Upkeep</span>}
      <span className="eyebrow text-right" title="Build time in turns">Time</span>
      {isBatchable && <span className="eyebrow text-right">Quantity</span>}
    </div>
  );
}

interface ItemRowProps {
  item: any;
  template: string;
  columns: ColumnsInfo;
  isBatchable: boolean;
  queueCheck: SmartQueueCheckShape;
  queueable: boolean;
  onActivate: (itemId: string) => void;
  batch: BatchQuantities;
  showSteppers: boolean;
  controlsInline: boolean;
  canQueueItem: TabbedItemGridProps['canQueueItem'];
  onQueueItem: TabbedItemGridProps['onQueueItem'];
}

/** One catalog row: a CSS grid on desktop (aligned to the header), two lines on phones. */
function ItemRow({ item, template, columns, isBatchable, queueCheck, queueable, onActivate, batch, showSteppers, controlsInline, canQueueItem, onQueueItem }: ItemRowProps) {
  const waitTurns = queueCheck.waitTurnsNeeded ?? 0;
  // hasWait covers: known wait (waitTurns > 0) OR resource soft-block (no production yet)
  const hasResourceBlocker = queueable && (queueCheck.blockers?.some((b: any) => b.type === 'RESOURCES') ?? false);
  const hasWait = (waitTurns > 0 || hasResourceBlocker) && queueable;
  const energyUpkeep = item.upkeepPerUnit?.energy || 0;
  const clickable = queueable && !isBatchable;
  const lockedReason = queueable ? undefined : batch.humanizeReason(queueCheck.reason, item.id);

  return (
    <div
      role="listitem"
      draggable={queueable}
      onDragStart={(e) => {
        const qty = Number(batch.getQty(item.id)) || 1;
        e.dataTransfer.setData('application/x-florent-grid-item', JSON.stringify({ itemId: item.id, quantity: qty }));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => clickable && onActivate(item.id)}
      title={lockedReason}
      className={`group border-b border-filament/60 px-4 py-2 transition-colors md:grid md:min-h-11 md:items-center md:gap-x-2 md:py-1 ${
        queueable ? 'hover:bg-veil' : 'opacity-50'
      } ${clickable ? 'cursor-pointer' : ''}`}
      style={{ gridTemplateColumns: template }}
    >
      {/* Clickable rows expose an inner button so keyboard users can queue structures and research. */}
      <div className="flex min-w-0 items-center gap-2">
        <ItemIcon itemId={item.id} size={20} />
        {clickable ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onActivate(item.id); }}
            className="min-w-0 truncate rounded-sm text-left text-sm font-semibold text-ink"
            aria-label={`Queue ${item.name}`}
          >
            <span>{item.name}</span>
          </button>
        ) : (
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{item.name}</span>
        )}
        {hasWait && <WaitBadge waitTurns={waitTurns} />}
        <span className="ml-auto text-sm font-semibold text-ink-2 md:hidden">{item.durationTurns}T</span>
      </div>

      <MobileCosts item={item} columns={columns} energyUpkeep={energyUpkeep} />

      {columns.costs.map((col) => (
        <CostCell key={col.key} item={item} column={col} />
      ))}
      {columns.showUpkeep && (
        <span className="hidden text-right text-sm font-semibold text-res-energy md:block" title="Energy used per turn once built">
          {energyUpkeep > 0 ? `-${formatThousands(energyUpkeep)}` : ''}
        </span>
      )}
      <span className="hidden text-right text-sm font-semibold text-ink-2 md:block">{item.durationTurns}T</span>

      {isBatchable && !queueable && (
        <span className={`chip mt-2 text-ink-3 md:mt-0 md:justify-self-end ${controlsInline ? '' : 'md:col-span-full md:mt-1'}`} title={lockedReason}>
          Locked
        </span>
      )}
      {isBatchable && queueable && (
        <BatchControls
          inline={controlsInline}
          item={item}
          queueable={queueable}
          queueCheck={queueCheck}
          batch={batch}
          showSteppers={showSteppers}
          canQueueItem={canQueueItem}
          onQueueItem={onQueueItem}
        />
      )}
    </div>
  );
}

function WaitBadge({ waitTurns }: { waitTurns: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-caution"
      title={
        waitTurns > 0
          ? `Can be queued now, but won't start for ~${waitTurns} turns (resources/prerequisites need more time to be ready)`
          : 'Can be queued, but needs production first (e.g. queue scientists for research)'
      }
    >
      <Hourglass aria-hidden="true" className="h-3.5 w-3.5" />
      {waitTurns > 0 ? `~${waitTurns}T` : <span className="sr-only">needs production first</span>}
    </span>
  );
}

function CostCell({ item, column }: { item: any; column: CostColumn }) {
  const amount = costAmount(item, column.key);
  const isOrbital = column.key === 'space' && (item.costsPerUnit?.space_orbital || 0) > 0;
  const meta = isOrbital ? RESOURCE_META.space_orbital : RESOURCE_META[column.key];
  return (
    <span className={`hidden text-right text-sm font-semibold md:block ${amount > 0 ? meta.text : ''}`} title={amount > 0 ? meta.label : undefined}>
      {amount > 0 ? `${formatThousands(amount)}${column.key === 'space' ? ` ${meta.short}` : ''}` : ''}
    </span>
  );
}

/** Phone layout: costs as a labelled second line since the column header is hidden. */
function MobileCosts({ item, columns, energyUpkeep }: { item: any; columns: ColumnsInfo; energyUpkeep: number }) {
  const parts = columns.costs
    .map((col) => {
      const amount = costAmount(item, col.key);
      const isOrbital = col.key === 'space' && (item.costsPerUnit?.space_orbital || 0) > 0;
      return { col, amount, meta: isOrbital ? RESOURCE_META.space_orbital : RESOURCE_META[col.key] };
    })
    .filter((part) => part.amount > 0);
  if (parts.length === 0 && energyUpkeep === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-7 text-xs font-semibold md:hidden">
      {parts.map(({ col, amount, meta }) => (
        <span key={col.key} className={meta.text}>
          {formatThousands(amount)} <span className="text-ink-3">{meta.short}</span>
        </span>
      ))}
      {energyUpkeep > 0 && (
        <span className="text-res-energy">
          -{formatThousands(energyUpkeep)} <span className="text-ink-3">E/T</span>
        </span>
      )}
    </div>
  );
}

interface BatchControlsProps {
  inline: boolean;
  item: any;
  queueable: boolean;
  queueCheck: SmartQueueCheckShape;
  batch: BatchQuantities;
  showSteppers: boolean;
  canQueueItem: TabbedItemGridProps['canQueueItem'];
  onQueueItem: TabbedItemGridProps['onQueueItem'];
}

function BatchControls({ inline, item, queueable, queueCheck, batch, showSteppers, canQueueItem, onQueueItem }: BatchControlsProps) {
  const error = batch.errors[item.id];
  const stepClass = 'btn btn-secondary btn-sm min-w-8 px-1.5';
  return (
    <div className={`mt-2 flex flex-col items-end gap-1 ${inline ? 'md:mt-0' : 'md:col-span-full md:mt-1'}`}>
      <div className="flex flex-nowrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={batch.getQty(item.id)}
          onChange={(e) => batch.setQty(item.id, e.target.value)}
          onKeyDown={(e) => batch.handleKeyDown(e, item.id)}
          onFocus={(e) => e.target.select()}
          disabled={!queueable}
          aria-label={`Quantity of ${item.name}`}
          aria-invalid={error ? true : undefined}
          className={`field field-sm w-16 text-center ${error ? 'border-danger!' : ''}`}
          placeholder="qty"
        />
        {showSteppers && (
          <>
            <button type="button" onClick={() => batch.increment(item.id, 1)} disabled={!queueable} aria-label="Increase quantity by 1" className={stepClass}>+1</button>
            <button type="button" onClick={() => batch.increment(item.id, 10)} disabled={!queueable} aria-label="Increase quantity by 10" className={stepClass}>+10</button>
            <button type="button" onClick={() => batch.increment(item.id, 100)} disabled={!queueable} aria-label="Increase quantity by 100" className={stepClass}>+100</button>
          </>
        )}
        <button type="button" onClick={() => batch.tryQueue(item.id)} disabled={!queueable} aria-label={`Queue ${item.name}`} className="btn btn-primary btn-sm">
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            // Route through the validated max-quantity helper so the same clamping
            // and error surfacing applies as everywhere else.
            const max = getMaxQueueableQuantity(item.id, canQueueItem);
            if (max > 0) onQueueItem(item.id, max);
          }}
          disabled={!queueable}
          title={queueable ? 'Queue the maximum available' : batch.humanizeReason(queueCheck.reason, item.id)}
          aria-label={`Queue maximum ${item.name}`}
          className="btn btn-secondary btn-sm btn-icon"
        >
          <InfinityIcon aria-hidden="true" />
        </button>
      </div>
      {error && <span role="alert" className="max-w-[16rem] text-right text-xs text-danger">{error}</span>}
    </div>
  );
}

/** Iterative, cycle-guarded prerequisite depth per item; research sorts by it so the tree reads top-down. */
function usePrereqDepths(availableItems: Record<string, any>): Map<string, number> {
  return useMemo(() => {
    const depths = new Map<string, number>();
    const MAX_DEPTH = 20;
    const resolve = (id: string, path: Set<string>): number => {
      const cached = depths.get(id);
      if (cached !== undefined) return cached;
      if (path.has(id)) return 0; // Cycle guard
      path.add(id);
      const item = availableItems[id];
      let depth = 0;
      if (item?.prerequisites?.length) {
        let maxParent = 0;
        for (let i = 0; i < item.prerequisites.length && path.size < MAX_DEPTH; i++) {
          maxParent = Math.max(maxParent, resolve(item.prerequisites[i], path));
        }
        depth = maxParent + 1;
      }
      depths.set(id, depth);
      return depth;
    };
    Object.keys(availableItems).forEach((id) => resolve(id, new Set()));
    return depths;
  }, [availableItems]);
}

/** Group by lane, then sort: queueable first, research by prerequisite depth, then duration, then name. */
function groupAndSortItems(
  availableItems: Record<string, any>,
  queueChecks: Map<string, SmartQueueCheckShape>,
  canQueueItem: TabbedItemGridProps['canQueueItem'],
  prereqDepths: Map<string, number>,
): Record<string, any[]> {
  const grouped: Record<string, any[]> = { building: [], ship: [], colonist: [], research: [] };
  Object.values(availableItems).forEach((item: any) => {
    // Outpost and worker cannot be built manually
    if (item.id === 'outpost' || item.id === 'worker') return;
    if (item.lane && grouped[item.lane]) grouped[item.lane].push(item);
  });

  const queueableOf = (item: any) => {
    const check = queueChecks.get(item.id) ?? canQueueItem(item.id, 1);
    return check.canQueueEventually ?? check.allowed;
  };

  Object.keys(grouped).forEach((laneId) => {
    grouped[laneId].sort((a, b) => {
      const aQueueable = queueableOf(a);
      const bQueueable = queueableOf(b);
      if (aQueueable !== bQueueable) return bQueueable ? 1 : -1;
      if (laneId === 'research') {
        const depthDiff = (prereqDepths.get(a.id) ?? 0) - (prereqDepths.get(b.id) ?? 0);
        if (depthDiff !== 0) return depthDiff;
      }
      if (a.durationTurns !== b.durationTurns) return a.durationTurns - b.durationTurns;
      return a.name.localeCompare(b.name);
    });
  });
  return grouped;
}

interface BatchQuantities {
  errors: Record<string, string>;
  getQty: (itemId: string) => string;
  setQty: (itemId: string, value: string) => void;
  increment: (itemId: string, delta: number) => void;
  tryQueue: (itemId: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => void;
  humanizeReason: (reason: string | undefined, itemId: string) => string;
}

/** Per-item quantity drafts and inline errors for ships and colonists. */
function useBatchQuantities(
  availableItems: Record<string, any>,
  canQueueItem: TabbedItemGridProps['canQueueItem'],
  onQueueItem: TabbedItemGridProps['onQueueItem'],
): BatchQuantities {
  const [itemQuantities, setItemQuantities] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getDefaultQty = useCallback((itemId: string): string => (itemId === 'soldier' || itemId === 'scientist' ? '100' : '1'), []);
  const getQty = useCallback((itemId: string): string => itemQuantities[itemId] ?? getDefaultQty(itemId), [itemQuantities, getDefaultQty]);
  const setError = useCallback((itemId: string, message: string) => setErrors((prev) => ({ ...prev, [itemId]: message })), []);
  const humanizeReason = useCallback((reason: string | undefined, itemId: string) => humanizeQueueReason(reason, availableItems[itemId]), [availableItems]);

  const tryQueue = useCallback((itemId: string) => {
    const raw = getQty(itemId);
    const qty = parseInt(raw, 10);
    if (raw === '' || raw === '0') return setError(itemId, 'Quantity cannot be empty.');
    if (isNaN(qty) || qty < 1) return setError(itemId, 'Enter a valid quantity ≥ 1.');
    const validation = canQueueItem(itemId, qty);
    // Block only hard failures (canQueueEventually === false). Items with a wait are still queueable.
    const isBlocked = validation.canQueueEventually !== undefined ? !validation.canQueueEventually : !validation.allowed;
    if (isBlocked) return setError(itemId, humanizeReason(validation.reason, itemId));
    onQueueItem(itemId, qty);
    setItemQuantities((prev) => ({ ...prev, [itemId]: getDefaultQty(itemId) }));
    setError(itemId, '');
  }, [getQty, getDefaultQty, humanizeReason, canQueueItem, onQueueItem, setError]);

  // Freely increment the displayed quantity — validation happens on submit.
  const increment = useCallback((itemId: string, delta: number) => {
    const current = parseInt(getQty(itemId), 10) || 0;
    setItemQuantities((prev) => ({ ...prev, [itemId]: String(Math.max(1, current + delta)) }));
    setError(itemId, '');
  }, [getQty, setError]);

  const setQty = useCallback((itemId: string, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return; // digits only
    setItemQuantities((prev) => ({ ...prev, [itemId]: value }));
    setError(itemId, '');
  }, [setError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryQueue(itemId);
    } else if (e.key === 'Escape') {
      setItemQuantities((prev) => ({ ...prev, [itemId]: getDefaultQty(itemId) }));
      setError(itemId, '');
    }
  }, [tryQueue, getDefaultQty, setError]);

  return { errors, getQty, setQty, increment, tryQueue, handleKeyDown, humanizeReason };
}

function humanizeQueueReason(reason: string | undefined, def: ItemDefinition | any): string {
  switch (reason) {
    case 'REQ_MISSING': {
      const prereqs = (def?.prerequisites || []).join(', ');
      return prereqs ? `Build prerequisite first: ${prereqs}` : 'Missing prerequisite.';
    }
    case 'PLANET_LIMIT_REACHED':
      return 'Already built — only one allowed per planet.';
    case 'HOUSING_MISSING':
      return def?.colonistKind === 'soldier'
        ? 'Not enough soldier housing — build a barracks first.'
        : 'Not enough scientist housing — build a research lab first.';
    case 'ENERGY_INSUFFICIENT':
      return 'Would push net energy below zero — only zero-upkeep buildings allowed.';
    case 'INSUFFICIENT_RESOURCES':
      return 'Resources cannot be produced — check net production for the cost types.';
    default:
      return reason || 'Cannot queue this item.';
  }
}
