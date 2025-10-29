"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { GameController } from '../lib/game/commands';
import { getPlanetSummary, getLaneView, getWarnings, canQueueItem as validateQueueItem } from '../lib/game/selectors';
import { createStandardStart } from '../lib/sim/defs/seed';
import { loadGameData } from '../lib/sim/defs/adapter.client';
import gameDataRaw from '../lib/game/game_data.json';

// UI Components
import { TurnSlider } from '../components/TurnSlider';
import { PlanetDashboard } from '../components/PlanetDashboard';
import { TabbedLaneDisplay } from '../components/QueueDisplay/TabbedLaneDisplay';
import { TabbedItemGrid } from '../components/LaneBoard/TabbedItemGrid';
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

  const [viewTurn, setViewTurn] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [stateVersion, setStateVersion] = useState(0); // Force re-render when state changes

  // Get current state from controller - re-fetch when viewTurn OR stateVersion changes
  const currentState = controller.getStateAtTurn(viewTurn);
  const totalTurns = controller.getTotalTurns();

  const defs = currentState?.defs || {};

  // Use selectors for UI data - re-compute when state or version changes
  // These hooks must be called unconditionally (Rules of Hooks)
  const summary = useMemo(() => currentState ? getPlanetSummary(currentState) : null, [currentState, stateVersion]);
  const buildingLane = useMemo(() => currentState ? getLaneView(currentState, 'building') : null, [currentState, stateVersion]);
  const shipLane = useMemo(() => currentState ? getLaneView(currentState, 'ship') : null, [currentState, stateVersion]);
  const colonistLane = useMemo(() => currentState ? getLaneView(currentState, 'colonist') : null, [currentState, stateVersion]);
  const warnings = useMemo(() => currentState ? getWarnings(currentState) : [], [currentState, stateVersion]);

  // Get available items for each lane - must be before early return
  const availableItems = useMemo(() => {
    const items: Record<string, any> = {};
    Object.entries(defs).forEach(([id, def]) => {
      items[id] = def;
    });
    return items;
  }, [defs]);

  // canQueueItem callback - must be before early return
  const canQueueItem = useCallback((itemId: string, quantity: number) => {
    if (!itemId) {
      return { allowed: false, reason: 'No item selected' };
    }

    const def = defs[itemId];
    if (!def) {
      return { allowed: false, reason: 'Unknown item' };
    }

    // CRITICAL-1 FIX: Get state at viewed turn, not current turn
    // This allows queueing when the specific lane is idle at the viewed turn
    const viewState = controller.getStateAtTurn(viewTurn);
    if (!viewState) {
      return { allowed: false, reason: 'Invalid turn' };
    }

    // Check if THIS SPECIFIC lane is available at viewed turn
    return validateQueueItem(viewState, itemId, quantity);
  }, [defs, viewTurn, controller]);

  // Guard against undefined state AFTER all hooks are called
  if (!currentState || !summary || !buildingLane || !shipLane || !colonistLane) {
    return <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text p-6">
      <h1 className="text-2xl font-bold">Error: Invalid turn {viewTurn}</h1>
    </div>;
  }

  // Helper: Find next turn where all queues are empty
  const findNextEmptyQueueTurn = (startTurn: number): number => {
    const totalTurns = controller.getTotalTurns();
    const maxTurn = totalTurns - 1;
    const MAX_ITERATIONS = 1000; // Circuit breaker
    const startTime = performance.now();
    const TIMEOUT_MS = 100; // Performance budget

    // If we're already at or beyond the last turn, just stay at current turn
    if (startTurn > maxTurn) {
      return maxTurn;
    }

    let iterations = 0;
    for (let turn = startTurn; turn <= maxTurn && iterations < MAX_ITERATIONS; turn++) {
      iterations++;

      // Check timeout
      if (performance.now() - startTime > TIMEOUT_MS) {
        console.warn(`Turn calculation timeout after ${iterations} iterations`);
        return Math.min(startTurn, maxTurn); // Stay within bounds
      }

      const state = controller.getStateAtTurn(turn);
      if (!state) continue;

      // Check if all lanes are empty (no pending queue items, no active)
      const allLanesEmpty = Object.values(state.lanes).every(
        (lane) => lane.pendingQueue.length === 0 && !lane.active
      );

      if (allLanesEmpty) {
        return turn;
      }
    }

    // If no empty turn found, simulate more turns and try again
    if (totalTurns <= 100) { // Only auto-simulate if reasonable number of turns
      controller.simulateTurns(10); // Add 10 more turns
      return findNextEmptyQueueTurn(startTurn); // Recursive call with new turns
    }

    // Otherwise just advance a reasonable amount
    return Math.min(startTurn + 10, controller.getTotalTurns() - 1);
  };

  // Command handlers
  const handleQueueItem = (itemId: string, quantity: number) => {
    setError(null);
    try {
      // CRITICAL-1 FIX: Queue at viewTurn instead of currentTurn
      const result = controller.queueItem(viewTurn, itemId, quantity);
      if (!result.success) {
        setError(result.reason || 'Cannot queue item');
      } else {
        setStateVersion(prev => prev + 1);

        const def = defs[itemId];
        if (!def) return;

        // CRITICAL-2 FIX: Calculate when this item will complete and ensure turns exist
        const state = controller.getStateAtTurn(viewTurn);
        if (!state) return;

        const lane = state.lanes[def.lane];

        // Calculate total duration in this lane
        let totalDuration = 0;
        if (lane.active) {
          totalDuration += lane.active.turnsRemaining;
        }
        for (const pending of lane.pendingQueue) {
          const pendingDef = defs[pending.itemId];
          if (pendingDef) {
            totalDuration += pendingDef.durationTurns;
          }
        }

        const completionTurn = viewTurn + totalDuration;

        // Ensure we have enough turns simulated
        const totalTurns = controller.getTotalTurns();
        if (completionTurn >= totalTurns) {
          const turnsToSimulate = completionTurn - totalTurns + 1;
          controller.simulateTurns(turnsToSimulate);
          setStateVersion(prev => prev + 1);
        }

        // AUTO-ADVANCE: Only for buildings
        if (def.lane === 'building') {
          setViewTurn(completionTurn);
        }
        // Ships/colonists stay at viewTurn (no auto-advance)
      }
    } catch (e) {
      console.error('Error in handleQueueItem:', e);
      setError((e as Error).message || 'Unknown error');
    }
  };

  const handleCancelItem = (laneId: 'building' | 'ship' | 'colonist', entry: any) => {
    setError(null);
    try {
      // CRITICAL-3 FIX: Use smart cancellation that searches timeline
      // This handles ships/colonists where queuedTurn != actual location
      const cancelTurn = entry.queuedTurn || viewTurn;
      const result = controller.cancelEntryByIdSmart(cancelTurn, laneId, entry.id);

      if (!result.success) {
        if (result.reason === 'NOT_FOUND') {
          setError('Item cannot be canceled (may be completed)');
        } else {
          setError(result.reason || 'Cannot cancel item');
        }
      } else {
        // Force state update to re-render UI
        setStateVersion(prev => prev + 1);

        // Stay at current view for better UX
        // (don't jump around, user is viewing where they want to be)
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  };

  const handleQuantityChange = (laneId: 'building' | 'ship' | 'colonist', entry: any, newQuantity: number) => {
    setError(null);
    try {
      // Cancel existing entry
      const cancelTurn = entry.queuedTurn || viewTurn;
      const cancelResult = controller.cancelEntryByIdSmart(cancelTurn, laneId, entry.id);

      if (!cancelResult.success) {
        setError('Failed to update quantity');
        return;
      }

      // Re-queue with new quantity
      const queueResult = controller.queueItem(viewTurn, entry.itemId, newQuantity);

      if (!queueResult.success) {
        setError(`Cannot set quantity to ${newQuantity}: ${queueResult.reason || 'validation failed'}`);
        // Try to restore original quantity
        controller.queueItem(viewTurn, entry.itemId, entry.quantity);
      }

      // Force state update
      setStateVersion(prev => prev + 1);
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  };

  const getMaxQuantity = (laneId: 'building' | 'ship' | 'colonist', entry: any): number => {
    const state = controller.getStateAtTurn(viewTurn);
    if (!state) return entry.quantity;

    const def = state.defs[entry.itemId];
    if (!def) return entry.quantity;

    // Binary search for maximum quantity
    let low = 1;
    let high = 10000;
    let maxValid = entry.quantity;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const validation = canQueueItem(entry.itemId, mid);

      if (validation.allowed) {
        maxValid = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return maxValid;
  };

  const handleAdvanceTurn = () => {
    setError(null);
    try {
      controller.nextTurn();
      // Move to the new latest turn
      setViewTurn(controller.getTotalTurns() - 1);
      // Increment state version to force re-render
      setStateVersion(prev => prev + 1);
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text font-sans flex flex-col">
      {/* Header */}
      <header className="bg-pink-nebula-panel px-6 py-4 border-b border-pink-nebula-border">
        <h1 className="text-2xl font-bold tracking-wide">Infinite Conflict Simulator</h1>
      </header>

      {/* Turn Slider */}
      <TurnSlider
        currentTurn={viewTurn}
        totalTurns={totalTurns}
        onTurnChange={setViewTurn}
      />

      {/* Error Display */}
      {error && (
        <div className="mx-auto mt-4 w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl px-6 bg-red-900/20 border border-red-400 rounded p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Warnings Panel */}
      {warnings.length > 0 && (
        <div className="px-6 mt-4">
          <WarningsPanel warnings={warnings} />
        </div>
      )}

      {/* Planet Dashboard - Horizontal Overview */}
      <PlanetDashboard summary={summary} defs={defs} />

      {/* Main Content - Side-by-side Tabbed Displays */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-6">
        <div className="flex gap-6">
          {/* Left: Add to Queue (Item Selection) */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-pink-nebula-text mb-6">Add to Queue</h2>
            <TabbedItemGrid
              availableItems={availableItems}
              onQueueItem={handleQueueItem}
              canQueueItem={canQueueItem}
            />
          </div>

          {/* Right: Planet Queue (Lane Display) */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-pink-nebula-text mb-6">Planet Queue</h2>
            <TabbedLaneDisplay
              buildingLane={buildingLane}
              shipLane={shipLane}
              colonistLane={colonistLane}
              currentTurn={viewTurn}
              onCancel={(laneId, entry) => handleCancelItem(laneId, entry)}
              onQuantityChange={(laneId, entry, newQty) => handleQuantityChange(laneId, entry, newQty)}
              getMaxQuantity={(laneId, entry) => getMaxQuantity(laneId, entry)}
              disabled={viewTurn < totalTurns - 1}
              defs={defs}
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
