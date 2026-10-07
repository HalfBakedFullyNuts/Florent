"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { ItemDefinition, LaneId } from '../../lib/sim/engine/types';
import { Card } from '@/components/ui/card';
import { GlassQueueButton } from '@/components/ui/glass-queue-button';
import { LANE_CONFIG, ALL_LANES } from '../../lib/constants/lanes';
import { LANE_MANUAL_TOPICS, MANUAL_LINKS } from '../../lib/constants/manualLinks';
import { ManualLink } from '@/components/ui/ManualLink';
import { ItemIcon } from '@/components/ui/ItemIcon';

// Exist only as starting state (or implicitly), never offered in the build list
const NON_BUILDABLE_ITEM_IDS: ReadonlySet<string> = new Set(['outpost', 'worker', 'spy_centre']);

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
  onClearLane?: (laneId: LaneId) => void;
  activeTab?: LaneId;
  onTabChange?: (tab: LaneId) => void;
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

/**
 * TabbedItemGrid - Tabbed interface for queue items
 * Shows only the active tab's items
 */
function TabbedItemGridInner({
  availableItems,
  onQueueItem,
  onQueueWait,
  canQueueItem,
  onClearLane,
  activeTab: externalActiveTab,
  onTabChange,
  currentTurn = 1,
}: TabbedItemGridProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<LaneId>('building');
  const [waitTurnsInput, setWaitTurnsInput] = useState<string>('5');

  // Use external tab state if provided, otherwise use internal
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  // Pre-compute canQueueItem(id, 1) for all items once per render to avoid
  // O(N log N) redundant calls inside the sort comparator.
  const queueChecks = useMemo(() => {
    const map = new Map<string, ReturnType<typeof canQueueItem>>();
    Object.values(availableItems).forEach((item: any) => {
      map.set(item.id, canQueueItem(item.id, 1));
    });
    return map;
  }, [availableItems, canQueueItem]);

  /**
   * Precompute the prerequisite chain depth for every item once (iterative,
   * cycle-guarded, memoised per id). Research uses this as its secondary sort
   * so the tech tree reads top-to-bottom regardless of lock state.
   */
  const prereqDepths = useMemo(() => {
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

  // Group by lane AND sort (queueable first, then depth/duration/name) — all
  // memoized so dragging the turn slider doesn't regroup the grid per tick.
  const itemsByLane = useMemo(() => {
    const grouped: Record<string, any[]> = {
      building: [],
      ship: [],
      colonist: [],
      research: [],
    };

    Object.values(availableItems).forEach((item: any) => {
      // Starting-only items that cannot be built manually
      if (NON_BUILDABLE_ITEM_IDS.has(item.id)) {
        return;
      }
      if (item.lane && grouped[item.lane]) {
        grouped[item.lane].push(item);
      }
    });

    Object.keys(grouped).forEach((laneId) => {
      grouped[laneId].sort((a, b) => {
        const aCheck = queueChecks.get(a.id) ?? canQueueItem(a.id, 1);
        const bCheck = queueChecks.get(b.id) ?? canQueueItem(b.id, 1);
        // Use canQueueEventually (false = hard block, grey out). Fallback to allowed for compatibility.
        const aQueueable = aCheck.canQueueEventually ?? aCheck.allowed;
        const bQueueable = bCheck.canQueueEventually ?? bCheck.allowed;

        if (aQueueable !== bQueueable) {
          return bQueueable ? 1 : -1;
        }

        if (laneId === 'research') {
          const aDepth = prereqDepths.get(a.id) ?? 0;
          const bDepth = prereqDepths.get(b.id) ?? 0;
          if (aDepth !== bDepth) return aDepth - bDepth;
        }

        if (a.durationTurns !== b.durationTurns) {
          return a.durationTurns - b.durationTurns;
        }

        return a.name.localeCompare(b.name);
      });
    });

    return grouped;
  }, [availableItems, queueChecks, canQueueItem, prereqDepths]);

  const handleQueueWait = (e: React.MouseEvent) => {
    e.stopPropagation();
    const turns = parseInt(waitTurnsInput, 10);
    if (!isNaN(turns) && turns > 0 && onQueueWait) {
      onQueueWait(activeTab, turns);
      setWaitTurnsInput('5'); // Reset to default
    }
  };

  // An item is "queueable" (not greyed out) if it can eventually be queued.
  // Hard blocks (canQueueEventually === false) grey it out.
  // Items that need a wait (canQueueNow === false, canQueueEventually === true) remain clickable.
  const isItemQueueable = (itemId: string): boolean => {
    const check = queueChecks.get(itemId) ?? canQueueItem(itemId, 1);
    return check.canQueueEventually ?? check.allowed;
  };

  const formatCost = (item: any): Array<{ resource: string; amount: number }> => {
    if (!item.costsPerUnit) return [];
    return Object.entries(item.costsPerUnit)
      .filter(([_, amount]) => (amount as number) > 0)
      .map(([resource, amount]) => ({
        resource,
        amount: amount as number,
      }));
  };

  const getResourceColor = (resource: string): string => {
    switch (resource) {
      case 'metal': return 'text-gray-300'; // silver
      case 'mineral': return 'text-red-500'; // red
      case 'food': return 'text-green-500'; // green
      case 'energy': return 'text-blue-400'; // blue
      case 'research_points': return 'text-yellow-400';
      case 'workers': return 'text-orange-400'; // orange
      case 'ground_space': return 'text-amber-600'; // brown
      case 'orbital_space': return 'text-blue-600'; // blue
      case 'space': return 'text-amber-600'; // default to ground space color
      default: return 'text-pink-nebula-muted';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Define column order for costs (aligned across all items)
  const costColumns = ['metal', 'mineral', 'food', 'energy', 'research_points', 'workers', 'space'] as const;

  // Hide +/++/+++ stepper buttons when the panel is too narrow to fit them
  const gridRef = useRef<HTMLDivElement>(null);
  const [showSteppers, setShowSteppers] = useState(true);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setShowSteppers(entry.contentRect.width >= 320);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Track quantities for each batchable item (raw string so empty is allowed)
  const [itemQuantities, setItemQuantities] = useState<Record<string, string>>({});
  // Per-item inline error message
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const getDefaultQty = useCallback((itemId: string): string => {
    return itemId === 'soldier' || itemId === 'scientist' ? '100' : '1';
  }, []);

  const getQty = useCallback(
    (itemId: string): string => itemQuantities[itemId] ?? getDefaultQty(itemId),
    [itemQuantities, getDefaultQty]
  );

  const humanizeReason = useCallback((reason: string | undefined, itemId: string): string => {
    const def = availableItems[itemId];
    switch (reason) {
      case 'REQ_MISSING': {
        const prereqs = (def?.prerequisites || []).join(', ');
        return prereqs
          ? `Build prerequisite first: ${prereqs}`
          : 'Missing prerequisite.';
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
  }, [availableItems]);

  const tryQueue = useCallback((itemId: string, laneId: LaneId) => {
    const raw = getQty(itemId);
    if (raw === '' || raw === '0') {
      setItemErrors(prev => ({ ...prev, [itemId]: 'Quantity cannot be empty.' }));
      return;
    }
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 1) {
      setItemErrors(prev => ({ ...prev, [itemId]: 'Enter a valid quantity ≥ 1.' }));
      return;
    }
    const validation = canQueueItem(itemId, qty);
    // Block only hard failures (canQueueEventually === false). Items with a wait are still queueable.
    const isBlocked = validation.canQueueEventually !== undefined
      ? !validation.canQueueEventually
      : !validation.allowed;
    if (isBlocked) {
      setItemErrors(prev => ({ ...prev, [itemId]: humanizeReason(validation.reason, itemId) }));
      return;
    }
    onQueueItem(itemId, qty);
    setItemQuantities(prev => ({ ...prev, [itemId]: getDefaultQty(itemId) }));
    setItemErrors(prev => ({ ...prev, [itemId]: '' }));
  }, [getQty, getDefaultQty, humanizeReason, canQueueItem, onQueueItem]);

  // Freely increment the displayed quantity — no real-time constraint check.
  // Validation only happens when the user actually submits (clicks "add" or "∞").
  const incrementQty = useCallback((itemId: string, delta: number) => {
    const current = parseInt(getQty(itemId), 10) || 0;
    setItemQuantities(prev => ({ ...prev, [itemId]: String(Math.max(1, current + delta)) }));
    setItemErrors(prev => ({ ...prev, [itemId]: '' }));
  }, [getQty]);

  const handleItemClick = (itemId: string, laneId: LaneId) => {
    const queueable = isItemQueueable(itemId);
    if (!queueable) return;

    if (laneId === 'building' || laneId === 'research') {
      // Structures and Research: queue immediately with quantity=1
      onQueueItem(itemId, 1);
    } else {
      // Ships/Colonists: delegate to tryQueue for validation
      tryQueue(itemId, laneId);
    }
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    // Only allow digits (no negative sign, no decimals)
    if (value !== '' && !/^\d+$/.test(value)) return;
    setItemQuantities(prev => ({ ...prev, [itemId]: value }));
    // Clear error as soon as the user types
    if (itemErrors[itemId]) setItemErrors(prev => ({ ...prev, [itemId]: '' }));
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string, laneId: LaneId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryQueue(itemId, laneId);
    } else if (e.key === 'Escape') {
      setItemQuantities(prev => ({ ...prev, [itemId]: getDefaultQty(itemId) }));
      setItemErrors(prev => ({ ...prev, [itemId]: '' }));
    }
  };

  const items = itemsByLane[activeTab] || [];
  const config = LANE_CONFIG[activeTab];

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
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
      <Card ref={gridRef} className="scroll-nebula h-[60vh] overflow-y-auto p-3 pr-4 md:h-[600px] md:p-4 md:pr-5">
        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
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
          {onClearLane ? (
            <button
              type="button"
              onClick={() => onClearLane(activeTab)}
              className="group ml-auto inline-flex min-w-23 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-pink-nebula-muted transition-colors hover:border-red-300/45 hover:bg-red-500/12 hover:text-red-200 focus:outline-hidden focus:ring-2 focus:ring-red-300/30"
              aria-label={`Clear ${config.title} lane`}
              title={`Clear ${config.title} lane`}
            >
              <span className="group-hover:hidden group-focus:hidden">
                {items.length} items
              </span>
              <span className="hidden group-hover:inline group-focus:inline">
                Clear lane
              </span>
            </button>
          ) : (
            <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-pink-nebula-muted">
              {items.length} items
            </span>
          )}
        </div>

        <div className="space-y-2">
          {/* Manual Wait Controls Row */}
          {onQueueWait && (
            <div className="mb-4 flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3 shadow-inner shadow-black/25 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-pink-nebula-text font-semibold">
                  Wait (Pause Queue)
                </div>
                <div className="text-xs text-pink-nebula-muted">
                  Insert idle turns into the active lane.
                </div>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="h-10 w-16 rounded-xl border border-pink-nebula-border/80 bg-slate-950/70 px-2 text-center text-pink-nebula-text outline-hidden transition-colors focus:border-pink-nebula-accent-secondary focus:ring-2 focus:ring-pink-nebula-accent-primary/25"
                  value={waitTurnsInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d+$/.test(v)) setWaitTurnsInput(v);
                  }}
                />
                <span className="mr-1 text-sm text-pink-nebula-muted">turns</span>
                <button
                  onClick={handleQueueWait}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-4 text-sm font-bold text-cyan-100 transition-colors hover:border-cyan-200/60 hover:bg-cyan-400/25 focus:outline-hidden focus:ring-2 focus:ring-cyan-300/35"
                >
                  <span aria-hidden="true">⏸</span>
                  Inject Wait
                </button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center text-pink-nebula-muted text-base py-4">
              No items available
            </div>
          ) : (
            items.map((item) => {
              const queueCheck = queueChecks.get(item.id) ?? canQueueItem(item.id, 1);
              const queueable = isItemQueueable(item.id);
              const waitTurns = queueCheck.waitTurnsNeeded ?? 0;
              // hasWait covers: known wait (waitTurns > 0) OR resource soft-block (no production yet)
              const hasResourceBlocker = queueable && (queueCheck.blockers?.some((b: any) => b.type === 'RESOURCES') ?? false);
              const hasWait = (waitTurns > 0 || hasResourceBlocker) && queueable;
              const costsMap = item.costsPerUnit || {};
              const energyUpkeep = item.upkeepPerUnit?.energy || 0;
              const isBatchable = activeTab === 'ship' || activeTab === 'colonist';
              const maxQueueableNow = queueCheck.allowed;

              return (
                <div
                  key={item.id}
                  draggable={queueable}
                  onDragStart={(e) => {
                    const qty = Number(getQty(item.id)) || 1;
                    e.dataTransfer.setData(
                      'application/x-florent-grid-item',
                      JSON.stringify({ itemId: item.id, quantity: qty })
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => !isBatchable && queueable && handleItemClick(item.id, activeTab)}
                  className={`
                    w-full text-left p-2 bg-pink-nebula-panel/50 border border-pink-nebula-border rounded
                    transition-colors group
                    ${queueable
                      ? isBatchable
                        ? 'hover:bg-pink-nebula-panel/70'
                        : 'hover:bg-pink-nebula-panel/70 cursor-pointer'
                      : 'opacity-50'
                    }
                  `}
                >
                  {/* Two-row on mobile, single row on desktop */}
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-xs md:text-sm font-mono">
                    {/* Top row on mobile: name + duration + qty controls (right side) */}
                    <div className="flex items-center gap-2 min-w-0 md:contents">
                      {/* Drag handle */}
                      {queueable && (
                        <span className="text-pink-nebula-muted/40 group-hover:text-pink-nebula-muted/80 cursor-grab select-none text-xs" title="Drag to queue panel">⠿</span>
                      )}

                      {/* Item Name */}
                      <div className="text-pink-nebula-text font-semibold flex-1 min-w-0 truncate md:flex-none md:w-40 md:whitespace-nowrap flex items-center gap-1.5">
                        <ItemIcon itemId={item.id} size={20} className="opacity-90" />
                        {item.name}
                        {hasWait && (
                          <span
                            className="text-xs text-yellow-400 font-normal ml-1"
                            title={
                              waitTurns > 0
                                ? `Can be queued now, but won't start for ~${waitTurns} turns (resources/prerequisites need more time to be ready)`
                                : `Can be queued, but needs production first (e.g. queue scientists for research)`
                            }
                          >
                            {waitTurns > 0 ? `⏳~${waitTurns}t` : '⏳'}
                          </span>
                        )}
                      </div>

                      {/* Duration — appears top-right on mobile, after spacer on desktop */}
                      <div className="text-pink-nebula-muted whitespace-nowrap text-right md:order-last md:w-8 md:flex-none">
                        {item.durationTurns}T
                      </div>

                      {/* Quantity controls for batchable items — single row */}
                      {isBatchable && (
                        <div className="flex flex-col items-end gap-0.5 md:order-last flex-none">
                          <div className="flex items-center gap-1 flex-nowrap">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={getQty(item.id)}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              onKeyDown={(e) => handleQuantityKeyDown(e, item.id, activeTab)}
                              onClick={(e) => {
                                e.stopPropagation();
                                (e.target as HTMLInputElement).select();
                              }}
                              onFocus={(e) => (e.target as HTMLInputElement).select()}
                              disabled={!queueable}
                              className={`
                                w-12 px-1 py-0.5 bg-pink-nebula-bg border rounded
                                text-pink-nebula-text text-xs text-center font-mono
                                focus:outline-hidden focus:border-pink-nebula-accent-primary
                                ${itemErrors[item.id] ? 'border-red-500' : 'border-pink-nebula-border'}
                                ${!queueable ? 'opacity-50 cursor-not-allowed' : ''}
                              `}
                              placeholder="qty"
                            />
                            {showSteppers && (<>
                            <button
                              onClick={(e) => { e.stopPropagation(); incrementQty(item.id, 1); }}
                              disabled={!queueable}
                              aria-label="Increase quantity by 1"
                              className={`px-1.5 py-1 rounded text-xs font-semibold ${
                                queueable
                                  ? 'bg-slate-700 hover:bg-slate-600 text-pink-nebula-text cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              +
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); incrementQty(item.id, 10); }}
                              disabled={!queueable}
                              aria-label="Increase quantity by 10"
                              className={`px-1.5 py-1 rounded text-xs font-semibold ${
                                queueable
                                  ? 'bg-slate-700 hover:bg-slate-600 text-pink-nebula-text cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              ++
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); incrementQty(item.id, 100); }}
                              disabled={!queueable}
                              aria-label="Increase quantity by 100"
                              className={`px-1.5 py-1 rounded text-xs font-semibold ${
                                queueable
                                  ? 'bg-slate-700 hover:bg-slate-600 text-pink-nebula-text cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              +++
                            </button>
                            </>)}
                            <button
                              onClick={(e) => { e.stopPropagation(); tryQueue(item.id, activeTab); }}
                              disabled={!queueable}
                              aria-label={`Queue ${item.name}`}
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                queueable
                                  ? 'bg-pink-nebula-accent-primary/80 hover:bg-pink-nebula-accent-primary text-white cursor-pointer'
                                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              add
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Route through the validated max-quantity helper
                                // instead of a blind 99999 so the same clamping
                                // and error surfacing applies as everywhere else.
                                const max = getMaxQueueableQuantity(item.id, canQueueItem);
                                if (max > 0) onQueueItem(item.id, max);
                              }}
                              disabled={!queueable}
                              title={queueable ? 'Queue maximum available' : humanizeReason(queueCheck.reason, item.id)}
                              aria-label={`Queue maximum ${item.name}`}
                              className={`px-1.5 py-1 rounded text-xs font-bold ${
                                queueable
                                  ? 'bg-slate-700 hover:bg-slate-600 text-yellow-300 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              ∞
                            </button>
                          </div>
                          {itemErrors[item.id] && (
                            <span className="text-red-400 text-xs leading-tight max-w-[160px] text-right">
                              {itemErrors[item.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom row on mobile: cost columns (wraps freely); inline on desktop */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:contents">
                      {/* Costs in fixed-width columns (just numbers, color-coded) */}
                      {costColumns.map((resource) => {
                        const amount = costsMap[resource] || 0;
                        if (amount === 0) {
                          // Hide on mobile, keep transparent on desktop for column alignment
                          return (
                            <div
                              key={resource}
                              className="hidden md:block w-16 text-right text-transparent"
                              title={resource}
                            >
                              -
                            </div>
                          );
                        }
                        return (
                          <div
                            key={resource}
                            className={`md:w-16 text-right whitespace-nowrap ${getResourceColor(resource)}`}
                            title={resource}
                          >
                            {formatNumber(amount)}
                          </div>
                        );
                      })}

                      {/* Energy Upkeep (consumption per turn after completion) */}
                      {energyUpkeep > 0 ? (
                        <div className="md:w-12 text-right text-blue-400 whitespace-nowrap" title="Energy consumption per turn">
                          -{formatNumber(energyUpkeep)}⚡
                        </div>
                      ) : (
                        <div className="hidden md:block w-12 text-right text-transparent" title="Energy consumption per turn">
                          -
                        </div>
                      )}

                      {/* Spacer (desktop only) */}
                      <div className="hidden md:block flex-1" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

export const TabbedItemGrid = React.memo(TabbedItemGridInner);

function laneTabClass(isActive: boolean): string {
  const base = 'inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold outline-hidden transition-colors duration-200 sm:text-base';
  if (isActive) {
    return `${base} border-cyan-200/65 bg-linear-to-r from-cyan-400/30 via-sky-400/22 to-blue-500/18 text-cyan-50 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-100/15`;
  }
  return `${base} border-white/10 bg-white/5.5 text-pink-nebula-muted hover:border-cyan-300/40 hover:bg-cyan-300/8 hover:text-pink-nebula-text`;
}

function laneIconClass(isActive: boolean): string {
  return `grid h-7 w-7 shrink-0 place-items-center rounded-xl border text-sm ${
    isActive
      ? 'border-cyan-100/25 bg-cyan-50/12 text-white shadow-[0_0_14px_rgba(34,211,238,0.24)]'
      : 'border-white/10 bg-white/5 opacity-80'
  }`;
}
