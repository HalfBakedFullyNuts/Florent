"use client";

import React, { useState, useMemo } from 'react';
import { GameController } from '../lib/game/commands';
import { getPlanetSummary, getLaneView, getWarnings } from '../lib/game/selectors';
import { createStandardStart } from '../lib/sim/defs/seed';
import { loadGameData } from '../lib/sim/defs/adapter.client';
import gameDataRaw from '../lib/game/game_data.json';

// UI Components
import { TurnSlider } from '../components/TurnSlider';
import { PlanetDashboard } from '../components/PlanetDashboard';
import { CompactLane } from '../components/QueueDisplay/CompactLane';
import { LaneBoard } from '../components/LaneBoard/LaneBoard';
import { WarningsPanel } from '../components/WarningsPanel';

/**
 * Main game page - Integrated UI with new engine
 *
 * Uses GameController for state management and commands,
 * Selectors for read-only views, and new parametric UI components.
 *
 * Phase 3: UI Migration - Tickets 13-19
 */
export default function Home() {
  // Initialize game engine on first render
  const [controller] = useState(() => {
    const defs = loadGameData(gameDataRaw as any);
    const initialState = createStandardStart(defs);
    return new GameController(initialState);
  });

  const [viewTurn, setViewTurn] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Get current state from controller
  const currentState = controller.getStateAtTurn(viewTurn);
  const totalTurns = controller.getTotalTurns();

  // Guard against undefined state
  if (!currentState) {
    return <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text p-6">
      <h1 className="text-2xl font-bold">Error: Invalid turn {viewTurn}</h1>
    </div>;
  }

  const defs = currentState.defs;

  // Use selectors for UI data
  const summary = useMemo(() => getPlanetSummary(currentState), [currentState]);
  const buildingLane = useMemo(() => getLaneView(currentState, 'building'), [currentState]);
  const shipLane = useMemo(() => getLaneView(currentState, 'ship'), [currentState]);
  const colonistLane = useMemo(() => getLaneView(currentState, 'colonist'), [currentState]);
  const warnings = useMemo(() => getWarnings(currentState), [currentState]);

  // Get available items for each lane
  const availableItems = useMemo(() => {
    const items: Record<string, any> = {};
    Object.entries(defs).forEach(([id, def]) => {
      items[id] = def;
    });
    return items;
  }, [defs]);

  // Command handlers
  const handleQueueItem = (itemId: string, quantity: number) => {
    setError(null);
    try {
      const currentTurn = controller.getCurrentTurn();
      const result = controller.queueItem(currentTurn, itemId, quantity);
      if (!result.success) {
        setError(result.reason || 'Cannot queue item');
      } else {
        // Move to latest turn after queueing
        setViewTurn(controller.getTotalTurns() - 1);
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  };

  const handleCancelItem = (laneId: 'building' | 'ship' | 'colonist') => {
    setError(null);
    try {
      const currentTurn = controller.getCurrentTurn();
      const result = controller.cancelEntry(currentTurn, laneId);
      if (!result.success) {
        setError(result.reason || 'Cannot cancel item');
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  };

  const handleAdvanceTurn = () => {
    setError(null);
    try {
      controller.nextTurn();
      // Move to the new latest turn
      setViewTurn(controller.getTotalTurns() - 1);
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  };

  const canQueueItem = (itemId: string, quantity: number) => {
    if (!itemId) {
      return { allowed: false, reason: 'No item selected' };
    }

    const def = defs[itemId];
    if (!def) {
      return { allowed: false, reason: 'Unknown item' };
    }

    // Check if viewing past turn
    if (viewTurn < totalTurns - 1) {
      return { allowed: false, reason: 'Cannot queue while viewing past turn' };
    }

    // Basic validation (full validation happens in command)
    return { allowed: true };
  };

  return (
    <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text font-sans flex flex-col">
      {/* Header */}
      <header className="bg-pink-nebula-panel px-6 py-4 border-b border-pink-nebula-border">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-wide">Infinite Conflict Simulator</h1>
          <button
            onClick={handleAdvanceTurn}
            disabled={viewTurn < totalTurns - 1}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              viewTurn < totalTurns - 1
                ? 'bg-pink-nebula-bg text-pink-nebula-muted cursor-not-allowed'
                : 'bg-pink-nebula-accent-primary text-pink-nebula-text hover:bg-pink-nebula-accent-secondary'
            }`}
          >
            Advance Turn
          </button>
        </div>
      </header>

      {/* Turn Slider */}
      <TurnSlider
        currentTurn={viewTurn}
        totalTurns={totalTurns}
        onTurnChange={setViewTurn}
      />

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 bg-red-900/20 border border-red-400 rounded p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Warnings Panel */}
      {warnings.length > 0 && (
        <div className="mx-6 mt-4">
          <WarningsPanel warnings={warnings} />
        </div>
      )}

      {/* Planet Dashboard - Horizontal Overview */}
      <PlanetDashboard summary={summary} />

      {/* Main Content - Four Columns: 3 Lanes + Selection Panel */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_280px_280px_1fr] gap-4">
          {/* Lane 1: Structures */}
          <CompactLane
            laneId="building"
            laneView={buildingLane}
            currentTurn={viewTurn}
            onCancel={(index) => handleCancelItem('building')}
            disabled={viewTurn < totalTurns - 1}
          />

          {/* Lane 2: Ships */}
          <CompactLane
            laneId="ship"
            laneView={shipLane}
            currentTurn={viewTurn}
            onCancel={(index) => handleCancelItem('ship')}
            disabled={viewTurn < totalTurns - 1}
          />

          {/* Lane 3: Colonists */}
          <CompactLane
            laneId="colonist"
            laneView={colonistLane}
            currentTurn={viewTurn}
            onCancel={(index) => handleCancelItem('colonist')}
            disabled={viewTurn < totalTurns - 1}
          />

          {/* Column 4: Item Selection Panel (Temporary - will be replaced in Ticket 25) */}
          <div className="space-y-4 lg:col-span-1">
            <LaneBoard
              laneId="building"
              laneView={buildingLane}
              availableItems={availableItems}
              currentTurn={viewTurn}
              onQueueItem={handleQueueItem}
              onCancelItem={() => handleCancelItem('building')}
              canQueueItem={canQueueItem}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-pink-nebula-panel px-6 py-3 border-t border-pink-nebula-border text-center text-sm text-pink-nebula-muted">
        Turn-based strategy game simulator | Phases 0-5 In Progress | 239/239 tests passing
      </footer>
    </div>
  );
}
