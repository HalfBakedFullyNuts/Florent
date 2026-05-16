"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { ExtendedPlanetState, GameState, CreateTradeRouteParams } from '../lib/game/gameState';
import { validateTradeRoute } from '../lib/game/gameState';
import type { TradeCargo } from '../lib/game/tradeRoutes';
import { TRADE_SHIP_IDS, computeArrivalTurn, TIMELINE_LENGTH } from '../lib/game/tradeRoutes';
import {
  EXPANSION_TRAVEL_CHOICES,
  type ExpansionTravelChoice,
  type FleetDriveLevel,
} from '../lib/constants/travel';
import { CargoEditor } from './CargoEditor';

interface TradeRouteFormProps {
  gameState: GameState;
  viewTurn: number;
  defaultSourcePlanetId: string;
  onSubmit: (params: CreateTradeRouteParams) => void;
  onCancel: () => void;
}

const SHIP_OPTIONS = [
  { id: 'freighter', label: 'Freighter', tier: 'T1 — 120K/80K/40K shared' },
  { id: 'merchant',  label: 'Merchant',  tier: 'T2 — 240K/160K/80K shared' },
  { id: 'trader',    label: 'Trader',    tier: 'T3 — 480K/320K/160K shared' },
];

const EMPTY_CARGO: TradeCargo = { metal: 0, mineral: 0, food: 0, energy: 0 };

const CARGO_CAPACITIES: Record<string, { metal: number; mineral: number; shared_pool: number }> = {
  freighter: { metal: 120_000, mineral: 80_000, shared_pool: 40_000 },
  merchant:  { metal: 240_000, mineral: 160_000, shared_pool: 80_000 },
  trader:    { metal: 480_000, mineral: 320_000, shared_pool: 160_000 },
};

