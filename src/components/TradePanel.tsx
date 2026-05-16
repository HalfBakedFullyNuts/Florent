"use client";

import React, { useState } from 'react';
import type { GameState, CreateTradeRouteParams } from '../lib/game/gameState';
import { TradeRouteCard } from './TradeRouteCard';
import { TradeRouteForm } from './TradeRouteForm';
import { getTradeRouteStatus } from '../lib/game/tradeRoutes';

interface TradePanelProps {
  gameState: GameState;
  viewTurn: number;
  isOpen: boolean;
  onToggle: () => void;
  onCreateRoute: (params: CreateTradeRouteParams) => void;
  onCancelRoute: (routeId: string) => void;
  onTurnClick?: (turn: number) => void;
}

export function TradePanel({
  gameState,
  viewTurn,
  isOpen,
  onToggle,
  onCreateRoute,
  onCancelRoute,
  onTurnClick,
}: TradePanelProps) {
  const [showForm, setShowForm] = useState(false);

  const planets = Array.from(gameState.planets.values());
  const currentPlanetId = gameState.currentPlanetId;

  // Show routes involving current planet (source or destination)
  const relevantRoutes = gameState.tradeRoutes.filter(
    r => r.sourcePlanetId === currentPlanetId || r.destinationPlanetId === currentPlanetId
  );

  const activeRoutes = relevantRoutes.filter(r => !r.cancelled);
  const cancelledRoutes = relevantRoutes.filter(r => r.cancelled);

  const getPlanetName = (id: string): string => {
    const arr = Array.from(gameState.planets.values());
    const idx = arr.findIndex(p => p.id === id);
    const planet = arr[idx];
    return planet ? `P${idx + 1} ${planet.name}` : id;
  };

  const hasMultiplePlanets = planets.length >= 2;

  const handleCreate = (params: CreateTradeRouteParams) => {
    onCreateRoute(params);
    setShowForm(false);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-pink-nebula-panel/80 via-slate-950/45 to-pink-nebula-panel/70 shadow-xl shadow-black/20 backdrop-blur-xl">
      {/* Header row — always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold text-pink-nebula-text hover:text-pink-nebula-accent-primary transition-colors"
        aria-expanded={isOpen}
      >
        <span>📦</span>
        <span>Trade Routes</span>
        {activeRoutes.length > 0 && (
          <span className="rounded-full bg-pink-nebula-accent-primary/20 border border-pink-nebula-accent-primary/40 px-2 py-0.5 text-xs text-pink-nebula-accent-primary">
            {activeRoutes.length}
          </span>
        )}
        <span className="ml-auto text-pink-nebula-muted text-xs">{isOpen ? '▲' : '▼'}</span>
      </div>

      {/* Collapsible body */}
      {isOpen && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          {!hasMultiplePlanets && (
            <div className="text-xs text-pink-nebula-muted italic">
              Trade routes require at least 2 planets. Add a second planet to get started.
            </div>
          )}

          {hasMultiplePlanets && (
            <>
              {/* Active routes */}
              {activeRoutes.length > 0 && (
                <div className="space-y-2">
                  {activeRoutes.map(route => (
                    <TradeRouteCard
                      key={route.id}
                      route={route}
                      viewTurn={viewTurn}
                      sourceName={getPlanetName(route.sourcePlanetId)}
                      destName={getPlanetName(route.destinationPlanetId)}
                      onCancel={onCancelRoute}
                      onTurnClick={onTurnClick}
                    />
                  ))}
                </div>
              )}

              {activeRoutes.length === 0 && !showForm && (
                <div className="text-xs text-pink-nebula-muted italic">
                  No trade routes for this planet yet.
                </div>
              )}

              {/* Create form or button */}
              {showForm ? (
                <TradeRouteForm
                  gameState={gameState}
                  viewTurn={viewTurn}
                  defaultSourcePlanetId={currentPlanetId}
                  onSubmit={handleCreate}
                  onCancel={() => setShowForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="rounded border border-dashed border-pink-nebula-accent-primary/45 bg-pink-nebula-accent-primary/10 px-4 py-1.5 text-xs text-pink-nebula-text hover:border-pink-nebula-accent-secondary hover:bg-pink-nebula-accent-primary/20 transition-all"
                >
                  + New Route
                </button>
              )}

              {/* Cancelled routes (collapsed) */}
              {cancelledRoutes.length > 0 && (
                <details className="text-xs text-pink-nebula-muted">
                  <summary className="cursor-pointer hover:text-pink-nebula-text">
                    {cancelledRoutes.length} cancelled route{cancelledRoutes.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="mt-2 space-y-2">
                    {cancelledRoutes.map(route => (
                      <TradeRouteCard
                        key={route.id}
                        route={route}
                        viewTurn={viewTurn}
                        sourceName={getPlanetName(route.sourcePlanetId)}
                        destName={getPlanetName(route.destinationPlanetId)}
                        onTurnClick={onTurnClick}
                      />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
