"use client";

import React from 'react';
import type { TradeCargo, CargoCapacity } from '../lib/game/tradeRoutes';

interface CargoEditorProps {
  cargo: TradeCargo;
  capacity: CargoCapacity;
  onChange: (cargo: TradeCargo) => void;
}

const RESOURCES: { key: keyof TradeCargo; label: string; color: string }[] = [
  { key: 'metal',   label: 'Metal',   color: 'text-slate-300' },
  { key: 'mineral', label: 'Mineral', color: 'text-purple-300' },
  { key: 'food',    label: 'Food',    color: 'text-green-300' },
  { key: 'energy',  label: 'Energy',  color: 'text-yellow-300' },
];

export function CargoEditor({ cargo, capacity, onChange }: CargoEditorProps) {
  const sharedUsed = cargo.food + cargo.energy;
  const sharedPct = Math.min(100, Math.round((sharedUsed / capacity.shared_pool) * 100));

  const handleChange = (key: keyof TradeCargo, raw: string) => {
    const val = Math.max(0, parseInt(raw) || 0);
    onChange({ ...cargo, [key]: val });
  };

  const getLimit = (key: keyof TradeCargo): number => {
    if (key === 'metal') return capacity.metal;
    if (key === 'mineral') return capacity.mineral;
    return capacity.shared_pool; // food / energy share this pool
  };

  return (
    <div className="space-y-2">
      {RESOURCES.map(({ key, label, color }) => {
        const limit = getLimit(key);
        const pct = Math.min(100, Math.round((cargo[key] / limit) * 100));
        const over = cargo[key] > limit;
        return (
          <div key={key} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`w-14 text-xs ${color}`}>{label}</span>
              <input
                type="number"
                min={0}
                max={limit}
                value={cargo[key] || ''}
                placeholder="0"
                onChange={(e) => handleChange(key, e.target.value)}
                className={`w-32 rounded border px-2 py-0.5 text-xs font-mono bg-pink-nebula-bg text-pink-nebula-text focus:outline-none focus:border-pink-nebula-accent-primary
                  ${over ? 'border-red-500' : 'border-pink-nebula-border'}`}
              />
              <span className="text-xs text-pink-nebula-muted">/ {limit.toLocaleString()}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded bg-pink-nebula-border/40">
              <div
                className={`h-full rounded transition-all ${over ? 'bg-red-500' : 'bg-pink-nebula-accent-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="text-xs text-pink-nebula-muted">
        Shared pool (food + energy):{' '}
        <span className={sharedUsed > capacity.shared_pool ? 'text-red-400' : 'text-pink-nebula-text'}>
          {sharedUsed.toLocaleString()} / {capacity.shared_pool.toLocaleString()}
        </span>
        <span className="ml-1">({sharedPct}%)</span>
      </div>
    </div>
  );
}
