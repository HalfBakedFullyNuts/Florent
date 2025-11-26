"use client";

import React, { useState } from 'react';

export interface ItemCardProps {
  itemId: string;
  itemDef: any; // ItemDefinition
  available: boolean;
  locked: boolean;
  queueableWithWait?: boolean; // Can be queued with auto-wait
  waitTurnsNeeded?: number; // How many wait turns needed
  onQueueItem: (itemId: string, quantity: number) => void;
  currentState?: any; // For tooltip details
}

/**
 * ItemCard - Display individual buildable item with status
 *
 * States:
 * - ✅ Available (green border, clickable immediately)
 * - ⏸️ Queueable with wait (blue border, clickable with auto-wait)
 * - 🔒 Locked (gray border, shows prerequisites)
 *
 * Ticket 25: Item selection card component
 */
export function ItemCard({
  itemId,
  itemDef,
  available,
  locked,
  queueableWithWait = false,
  waitTurnsNeeded = 0,
  onQueueItem,
  currentState,
}: ItemCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (available || queueableWithWait) {
      onQueueItem(itemId, 1);
    }
  };

  const getStatusIcon = () => {
    if (available) return '✅';
    if (queueableWithWait) return '⏸️';
    if (locked) return '🔒';
    return '';
  };

  const getCardClasses = () => {
    const base = 'relative p-3 rounded-lg border-2 cursor-pointer transition-all';

    if (available) {
      return `${base} border-green-500 hover:bg-green-500/10 hover:shadow-lg`;
    }
    if (queueableWithWait) {
      return `${base} border-blue-500 hover:bg-blue-500/10 hover:shadow-lg`;
    }
    if (locked) {
      return `${base} border-gray-500 opacity-50 cursor-not-allowed`;
    }
    return `${base} border-pink-nebula-border`;
  };

  const formatDuration = (turns: number) => {
    return turns === 1 ? '1 turn' : `${turns} turns`;
  };

  return (
    <div
      className={getCardClasses()}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      role="button"
      tabIndex={available ? 0 : -1}
      aria-label={`${available ? 'Queue' : 'View'} ${itemDef.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Status indicator */}
      <div className="absolute top-1 right-1 text-lg">
        {getStatusIcon()}
      </div>

      {/* Item icon placeholder */}
      <div className="w-12 h-12 bg-pink-nebula-bg rounded flex items-center justify-center text-pink-nebula-muted font-bold mb-2">
        {itemDef.name?.charAt(0) || '?'}
      </div>

      {/* Item name */}
      <div className="font-semibold text-sm text-pink-nebula-text mb-1">
        {itemDef.name}
      </div>

      {/* Quick stats */}
      <div className="text-xs text-pink-nebula-muted">
        {itemDef.tier && `T${itemDef.tier} • `}
        {formatDuration(itemDef.durationTurns || 0)}
      </div>

      {/* Wait indicator badge */}
      {queueableWithWait && waitTurnsNeeded > 0 && (
        <div className="absolute bottom-1 right-1 px-2 py-0.5 bg-blue-600 rounded text-[10px] font-bold text-white">
          +{waitTurnsNeeded}T
        </div>
      )}

      {/* Tooltip on hover */}
      {showTooltip && (
        <ItemTooltip
          itemDef={itemDef}
          available={available}
          locked={locked}
          queueableWithWait={queueableWithWait}
          waitTurnsNeeded={waitTurnsNeeded}
          currentState={currentState}
        />
      )}
    </div>
  );
}

/**
 * ItemTooltip - Detailed information popup on hover
 */
interface ItemTooltipProps {
  itemDef: any;
  available: boolean;
  locked: boolean;
  queueableWithWait?: boolean;
  waitTurnsNeeded?: number;
  currentState?: any;
}

function ItemTooltip({ itemDef, available, locked, queueableWithWait, waitTurnsNeeded, currentState }: ItemTooltipProps) {
  const getResourceColor = (resource: string): string => {
    switch (resource) {
      case 'metal': return 'text-gray-300'; // silver
      case 'mineral': return 'text-red-500'; // red
      case 'food': return 'text-green-500'; // green
      case 'energy': return 'text-blue-400'; // blue
      case 'research_points': return 'text-purple-400';
      case 'workers': return 'text-orange-400'; // orange
      case 'space': return 'text-amber-600'; // brown
      default: return 'text-pink-nebula-muted';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('de-DE');
  };

  return (
    <div className="absolute z-10 bg-gray-900 border border-pink-nebula-border p-3 rounded shadow-xl w-64 top-full mt-2 left-0">
      <h4 className="font-bold text-pink-nebula-text mb-2">{itemDef.name}</h4>

      {/* Duration */}
      <div className="text-xs text-pink-nebula-muted mb-2">
        Build time: {itemDef.durationTurns} turn{itemDef.durationTurns !== 1 ? 's' : ''}
      </div>

      {/* Costs */}
      {itemDef.costsPerUnit && (
        <div className="text-xs space-y-1 mb-2">
          <div className="font-semibold text-pink-nebula-text">Costs:</div>
          {Object.entries(itemDef.costsPerUnit.resources || {}).map(([resource, amount]: [string, any]) => {
            const sufficient = !currentState || (currentState.stocks?.[resource] || 0) >= amount;
            const baseColor = getResourceColor(resource);
            return (
              <div key={resource} className={sufficient ? baseColor : 'text-red-400'}>
                {resource}: {formatNumber(amount)} {!sufficient && `(Need ${formatNumber(amount - (currentState?.stocks?.[resource] || 0))})`}
              </div>
            );
          })}
        </div>
      )}

      {/* Status message */}
      {locked && (
        <div className="text-xs text-red-400 mt-2 pt-2 border-t border-pink-nebula-border">
          🔒 Missing prerequisites
        </div>
      )}
      {queueableWithWait && !available && (
        <div className="text-xs text-blue-400 mt-2 pt-2 border-t border-pink-nebula-border">
          ⏸️ Queueable with {waitTurnsNeeded} wait turn{waitTurnsNeeded !== 1 ? 's' : ''}
        </div>
      )}
      {available && (
        <div className="text-xs text-green-400 mt-2 pt-2 border-t border-pink-nebula-border">
          ✅ Ready to build
        </div>
      )}
    </div>
  );
}
