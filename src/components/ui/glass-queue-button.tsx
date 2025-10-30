"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassQueueButtonProps {
  itemName: string;
  quantity?: number;
  costs?: Array<{ resource: string; amount: number }>;
  status?: 'active' | 'pending' | 'completed';
  disabled?: boolean;
  onClick?: () => void;
  turnsRemaining?: number;
  startTurn?: number;
  completionTurn?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * GlassQueueButton - Shared button component for queue items
 *
 * Part of Nebula Command design system with glass-morphism styling.
 * Used by both Add to Queue (TabbedItemGrid) and Planet Queue (QueueLaneEntry).
 *
 * Features:
 * - Glass-morphism with backdrop blur
 * - Resource-colored cost glows
 * - Status-based left border (active/pending/completed)
 * - Quantity prefix display
 * - Hover brightness + border color shift
 * - Disabled state with glow removal
 */
export function GlassQueueButton({
  itemName,
  quantity,
  costs = [],
  status,
  disabled = false,
  onClick,
  turnsRemaining,
  startTurn,
  completionTurn,
  className,
  children,
}: GlassQueueButtonProps) {

  const getResourceColorClass = (resource: string): string => {
    const resourceMap: Record<string, string> = {
      metal: 'text-gray-300',
      mineral: 'text-red-500',
      food: 'text-green-500',
      energy: 'text-blue-400',
      workers: 'text-orange-400',
      scientist: 'text-yellow-400',
      soldiers: 'text-red-300',
    };
    return resourceMap[resource.toLowerCase()] || 'text-pink-nebula-muted';
  };

  const getStatusBorderClass = (): string => {
    if (!status) return '';
    const statusMap: Record<string, string> = {
      active: 'border-l-active',
      pending: 'border-l-pending',
      completed: 'border-l-completed',
    };
    return statusMap[status] || '';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'glass-button w-full text-left p-3',
        getStatusBorderClass(),
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {/* Quantity prefix for batches */}
        {quantity && quantity > 1 && (
          <span className="font-semibold text-pink-400">
            {quantity}×
          </span>
        )}

        {/* Turn range display (Tx-Ty) */}
        {startTurn !== undefined && completionTurn !== undefined && (
          <span className="text-xs text-pink-nebula-muted font-normal">
            T{startTurn}-T{completionTurn}
          </span>
        )}

        {/* Item name */}
        <span className={cn(
          "font-semibold transition-colors",
          disabled ? "text-pink-nebula-muted" : "text-white group-hover:text-pink-400"
        )}>
          {itemName}
        </span>

        {/* Resource costs */}
        {costs.map(({ resource, amount }) => (
          <span
            key={resource}
            className={cn(
              "text-xs font-medium",
              disabled ? "opacity-50" : getResourceColorClass(resource)
            )}
          >
            {amount}
          </span>
        ))}

        {/* Turns remaining */}
        {turnsRemaining !== undefined && turnsRemaining > 0 && (
          <span className={cn(
            "text-xs",
            disabled ? "text-pink-nebula-muted/60" : "text-pink-nebula-muted"
          )}>
            ⏱️ {turnsRemaining}T
          </span>
        )}

        {/* Additional children (e.g., remove button, quantity input) */}
        {children}
      </div>
    </button>
  );
}
