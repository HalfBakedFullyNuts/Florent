"use client";

import React from 'react';
import type { ExtendedPlanetState } from '../lib/game/gameState';

interface PlanetTabsProps {
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  onPlanetSwitch: (planetId: string) => void;
  onAddPlanet: () => void;
  maxPlanets: number;
}

/**
 * PlanetTabs - Tab navigation for multiple planets
 */
export function PlanetTabs({
  planets,
  currentPlanetId,
  onPlanetSwitch,
  onAddPlanet,
  maxPlanets,
}: PlanetTabsProps) {
  const planetArray = Array.from(planets.values());
  const canAddPlanet = planets.size < maxPlanets;

  // Planet emoji icons
  const getPlanetIcon = (index: number) => {
    const icons = ['🌍', '🔴', '🌙', '🪐'];
    return icons[index % icons.length];
  };

  return (
    <div className="flex gap-2 mb-4 p-2 bg-pink-nebula-panel/50 rounded-lg border border-pink-nebula-border">
      {planetArray.map((planet, index) => {
        const isActive = planet.id === currentPlanetId;
        return (
          <button
            key={planet.id}
            onClick={() => onPlanetSwitch(planet.id)}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all duration-200
              flex items-center gap-2
              ${isActive
                ? 'bg-pink-nebula-accent-primary text-white shadow-lg scale-105'
                : 'bg-slate-700 text-pink-nebula-text hover:bg-slate-600 hover:scale-102'
              }
            `}
          >
            <span className="text-xl">{getPlanetIcon(index)}</span>
            <div className="flex flex-col items-start">
              <span className="text-sm">{planet.name}</span>
              <span className="text-xs opacity-70">Turn {planet.currentTurn}</span>
            </div>
          </button>
        );
      })}

      {canAddPlanet && (
        <button
          onClick={onAddPlanet}
          className="
            px-4 py-2 rounded-lg font-semibold transition-all duration-200
            bg-slate-700 text-pink-nebula-text hover:bg-slate-600
            border-2 border-dashed border-pink-nebula-border
            flex items-center gap-2 hover:scale-102
          "
        >
          <span className="text-xl">➕</span>
          <span className="text-sm">Add Planet</span>
        </button>
      )}

      {!canAddPlanet && (
        <div className="
          px-4 py-2 rounded-lg
          bg-slate-800 text-pink-nebula-muted
          border-2 border-dashed border-pink-nebula-border/30
          flex items-center gap-2 opacity-50
        ">
          <span className="text-sm">Max Planets ({maxPlanets}/{maxPlanets})</span>
        </div>
      )}
    </div>
  );
}