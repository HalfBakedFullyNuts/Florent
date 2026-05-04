"use client";

import React, { useState, useCallback } from 'react';
import type { ItemDefinition, LaneId } from '../../lib/sim/engine/types';
import { Card } from '@/components/ui/card';
import { GlassQueueButton } from '@/components/ui/glass-queue-button';
import { LANE_CONFIG, ALL_LANES } from '../../lib/constants/lanes';

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
  onTabChange?: (tab: LaneId) => void;
  currentTurn?: number;
}

/**
 * TabbedItemGrid - Tabbed interface for queue items
 * Shows only the active tab's items
 */
export function TabbedItemGrid({
  availableItems,
  onQueueItem,
  onQueueWait,
  canQueueItem,
  activeTab: externalActiveTab,
  onTabChange,
  currentTurn = 1,
}: TabbedItemGridProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<LaneId>('building');
  const [waitTurnsInput, setWaitTurnsInput] = useState<string>('5');

  // Use external tab state if provided, otherwise use internal
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  // Group items by lane
  const itemsByLane: Record<string, any[]> = {
    building: [],
    ship: [],
    colonist: [],
    research: [],
  };

  Object.values(availableItems).forEach((item: any) => {
    // Filter out outpost and worker - they cannot be built manually
    if (item.id === 'outpost' || item.id === 'worker') {
      return;
    }
    if (item.lane && itemsByLane[item.lane]) {
      itemsByLane[item.lane].push(item);
    }
  });

  /**
   * Calculate the prerequisite chain depth for a research item.
   * Items with no prerequisites have depth 0; each link in the chain adds 1.
   * Capped at 20 to avoid infinite loops in case of circular data.
   */
  const getPrereqDepth = (itemId: string, visited = new Set<string>()): number => {
    if (visited.has(itemId)) return 0; // Cycle guard
    visited.add(itemId);
    const item = availableItems[itemId];
    if (!item?.prerequisites || item.prerequisites.length === 0) return 0;
    const MAX_DEPTH = 20;
    let maxParentDepth = 0;
    for (const prereqId of item.prerequisites) {
      if (visited.size < MAX_DEPTH) {
        maxParentDepth = Math.max(maxParentDepth, getPrereqDepth(prereqId, new Set(visited)));
      }
    }
    return maxParentDepth + 1;
  };

  // Sort items: available first (including those with wait), hard-blocked last.
  // For research specifically, use prerequisite chain depth as secondary sort so the
  // full tech tree always reads top-to-bottom regardless of lock state.
  Object.keys(itemsByLane).forEach(laneId => {
    itemsByLane[laneId].sort((a, b) => {
      const aCheck = canQueueItem(a.id, 1);
      const bCheck = canQueueItem(b.id, 1);
      // Use canQueueEventually (false = hard block, grey out). Fallback to allowed for compatibility.
      const aQueueable = aCheck.canQueueEventually ?? aCheck.allowed;
      const bQueueable = bCheck.canQueueEventually ?? bCheck.allowed;

      if (aQueueable !== bQueueable) {
        return bQueueable ? 1 : -1;
      }

      // For the research lane, sort within each group by prerequisite chain depth
      // so the tech tree always shows in natural tier order.
      if (laneId === 'research') {
        const aDepth = getPrereqDepth(a.id);
        const bDepth = getPrereqDepth(b.id);
        if (aDepth !== bDepth) return aDepth - bDepth;
      }

      if (a.durationTurns !== b.durationTurns) {
        return a.durationTurns - b.durationTurns;
      }

      return a.name.localeCompare(b.name);
    });
  });

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
    const check = canQueueItem(itemId, 1);
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

  // Track quantities for each batchable item (raw string so empty is allowed)
  const [itemQuantities, setItemQuantities] = useState<Record<string, string>>({});
  // Per-item inline error message
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const getQty = useCallback((itemId: string): string => itemQuantities[itemId] ?? '1', [itemQuantities]);

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
    setItemQuantities(prev => ({ ...prev, [itemId]: '1' }));
    setItemErrors(prev => ({ ...prev, [itemId]: '' }));
  }, [getQty, humanizeReason, canQueueItem, onQueueItem]);

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
      setItemQuantities(prev => ({ ...prev, [itemId]: '1' }));
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
              className={`
                inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold outline-none transition-colors duration-200 sm:text-base
                ${isActive
                  ? 'border-pink-nebula-accent-secondary/55 bg-gradient-to-r from-pink-nebula-accent-primary/95 to-pink-nebula-accent-secondary/80 text-white shadow-lg shadow-pink-nebula-accent-primary/20'
                  : 'border-white/10 bg-white/[0.06] text-pink-nebula-muted hover:border-pink-nebula-accent-primary/45 hover:bg-white/[0.11] hover:text-pink-nebula-text'
                }
              `}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${laneDotClass(laneId)} ${isActive ? 'shadow-[0_0_12px_rgba(255,255,255,0.45)]' : ''}`} />
              <span className="truncate">{tabConfig.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <Card className="scroll-nebula h-[60vh] overflow-y-auto p-3 pr-4 md:h-[600px] md:p-4 md:pr-5">
        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
          <span className={`h-3 w-3 rounded-full ${laneDotClass(activeTab)} shadow-[0_0_14px_rgba(255,64,129,0.28)]`} />
          <h3 className="text-lg font-bold text-pink-nebula-text">
            {config.title}
          </h3>
          <span className="ml-auto rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-pink-nebula-muted">
            {items.length} items
          </span>
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
                  type="number"
                  min="1"
                  max="100"
                  className="h-10 w-16 rounded-xl border border-pink-nebula-border/80 bg-slate-950/70 px-2 text-center text-pink-nebula-text outline-none transition-colors focus:border-pink-nebula-accent-secondary focus:ring-2 focus:ring-pink-nebula-accent-primary/25"
                  value={waitTurnsInput}
                  onChange={(e) => setWaitTurnsInput(e.target.value)}
                />
                <span className="mr-1 text-sm text-pink-nebula-muted">turns</span>
                <button
                  onClick={handleQueueWait}
                  className="h-10 rounded-xl border border-pink-nebula-accent-primary/35 bg-pink-nebula-accent-primary/15 px-4 text-sm font-bold text-pink-100 transition-colors hover:border-pink-nebula-accent-secondary/55 hover:bg-pink-nebula-accent-primary/25 focus:outline-none focus:ring-2 focus:ring-pink-nebula-accent-primary/35"
                >
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
              const queueCheck = canQueueItem(item.id, 1);
              const queueable = isItemQueueable(item.id);
              const waitTurns = queueCheck.waitTurnsNeeded ?? 0;
              // hasWait covers: known wait (waitTurns > 0) OR resource soft-block (no production yet)
              const hasResourceBlocker = queueable && (queueCheck.blockers?.some((b: any) => b.type === 'RESOURCES') ?? false);
              const hasWait = (waitTurns > 0 || hasResourceBlocker) && queueable;
              const costsMap = item.costsPerUnit || {};
              const energyUpkeep = item.upkeepPerUnit?.energy || 0;
              const isBatchable = activeTab === 'ship' || activeTab === 'colonist';

              return (
                <div
                  key={item.id}
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
                      {/* Item Name */}
                      <div className="text-pink-nebula-text font-semibold flex-1 min-w-0 truncate md:flex-none md:w-40 md:whitespace-nowrap flex items-center gap-1">
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

                      {/* Quantity input + Button for batchable items — top-right on mobile, end of row on desktop */}
                      {isBatchable && (
                        <div className="flex flex-col items-end gap-0.5 md:order-last">
                          <div className="flex items-center gap-1">
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
                                w-14 px-2 py-1 bg-pink-nebula-bg border rounded
                                text-pink-nebula-text text-sm text-center font-mono
                                focus:outline-none focus:border-pink-nebula-accent-primary
                                ${itemErrors[item.id] ? 'border-red-500' : 'border-pink-nebula-border'}
                                ${!queueable ? 'opacity-50 cursor-not-allowed' : ''}
                              `}
                              placeholder="qty"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                tryQueue(item.id, activeTab);
                              }}
                              disabled={!queueable}
                              className={`
                                min-w-[32px] px-2 py-1 rounded text-base font-semibold
                                ${queueable
                                  ? 'bg-pink-nebula-accent-primary/80 hover:bg-pink-nebula-accent-primary text-white cursor-pointer'
                                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }
                              `}
                            >
                              +
                            </button>
                          </div>
                          {itemErrors[item.id] && (
                            <span className="text-red-400 text-xs leading-tight max-w-[120px] text-right">
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

function laneDotClass(laneId: LaneId): string {
  switch (laneId) {
    case 'building':
      return 'bg-amber-300';
    case 'ship':
      return 'bg-blue-300';
    case 'colonist':
      return 'bg-emerald-300';
    case 'research':
      return 'bg-violet-300';
    default:
      return 'bg-pink-nebula-accent-secondary';
  }
}
