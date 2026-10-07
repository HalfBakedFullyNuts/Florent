"use client";

import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { ExtendedPlanetState } from '../lib/game/gameState';

interface PlanetTabsProps {
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  onPlanetSwitch: (planetId: string) => void;
  onAddPlanet: () => void;
  onEditPlanet?: (planetId: string) => void;
  maxPlanets: number;
}

const HOMEWORLD_ID = 'planet-1';

/**
 * PlanetTabs - one tab per planet plus "Add planet". Clicking the active colony tab
 * opens its settings (the homeworld has none).
 */
function PlanetTabsInner({
  planets,
  currentPlanetId,
  onPlanetSwitch,
  onAddPlanet,
  onEditPlanet,
  maxPlanets,
}: PlanetTabsProps) {
  const planetArray = Array.from(planets.values());

  const handlePlanetClick = (planet: ExtendedPlanetState) => {
    if (planet.id === currentPlanetId && planet.id !== HOMEWORLD_ID && onEditPlanet) {
      onEditPlanet(planet.id);
      return;
    }
    onPlanetSwitch(planet.id);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" suppressHydrationWarning>
      <div className="seg max-w-full overflow-x-auto" role="group" aria-label="Planets">
        {planetArray.map((planet, index) => {
          const isActive = planet.id === currentPlanetId;
          const planetLabel = `P${index + 1}`;
          const isEditable = isActive && planet.id !== HOMEWORLD_ID;
          const action = isEditable ? `Edit ${planetLabel}` : `Switch to ${planetLabel}`;
          return (
            <button
              type="button"
              key={planet.id}
              aria-label={action}
              aria-pressed={isActive}
              {...(isActive ? { 'aria-current': 'true' as const } : {})}
              onClick={() => handlePlanetClick(planet)}
              title={planet.id === HOMEWORLD_ID ? `${planetLabel} · ${planet.name}` : `${planetLabel} · ${planet.name} · starts T${planet.startTurn}`}
              className="seg-item"
              suppressHydrationWarning
            >
              <span className={`font-bold ${isActive ? 'text-halpha-soft' : ''}`}>{planetLabel}</span>
              <span className="max-w-36 truncate font-medium">{planet.name}</span>
              {isEditable && <Pencil aria-hidden="true" className="h-3.5! w-3.5! text-ink-3" />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddPlanet}
        className="btn btn-ghost border border-dashed border-filament"
      >
        <Plus aria-hidden="true" />
        Add planet
        <span className="text-xs font-semibold text-ink-3">{planets.size}/{maxPlanets}</span>
      </button>
    </div>
  );
}

export const PlanetTabs = React.memo(PlanetTabsInner);
