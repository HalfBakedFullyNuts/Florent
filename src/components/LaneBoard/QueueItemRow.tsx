"use client";

import React from 'react';
import type { LaneEntry } from '../../lib/game/selectors';

export interface QueueItemRowProps {
  entry: LaneEntry;
  itemDef: any; // ItemDefinition
  currentTurn: number;
  onCancel: () => void;
}

/**
 * QueueItemRow - Display a single queue entry with status and ETA
 */
export function QueueItemRow({ entry, itemDef, currentTurn, onCancel }: QueueItemRowProps) {
  const getStatusColor = () => {
    switch (entry.status) {
      case 'active':
        return 'bg-green-900/20 border-green-400';
      case 'pending':
        return 'bg-yellow-900/20 border-yellow-400';
      case 'completed':
        return 'bg-blue-900/20 border-blue-400';
      default:
        return 'bg-pink-nebula-bg border-pink-nebula-border';
    }
  };

  const getStatusLabel = () => {
    switch (entry.status) {
      case 'active':
        return `Building... ${entry.turnsRemaining} turn(s) left`;
      case 'pending':
        return 'Pending activation';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown status';
    }
  };

  const getEtaLabel = () => {
    if (entry.status === 'pending') {
      return 'Awaiting activation';
    }
    if (entry.eta !== null) {
      return `ETA: Turn ${entry.eta}`;
    }
    return '';
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded border-2 ${getStatusColor()} transition-all`}>
      {/* Item Icon Placeholder */}
      <div className="w-12 h-12 bg-pink-nebula-bg rounded flex items-center justify-center text-pink-nebula-muted font-bold">
        {itemDef?.name?.charAt(0) || '?'}
      </div>

      {/* Item Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-pink-nebula-text font-semibold">{entry.itemName}</div>
          {entry.quantity > 1 && (
            <div className="px-2 py-0.5 bg-pink-nebula-accent-primary rounded text-xs font-bold">
              x{entry.quantity}
            </div>
          )}
        </div>
        <div className="text-sm text-pink-nebula-muted mt-1">{getStatusLabel()}</div>
        {getEtaLabel() && (
          <div className="text-xs text-pink-nebula-muted mt-1">{getEtaLabel()}</div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {entry.status !== 'completed' && (
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded bg-red-900/20 border border-red-400 text-red-400 hover:bg-red-900/40 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
