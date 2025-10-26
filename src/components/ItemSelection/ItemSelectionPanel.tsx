"use client";

import React, { useState, useMemo } from 'react';
import type { LaneId } from '../../lib/sim/engine/types';
import { TabHeader } from './TabHeader';
import { ItemCard } from './ItemCard';

export interface ItemSelectionPanelProps {
  availableItems: Record<string, any>; // ItemDefinitions
  currentState: any; // PlanetState for validation
  onQueueItem: (itemId: string, quantity: number) => void;
  canQueueItem: (itemId: string, quantity: number) => {
    allowed: boolean;
    reason?: string;
  };
}

interface CategorizedItem {
  id: string;
  def: any;
}

interface CategorizedItems {
  available: CategorizedItem[];
  insufficientResources: CategorizedItem[];
  locked: CategorizedItem[];
}

/**
 * ItemSelectionPanel - Main item browsing and selection interface
 *
 * Fixed width: 400px
 * Features:
 * - 3 tabs for item types (Structures, Ships, Colonists)
 * - Item categorization (available, insufficient resources, locked)
 * - Grid layout with responsive columns
 * - Click to queue
 * - Hover for details
 *
 * Ticket 25: Main item selection panel
 */
export function ItemSelectionPanel({
  availableItems,
  currentState,
  onQueueItem,
  canQueueItem,
}: ItemSelectionPanelProps) {
  const [activeTab, setActiveTab] = useState<LaneId>('building');

  // Categorize items by lane and availability
  const categorizeItems = (laneId: LaneId): CategorizedItems => {
    const result: CategorizedItems = {
      available: [],
      insufficientResources: [],
      locked: [],
    };

    Object.entries(availableItems).forEach(([id, def]) => {
      if (def.lane !== laneId) return;

      const validation = canQueueItem(id, 1);

      if (validation.allowed) {
        result.available.push({ id, def });
      } else if (validation.reason?.includes('resource') || validation.reason?.includes('RESOURCES')) {
        result.insufficientResources.push({ id, def });
      } else {
        result.locked.push({ id, def });
      }
    });

    return result;
  };

  const currentItems = useMemo(() => categorizeItems(activeTab), [activeTab, availableItems, currentState]);

  // Count items per tab
  const tabCounts = useMemo(() => ({
    building: Object.values(availableItems).filter((def: any) => def.lane === 'building').length,
    ship: Object.values(availableItems).filter((def: any) => def.lane === 'ship').length,
    colonist: Object.values(availableItems).filter((def: any) => def.lane === 'colonist').length,
  }), [availableItems]);

  // Determine grid columns based on lane type
  const getGridColumns = () => {
    if (activeTab === 'colonist') {
      return 'grid-cols-1'; // Single column for colonists
    }
    return 'grid-cols-2'; // Two columns for structures and ships
  };

  const allItems = [
    ...currentItems.available,
    ...currentItems.insufficientResources,
    ...currentItems.locked,
  ];

  return (
    <div className="w-full lg:w-[400px] bg-pink-nebula-panel rounded-lg border-2 border-pink-nebula-border flex flex-col overflow-hidden">
      {/* Tab Header */}
      <TabHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      />

      {/* Items Grid */}
      <div
        className="flex-1 overflow-y-auto p-4 max-h-[500px]"
        role="tabpanel"
        id={`${activeTab}-panel`}
      >
        {allItems.length === 0 ? (
          <div className="text-center text-pink-nebula-muted py-8 text-sm">
            No items available
          </div>
        ) : (
          <div className={`grid ${getGridColumns()} gap-3`}>
            {allItems.map(({ id, def }) => {
              const isAvailable = currentItems.available.some(item => item.id === id);
              const isInsufficient = currentItems.insufficientResources.some(item => item.id === id);
              const isLocked = currentItems.locked.some(item => item.id === id);

              return (
                <ItemCard
                  key={id}
                  itemId={id}
                  itemDef={def}
                  available={isAvailable}
                  insufficientResources={isInsufficient}
                  locked={isLocked}
                  onQueueItem={onQueueItem}
                  currentState={currentState}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-pink-nebula-border bg-pink-nebula-bg">
        <div className="text-xs text-pink-nebula-muted text-center">
          Click item to queue • Hover for details
        </div>
      </div>
    </div>
  );
}
