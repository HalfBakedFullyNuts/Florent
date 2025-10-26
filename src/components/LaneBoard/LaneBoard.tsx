"use client";

import React, { useState } from 'react';
import type { LaneView, LaneEntry } from '../../lib/game/selectors';
import type { LaneId } from '../../lib/sim/engine/types';
import { QueueItemRow } from './QueueItemRow';
import { QueueToolbar } from './QueueToolbar';

export interface LaneBoardProps {
  laneId: LaneId;
  laneView: LaneView;
  availableItems: Record<string, any>; // ItemDefinitions
  currentTurn: number;
  onQueueItem: (itemId: string, quantity: number) => void;
  onCancelItem: () => void;
  canQueueItem: (itemId: string, quantity: number) => {
    allowed: boolean;
    reason?: string;
  };
}

/**
 * LaneBoard - Parametric lane component for structures, ships, and colonists
 *
 * Displays queue entries with status and ETA, allows queueing and cancellation.
 * Reused across all three lanes with lane-specific configuration.
 *
 * Tickets 15-17: UI component for lane management
 */
export function LaneBoard({
  laneId,
  laneView,
  availableItems,
  currentTurn,
  onQueueItem,
  onCancelItem,
  canQueueItem,
}: LaneBoardProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // Get items for this lane
  const laneItems = Object.values(availableItems).filter(
    (item: any) => item.lane === laneId
  );

  const handleQueue = () => {
    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }

    const validation = canQueueItem(selectedItemId, quantity);
    if (!validation.allowed) {
      setError(validation.reason || 'Cannot queue item');
      return;
    }

    onQueueItem(selectedItemId, quantity);
    setError(null);
    setQuantity(1);
  };

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

  const getLaneColor = () => {
    switch (laneId) {
      case 'building':
        return 'border-blue-400';
      case 'ship':
        return 'border-purple-400';
      case 'colonist':
        return 'border-green-400';
      default:
        return 'border-pink-nebula-border';
    }
  };

  const supportsBatching = laneId === 'ship' || laneId === 'colonist';

  return (
    <div className={`bg-pink-nebula-panel rounded-lg border-2 ${getLaneColor()} p-6 flex flex-col h-full`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-pink-nebula-text">{getLaneTitle()}</h2>
        <div className="text-sm text-pink-nebula-muted">
          {laneView.entries.length > 0
            ? `${laneView.entries.length} item(s) in queue`
            : 'Lane idle'}
        </div>
      </div>

      {/* Queue Toolbar */}
      <QueueToolbar
        laneItems={laneItems}
        selectedItemId={selectedItemId}
        quantity={quantity}
        supportsBatching={supportsBatching}
        error={error}
        onItemSelect={setSelectedItemId}
        onQuantityChange={setQuantity}
        onQueue={handleQueue}
      />

      {/* Queue Entries */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-2">
        {laneView.entries.length === 0 ? (
          <div className="text-center text-pink-nebula-muted py-8">
            No items in queue. Select an item above to queue.
          </div>
        ) : (
          laneView.entries.map((entry) => (
            <QueueItemRow
              key={entry.id}
              entry={entry}
              itemDef={availableItems[entry.itemId]}
              currentTurn={currentTurn}
              onCancel={onCancelItem}
            />
          ))
        )}
      </div>

      {/* Lane Info */}
      <div className="mt-4 pt-4 border-t border-pink-nebula-border">
        <div className="text-xs text-pink-nebula-muted">
          {laneId === 'building' && 'Structures produce resources and provide housing.'}
          {laneId === 'ship' && 'Ships can be built in batches. Final quantity determined at activation.'}
          {laneId === 'colonist' && 'Colonists reserve workers during training and require housing.'}
        </div>
      </div>
    </div>
  );
}
