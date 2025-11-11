"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { GameController } from '../lib/game/commands';
import { getPlanetSummary, getLaneView, getWarnings, canQueueItem as validateQueueItem, getTurnsUntilHousingCap } from '../lib/game/selectors';
import { validateAllQueueItems, type QueueValidationResult, getValidationMessage } from '../lib/game/validation';
import { createStandardStart } from '../lib/sim/defs/seed';
import { loadGameData } from '../lib/sim/defs/adapter.client';
import gameDataRaw from '../lib/game/game_data.json';

// UI Components
import { VerticalTurnSlider } from '../components/VerticalTurnSlider';
import { PlanetDashboard } from '../components/PlanetDashboard';
import { TabbedLaneDisplay } from '../components/QueueDisplay/TabbedLaneDisplay';
import { TabbedItemGrid } from '../components/LaneBoard/TabbedItemGrid';
import { WarningsPanel } from '../components/WarningsPanel';
import { ExportModal } from '../components/ExportModal';
import { Card } from '@/components/ui/card';

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
  const [queueValidation, setQueueValidation] = useState<Map<string, QueueValidationResult>>(new Map());
  const [showExportModal, setShowExportModal] = useState<'current' | 'full' | null>(null);

  // Get current state from controller - re-fetch when viewTurn OR stateVersion changes
  const currentState = controller.getStateAtTurn(viewTurn);
  const totalTurns = controller.getTotalTurns();

  const defs = currentState?.defs || {};

  // Helper: Enrich lane entries with validation state
  const enrichEntriesWithValidation = useCallback((entries: any[]) => {
    return entries.map(entry => {
      const validation = queueValidation.get(entry.id);
      if (!validation) {
        return entry; // No validation data, return as-is
      }

      return {
        ...entry,
        invalid: !validation.valid,
        invalidReason: validation.reason ? getValidationMessage(validation) : undefined,
        missingPrereqs: validation.missingPrereqs
      };
    });
  }, [queueValidation]);

  // Use selectors for UI data - re-compute when state or version changes
  // These hooks must be called unconditionally (Rules of Hooks)
  const summary = useMemo(() => currentState ? getPlanetSummary(currentState) : null, [currentState, stateVersion]);
  const buildingLane = useMemo(() => currentState ? getLaneView(currentState, 'building') : null, [currentState, stateVersion]);
  const shipLane = useMemo(() => currentState ? getLaneView(currentState, 'ship') : null, [currentState, stateVersion]);
  const colonistLane = useMemo(() => currentState ? getLaneView(currentState, 'colonist') : null, [currentState, stateVersion]);
  const researchLane = useMemo(() => currentState ? getLaneView(currentState, 'research') : null, [currentState, stateVersion]);
  const warnings = useMemo(() => currentState ? getWarnings(currentState) : [], [currentState, stateVersion]);

  // Enrich lanes with validation state
  const enrichedBuildingLane = useMemo(() =>
    buildingLane ? { ...buildingLane, entries: enrichEntriesWithValidation(buildingLane.entries) } : null,
    [buildingLane, enrichEntriesWithValidation]
  );
  const enrichedShipLane = useMemo(() =>
    shipLane ? { ...shipLane, entries: enrichEntriesWithValidation(shipLane.entries) } : null,
    [shipLane, enrichEntriesWithValidation]
  );
  const enrichedColonistLane = useMemo(() =>
    colonistLane ? { ...colonistLane, entries: enrichEntriesWithValidation(colonistLane.entries) } : null,
    [colonistLane, enrichEntriesWithValidation]
  );
  const enrichedResearchLane = useMemo(() =>
    researchLane ? { ...researchLane, entries: enrichEntriesWithValidation(researchLane.entries) } : null,
    [researchLane, enrichEntriesWithValidation]
  );

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
  if (!currentState || !summary || !enrichedBuildingLane || !enrichedShipLane || !enrichedColonistLane || !enrichedResearchLane) {
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
      // Queue item at current view turn (timeline always has 200 turns)
      const result = controller.queueItem(viewTurn, itemId, quantity);
      if (!result.success) {
        setError(result.reason || 'Cannot queue item');
        return;
      }

      setStateVersion(prev => prev + 1);

      // AUTO-ADVANCE: For buildings, move to completion turn
      const def = defs[itemId];
      if (def && def.lane === 'building') {
        const state = controller.getStateAtTurn(viewTurn);
        if (state) {
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

          const completionTurn = Math.min(viewTurn + totalDuration, 199); // Cap at turn 199
          setViewTurn(completionTurn);
        }
      }
      // Ships/colonists stay at viewTurn (no auto-advance)
    } catch (e) {
      console.error('Error in handleQueueItem:', e);
      setError((e as Error).message || 'Unknown error');
    }
  };

  const handleCancelItem = (laneId: 'building' | 'ship' | 'colonist', entry: any) => {
    setError(null);
    try {
      // Cancel the item (timeline always has 200 turns, no need to extend)
      const cancelTurn = entry.queuedTurn || viewTurn;
      const result = controller.cancelEntryByIdSmart(cancelTurn, laneId, entry.id);

      if (!result.success) {
        if (result.reason === 'NOT_FOUND') {
          setError('Item cannot be canceled (may be completed)');
        } else {
          setError(result.reason || 'Cannot cancel item');
        }
        return;
      }

      // Validate all remaining queue items after removal
      const updatedState = controller.getStateAtTurn(viewTurn);
      if (updatedState) {
        // Helper to get lane entries for validation
        const getLaneEntries = (state: any, laneId: 'building' | 'ship' | 'colonist') => {
          return getLaneView(state, laneId).entries;
        };

        const validationResults = validateAllQueueItems(updatedState, getLaneEntries);

        // Convert validation results to Map for efficient lookup
        const validationMap = new Map<string, QueueValidationResult>();
        for (const result of validationResults) {
          validationMap.set(result.entryId, result);
        }

        setQueueValidation(validationMap);
      }

      // Force state update to re-render UI
      setStateVersion(prev => prev + 1);

      // viewTurn is always valid (1-200), no adjustment needed
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

  const handleReorder = (laneId: 'building' | 'ship' | 'colonist', entryId: string, newIndex: number) => {
    setError(null);
    try {
      const result = controller.reorderQueueItem(viewTurn, laneId, entryId, newIndex);

      if (!result.success) {
        setError(`Cannot reorder: ${result.reason || 'unknown error'}`);
        return;
      }

      // Force re-render to show updated queue order
      setStateVersion(prev => prev + 1);
    } catch (e) {
      console.error('Error reordering item:', e);
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
      {/* Vertical Turn Slider - TICKET-9 */}
      <VerticalTurnSlider
        currentTurn={viewTurn}
        totalTurns={totalTurns}
        onTurnChange={setViewTurn}
      />

      {/* Main Content Container - Adjusted for vertical slider */}
      <div className="flex flex-col flex-1 mr-24">
        {/* Header */}
        <header className="bg-pink-nebula-panel px-6 py-4 border-b border-pink-nebula-border">
          <h1 className="text-2xl font-bold tracking-wide">Infinite Conflict Simulator</h1>
        </header>

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
        <PlanetDashboard
          summary={summary}
          defs={defs}
          turnsToHousingCap={currentState ? getTurnsUntilHousingCap(currentState, viewTurn) : null}
        />

        {/* Main Content - Side-by-side Tabbed Displays */}
        <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-6">
        <div className="flex gap-6">
          {/* Left: Add to Queue (Item Selection) */}
          <Card className="flex-1 p-6">
            <h2 className="text-2xl font-bold text-pink-nebula-text mb-6">Add to Queue</h2>
            <TabbedItemGrid
              availableItems={availableItems}
              onQueueItem={handleQueueItem}
              canQueueItem={canQueueItem}
            />
          </Card>

          {/* Right: Planet Queue (Lane Display) */}
          <Card className="flex-1 p-6" data-export-target="planet-queue">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-pink-nebula-text">Planet Queue</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExportModal('current')}
                  className="px-4 py-2 bg-pink-nebula-accent-primary text-pink-nebula-bg font-semibold rounded-lg hover:bg-pink-nebula-accent-secondary transition-colors"
                >
                  Export Current View
                </button>
                <button
                  onClick={() => setShowExportModal('full')}
                  className="px-4 py-2 bg-pink-nebula-accent-primary text-pink-nebula-bg font-semibold rounded-lg hover:bg-pink-nebula-accent-secondary transition-colors"
                >
                  Export Full List
                </button>
              </div>
            </div>
            <TabbedLaneDisplay
              buildingLane={enrichedBuildingLane}
              shipLane={enrichedShipLane}
              colonistLane={enrichedColonistLane}
              researchLane={enrichedResearchLane}
              currentTurn={viewTurn}
              onCancel={(laneId, entry) => handleCancelItem(laneId, entry)}
              onQuantityChange={(laneId, entry, newQty) => handleQuantityChange(laneId, entry, newQty)}
              getMaxQuantity={(laneId, entry) => getMaxQuantity(laneId, entry)}
              onReorder={(laneId, entryId, newIndex) => handleReorder(laneId, entryId, newIndex)}
              disabled={false}
              defs={defs}
            />
          </Card>
        </div>
        </main>

        {/* Footer */}
        <footer className="bg-pink-nebula-panel px-6 py-3 border-t border-pink-nebula-border text-center text-sm text-pink-nebula-muted">
          Turn-based strategy game simulator | Phases 0-5 In Progress | 239/239 tests passing
        </footer>
      </div>

      {/* Export Modal - TICKET-5 */}
      {showExportModal !== null && (
        <ExportModal
          isOpen={true}
          onClose={() => setShowExportModal(null)}
          buildingLane={enrichedBuildingLane || { laneId: 'building' as const, entries: [] }}
          shipLane={enrichedShipLane || { laneId: 'ship' as const, entries: [] }}
          colonistLane={enrichedColonistLane || { laneId: 'colonist' as const, entries: [] }}
          currentTurn={viewTurn}
          exportMode={showExportModal}
        />
      )}
    </div>
  );
}
