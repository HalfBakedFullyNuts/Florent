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

  const getPlanetIcon = (index: number) => {
    const icons = ['Earth', 'Mars', 'Moon', 'Planet'];
    return icons[index % icons.length];
  };

  const handlePlanetClick = (planet: ExtendedPlanetState) => {
    if (planet.id === currentPlanetId && planet.id !== 'planet-1' && onEditPlanet) {
      onEditPlanet(planet.id);
      return;
    }
    onPlanetSwitch(planet.id);
  };

  return (
    <div
      className="flex gap-2 mb-4 p-2 bg-pink-nebula-panel/50 rounded-lg border border-pink-nebula-border items-center"
      suppressHydrationWarning
    >
      {planetArray.map((planet, index) => {
        const isActive = planet.id === currentPlanetId;
        return (
          <div
            role="button"
            tabIndex={0}
            key={planet.id}
            onClick={() => handlePlanetClick(planet)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handlePlanetClick(planet);
              }
            }}
            suppressHydrationWarning
            title={isActive && planet.id !== 'planet-1' ? 'Edit planet' : 'Switch planet'}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all duration-200
              flex items-center gap-2 cursor-pointer
              ${isActive
                ? 'bg-pink-nebula-accent-primary text-white shadow-lg scale-105'
                : 'bg-slate-700 text-pink-nebula-text hover:bg-slate-600 hover:scale-102'
              }
            `}
          >
            <span className="text-xs uppercase tracking-wide opacity-70">{getPlanetIcon(index)}</span>
            <span className="text-sm">{planet.name}</span>
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
          px-4 py-2 rounded-lg font-semibold transition-all duration-200
          bg-slate-700 text-pink-nebula-text hover:bg-slate-600
          border-2 border-dashed border-pink-nebula-border
          flex items-center gap-2 hover:scale-102 cursor-pointer
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
            ml-auto px-3 py-2 rounded-lg font-semibold transition-all duration-200
            bg-red-900/40 text-red-300 hover:bg-red-700 hover:text-white
            border border-red-700/50
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
