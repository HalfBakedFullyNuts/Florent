"use client";

import React, { useState, useMemo } from 'react';
import type { LaneId } from '../../lib/sim/engine/types';
import { TabHeader } from './TabHeader';
import { ItemCard } from './ItemCard';
import { WaitButton } from './WaitButton';
import { QueueConfirmationModal } from '../QueueConfirmationModal';
import { validateQueueWithWait, type QueueValidationResult } from '../../lib/sim/engine/queueValidation';

export interface ItemSelectionPanelProps {
  availableItems: Record<string, any>; // ItemDefinitions
  currentState: any; // PlanetState for validation
  onQueueItem: (itemId: string, quantity: number) => void;
  onQueueWait?: (laneId: LaneId, waitTurns: number) => void;
  canQueueItem: (itemId: string, quantity: number) => {
    allowed: boolean;
    reason?: string;
  };
}

interface CategorizedItem {
  id: string;
  def: any;
  validation?: QueueValidationResult;
}

interface CategorizedItems {
  available: CategorizedItem[];
  queueableWithWait: CategorizedItem[];
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
  onQueueWait,
  canQueueItem,
}: ItemSelectionPanelProps) {
  const [activeTab, setActiveTab] = useState<LaneId>('building');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    itemId: string;
    itemName: string;
    waitTurnsNeeded: number;
    validation: QueueValidationResult | null;
  }>({
    isOpen: false,
    itemId: '',
    itemName: '',
    waitTurnsNeeded: 0,
    validation: null,
  });

  // Categorize items by lane and availability using enhanced validation
  const categorizeItems = (laneId: LaneId): CategorizedItems => {
    const result: CategorizedItems = {
      available: [],
      queueableWithWait: [],
      locked: [],
    };

    Object.entries(availableItems).forEach(([id, def]) => {
      if (def.lane !== laneId) return;

      // Use enhanced validation
      const validation = validateQueueWithWait(currentState, def, 1);

      if (validation.canQueueNow) {
        result.available.push({ id, def, validation });
      } else if (validation.canQueueEventually && validation.waitTurnsNeeded > 0) {
        result.queueableWithWait.push({ id, def, validation });
      } else {
        result.locked.push({ id, def, validation });
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

  // Handle item queue with modal for auto-wait
  const handleQueueItem = (itemId: string, quantity: number) => {
    const item = currentItems.queueableWithWait.find(i => i.id === itemId);

    if (item && item.validation) {
      // Show modal for items that need auto-wait
      setModalState({
        isOpen: true,
        itemId,
        itemName: item.def.name,
        waitTurnsNeeded: item.validation.waitTurnsNeeded,
        validation: item.validation,
      });
    } else {
      // Queue directly for available items
      onQueueItem(itemId, quantity);
    }
  };

  // Handle modal confirmation
  const handleModalConfirm = () => {
    if (modalState.validation && onQueueWait) {
      // Queue wait item first
      onQueueWait(activeTab, modalState.waitTurnsNeeded);
      // Then queue the actual item
      onQueueItem(modalState.itemId, 1);
    }
    setModalState({ isOpen: false, itemId: '', itemName: '', waitTurnsNeeded: 0, validation: null });
  };

  // Handle modal cancel
  const handleModalCancel = () => {
    setModalState({ isOpen: false, itemId: '', itemName: '', waitTurnsNeeded: 0, validation: null });
  };

  const allItems = [
    ...currentItems.available,
    ...currentItems.queueableWithWait,
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
        {/* Wait Button - Only show for building, ship, and colonist lanes */}
        {onQueueWait && activeTab !== 'research' && (
          <div className="mb-4">
            <WaitButton
              laneId={activeTab}
              onQueueWait={(turns) => onQueueWait(activeTab, turns)}
            />
          </div>
        )}

        {allItems.length === 0 ? (
          <div className="text-center text-pink-nebula-muted py-8 text-sm">
            No items available
          </div>
        ) : (
          <div className={`grid ${getGridColumns()} gap-3`}>
            {allItems.map(({ id, def, validation }) => {
              const isAvailable = currentItems.available.some(item => item.id === id);
              const isLocked = currentItems.locked.some(item => item.id === id);
              const isQueueableWithWait = currentItems.queueableWithWait.some(item => item.id === id);
              const waitTurns = validation?.waitTurnsNeeded || 0;

              return (
                <ItemCard
                  key={id}
                  itemId={id}
                  itemDef={def}
                  available={isAvailable}
                  locked={isLocked}
                  queueableWithWait={isQueueableWithWait}
                  waitTurnsNeeded={waitTurns}
                  onQueueItem={handleQueueItem}
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
          Click item to queue • Hover for details • Blue items require wait
        </div>
      </div>

      {/* Auto-wait confirmation modal */}
      <QueueConfirmationModal
        isOpen={modalState.isOpen}
        itemName={modalState.itemName}
        waitTurnsNeeded={modalState.waitTurnsNeeded}
        blockers={modalState.validation?.blockers || []}
        requestedQuantity={1}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
