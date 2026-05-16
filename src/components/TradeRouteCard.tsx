"use client";

import React from 'react';
import type { TradeRoute, TradeRouteStatus } from '../lib/game/tradeRoutes';
import { getTradeRouteStatus } from '../lib/game/tradeRoutes';

interface TradeRouteCardProps {
  route: TradeRoute;
  viewTurn: number;
  sourceName: string;
  destName: string;
  onCancel?: (routeId: string) => void;
  onTurnClick?: (turn: number) => void;
}

const STATUS_STYLES: Record<TradeRouteStatus, string> = {
  scheduled:  'bg-blue-900/40 text-blue-300 border-blue-700/40',
  in_transit: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  delivered:  'bg-green-900/40 text-green-300 border-green-700/40',
  cancelled:  'bg-slate-900/40 text-slate-400 border-slate-700/40',
};

const STATUS_LABELS: Record<TradeRouteStatus, string> = {
  scheduled:  'Scheduled',
  in_transit: 'In Transit',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
};

const SHIP_LABELS: Record<string, string> = {
  freighter: '🚢 Freighter',
  merchant:  '🛳 Merchant',
  trader:    '⛵ Trader',
};

function formatCargo(cargo: TradeRoute['cargo']): string {
  const parts: string[] = [];
  if (cargo.metal > 0) parts.push(`${(cargo.metal / 1000).toFixed(0)}K metal`);
  if (cargo.mineral > 0) parts.push(`${(cargo.mineral / 1000).toFixed(0)}K mineral`);
  if (cargo.food > 0) parts.push(`${(cargo.food / 1000).toFixed(0)}K food`);
  if (cargo.energy > 0) parts.push(`${(cargo.energy / 1000).toFixed(0)}K energy`);
  return parts.join(', ') || 'empty';
}

export function TradeRouteCard({
  route,
  viewTurn,
  sourceName,
  destName,
  onCancel,
  onTurnClick,
}: TradeRouteCardProps) {
  const status = getTradeRouteStatus(route, viewTurn);
  const canCancel = status === 'scheduled' && onCancel != null;

  return (
    <div className={`rounded border px-3 py-2 text-xs font-mono transition-all ${
      status === 'cancelled' ? 'opacity-50' : 'bg-pink-nebula-panel/50'
    } border-pink-nebula-border`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {/* Route header: source → dest, ship type */}
          <div className="flex items-center gap-2 font-semibold text-pink-nebula-text">
            <span>{sourceName}</span>
            <span className="text-pink-nebula-muted">→</span>
            <span>{destName}</span>
            <span className="ml-1 text-pink-nebula-muted font-normal">{SHIP_LABELS[route.shipId] ?? route.shipId}</span>
          </div>
          {/* Cargo summary */}
          <div className="text-pink-nebula-muted">{formatCargo(route.cargo)}</div>
          {/* Turn range */}
          <div className="flex items-center gap-1 text-pink-nebula-muted">
            <button
              className="hover:text-pink-nebula-accent-primary hover:underline"
              onClick={() => onTurnClick?.(route.departureTurn)}
              title="Jump to departure turn"
            >
              T{route.departureTurn}
            </button>
            <span>→</span>
            <button
              className="hover:text-pink-nebula-accent-primary hover:underline"
              onClick={() => onTurnClick?.(route.arrivalTurn)}
              title="Jump to arrival turn"
            >
              T{route.arrivalTurn}
            </button>
          </div>
        </div>
        {/* Status badge + cancel */}
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          {canCancel && (
            <button
              onClick={() => onCancel(route.id)}
              className="rounded bg-red-900/30 px-2 py-0.5 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold"
              title="Cancel route (pre-departure only)"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
