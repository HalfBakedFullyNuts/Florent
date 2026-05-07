"use client";

import React from 'react';
import type { ExtendedPlanetState } from '../lib/game/gameState';

interface PlanetTabsProps {
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  onPlanetSwitch: (planetId: string) => void;
  onAddPlanet: () => void;
  onEditPlanet?: (planetId: string) => void;
  maxPlanets: number;
  onResetQueue?: () => void;
}

/**
 * PlanetTabs - Tab navigation for multiple planets, with optional Reset Queue button on the far right.
 */
export function PlanetTabs({
  planets,
  currentPlanetId,
  onPlanetSwitch,
  onAddPlanet,
  onEditPlanet,
  maxPlanets,
  onResetQueue,
}: PlanetTabsProps) {
  const planetArray = Array.from(planets.values());

  const handlePlanetClick = (planet: ExtendedPlanetState) => {
    if (planet.id === currentPlanetId && planet.id !== 'planet-1' && onEditPlanet) {
      onEditPlanet(planet.id);
      return;
    }
    onPlanetSwitch(planet.id);
  };

  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-pink-nebula-panel/80 via-slate-950/45 to-pink-nebula-panel/70 p-2 shadow-xl shadow-black/20 backdrop-blur-xl sm:flex sm:flex-wrap sm:items-center"
      suppressHydrationWarning
    >
      {planetArray.map((planet, index) => {
        const isActive = planet.id === currentPlanetId;
        const planetLabel = `P${index + 1}`;
        return (
          <div
            role="button"
            tabIndex={0}
            key={planet.id}
            aria-label={isActive && planet.id !== 'planet-1' ? `Edit ${planetLabel}` : `Switch to ${planetLabel}`}
            onClick={() => handlePlanetClick(planet)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handlePlanetClick(planet);
              }
            }}
            suppressHydrationWarning
            title={isActive && planet.id !== 'planet-1' ? `Edit ${planetLabel}` : `Switch to ${planetLabel}`}
            className={`
              min-h-[48px] justify-center rounded-xl px-3 py-2 font-semibold transition-all duration-200 sm:min-h-0 sm:px-4
              flex items-center gap-2 cursor-pointer
              ${isActive
                ? 'bg-gradient-to-r from-pink-nebula-accent-primary to-pink-nebula-accent-secondary text-white shadow-lg shadow-pink-nebula-accent-primary/25 scale-[1.03]'
                : 'border border-white/10 bg-white/5 text-pink-nebula-text hover:border-pink-nebula-accent-primary/45 hover:bg-white/10'
              }
            `}
          >
            <span className="text-sm font-black uppercase tracking-wide">{planetLabel}</span>
            <span className="text-xs opacity-70" suppressHydrationWarning>T{planet.currentTurn}</span>
          </div>
        );
      })}

      <div
        role="button"
        tabIndex={0}
        onClick={onAddPlanet}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAddPlanet();
          }
        }}
        className="
          min-h-[48px] justify-center rounded-xl px-3 py-2 font-semibold transition-all duration-200 sm:min-h-0 sm:px-4
          border border-dashed border-pink-nebula-accent-primary/45 bg-pink-nebula-accent-primary/10
          text-pink-nebula-text hover:border-pink-nebula-accent-secondary hover:bg-pink-nebula-accent-primary/20
          flex items-center gap-2 cursor-pointer
        "
      >
        <span className="text-sm">+</span>
        <span className="text-sm">Add Planet</span>
        <span className="text-xs opacity-70">{planets.size}/{maxPlanets}</span>
      </div>

      {onResetQueue && (
        <div
          role="button"
          tabIndex={0}
          onClick={onResetQueue}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onResetQueue();
            }
          }}
          className="
            col-span-2 min-h-[44px] justify-center rounded-xl px-3 py-2 font-semibold transition-all duration-200 sm:col-span-1 sm:ml-auto sm:min-h-0
            bg-red-950/35 text-red-200 hover:bg-red-700/70 hover:text-white
            border border-red-400/25 hover:border-red-300/60
            flex items-center gap-2 cursor-pointer text-sm
          "
          title="Reset current planet queue to starting state"
        >
          <span>Reset Queue</span>
        </div>
      )}
    </div>
  );
}