export function TradeRouteForm({
  gameState,
  viewTurn,
  defaultSourcePlanetId,
  onSubmit,
  onCancel,
}: TradeRouteFormProps) {
  const planetIds = Array.from(gameState.planets.keys());
  const planetArray = Array.from(gameState.planets.values());

  const [shipId, setShipId] = useState<string>('freighter');
  const [sourcePlanetId, setSourcePlanetId] = useState(defaultSourcePlanetId);
  const [destPlanetId, setDestPlanetId] = useState(() =>
    planetIds.find(id => id !== defaultSourcePlanetId) ?? planetIds[0] ?? ''
  );
  const [departureTurn, setDepartureTurn] = useState(viewTurn);
  const [travelScope, setTravelScope] = useState<ExpansionTravelChoice>('inside_galaxy');
  const [driveLevel] = useState<FleetDriveLevel>(1);
  const [cargo, setCargo] = useState<TradeCargo>({ ...EMPTY_CARGO });

  const arrivalTurn = computeArrivalTurn(departureTurn, driveLevel, travelScope);
  const capacity = CARGO_CAPACITIES[shipId] ?? CARGO_CAPACITIES.freighter;

  const params: CreateTradeRouteParams = useMemo(() => ({
    shipId,
    sourcePlanetId,
    destinationPlanetId: destPlanetId,
    departureTurn,
    travelScope,
    driveLevel,
    cargo,
  }), [shipId, sourcePlanetId, destPlanetId, departureTurn, travelScope, driveLevel, cargo]);

  const validation = useMemo(() => validateTradeRoute(gameState, params), [gameState, params]);

  const getPlanetLabel = (id: string) => {
    const arr = Array.from(gameState.planets.values());
    const idx = arr.findIndex(p => p.id === id);
    const planet = arr[idx];
    return `P${idx + 1}${planet ? ` — ${planet.name}` : ''}`;
  };

  return (
    <form
      className="space-y-4 rounded border border-pink-nebula-border bg-pink-nebula-panel/60 p-4"
      onSubmit={(e) => { e.preventDefault(); if (validation.valid) onSubmit(params); }}
    >
      <div className="text-sm font-semibold text-pink-nebula-text">New Trade Route</div>

      {/* Ship type */}
      <div className="space-y-1">
        <label className="text-xs text-pink-nebula-muted">Ship</label>
        <div className="flex flex-wrap gap-2">
          {SHIP_OPTIONS.map(({ id, label, tier }) => (
            <button
              key={id}
              type="button"
              onClick={() => setShipId(id)}
              className={`rounded border px-3 py-1.5 text-xs transition-all ${
                shipId === id
                  ? 'border-pink-nebula-accent-primary bg-pink-nebula-accent-primary/20 text-pink-nebula-text font-semibold'
                  : 'border-pink-nebula-border bg-white/5 text-pink-nebula-muted hover:border-pink-nebula-accent-primary/50'
              }`}
            >
              <div>{label}</div>
              <div className="text-[10px] opacity-70">{tier}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Source → Destination */}
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-pink-nebula-muted">Source</label>
          <select
            value={sourcePlanetId}
            onChange={(e) => setSourcePlanetId(e.target.value)}
            className="w-full rounded border border-pink-nebula-border bg-pink-nebula-bg px-2 py-1 text-xs text-pink-nebula-text focus:outline-none focus:border-pink-nebula-accent-primary"
          >
            {planetIds.map(id => (
              <option key={id} value={id}>{getPlanetLabel(id)}</option>
            ))}
          </select>
        </div>
        <div className="mt-5 text-pink-nebula-muted">→</div>
        <div className="flex-1 space-y-1">
          <label className="text-xs text-pink-nebula-muted">Destination</label>
          <select
            value={destPlanetId}
            onChange={(e) => setDestPlanetId(e.target.value)}
            className="w-full rounded border border-pink-nebula-border bg-pink-nebula-bg px-2 py-1 text-xs text-pink-nebula-text focus:outline-none focus:border-pink-nebula-accent-primary"
          >
            {planetIds.map(id => (
              <option key={id} value={id}>{getPlanetLabel(id)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Departure turn + distance */}
      <div className="flex items-start gap-4">
        <div className="space-y-1">
          <label className="text-xs text-pink-nebula-muted">Departure Turn</label>
          <input
            type="number"
            min={1}
            max={TIMELINE_LENGTH}
            value={departureTurn}
            onChange={(e) => setDepartureTurn(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 rounded border border-pink-nebula-border bg-pink-nebula-bg px-2 py-1 text-xs font-mono text-pink-nebula-text focus:outline-none focus:border-pink-nebula-accent-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-pink-nebula-muted">Distance</label>
          <div className="flex gap-1">
            {(Object.keys(EXPANSION_TRAVEL_CHOICES) as ExpansionTravelChoice[]).map((choice) => {
              const { label } = EXPANSION_TRAVEL_CHOICES[choice];
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setTravelScope(choice)}
                  className={`rounded border px-2 py-1 text-xs transition-all ${
                    travelScope === choice
                      ? 'border-pink-nebula-accent-primary bg-pink-nebula-accent-primary/20 text-pink-nebula-text font-semibold'
                      : 'border-pink-nebula-border bg-white/5 text-pink-nebula-muted hover:border-pink-nebula-accent-primary/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1 self-end">
          <div className="text-xs text-pink-nebula-muted">Arrival</div>
          <div className={`text-xs font-mono font-semibold ${arrivalTurn > TIMELINE_LENGTH ? 'text-red-400' : 'text-pink-nebula-text'}`}>
            T{arrivalTurn}
          </div>
        </div>
      </div>

      {/* Cargo */}
      <div className="space-y-1">
        <label className="text-xs text-pink-nebula-muted">Cargo</label>
        <CargoEditor cargo={cargo} capacity={capacity} onChange={setCargo} />
      </div>

      {/* Validation errors */}
      {!validation.valid && validation.errors.length > 0 && (
        <div className="rounded border border-orange-700/40 bg-orange-900/20 px-3 py-2 text-xs text-orange-300 space-y-0.5">
          {validation.errors.map((err, i) => <div key={i}>⚠️ {err}</div>)}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!validation.valid}
          className="rounded bg-pink-nebula-accent-primary px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-pink-nebula-accent-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-pink-nebula-border px-4 py-1.5 text-xs text-pink-nebula-muted hover:text-pink-nebula-text transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
