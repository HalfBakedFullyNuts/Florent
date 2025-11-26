"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GameController, queueResearch } from '../lib/game/commands';
import { createInitialGameState, addPlanet, switchPlanet, getCurrentPlanet, type GameState, type ExtendedPlanetState } from '../lib/game/gameState';
import { getPlanetSummary, getLaneView, getWarnings, canQueueItem as validateQueueItem, getTurnsUntilHousingCap } from '../lib/game/selectors';
import { validateAllQueueItems, type QueueValidationResult, getValidationMessage } from '../lib/game/validation';
import { loadGameData } from '../lib/sim/defs/adapter.client';
import gameDataRaw from '../lib/game/game_data.json';
import { setupLogging } from '../lib/game/logging-utils';
import { CommandHistory, loadStateFromURL, saveStateToURL, extractPlanetConfigs, getPlanetIndex, estimateEncodedSize } from '../lib/game/urlState';

// UI Components
import { HorizontalTimeline } from '../components/HorizontalTimeline';
import { PlanetDashboard } from '../components/PlanetDashboard';
import { TabbedLaneDisplay } from '../components/QueueDisplay/TabbedLaneDisplay';
import { TabbedItemGrid } from '../components/LaneBoard/TabbedItemGrid';
import { WarningsPanel } from '../components/WarningsPanel';
import { ExportModal } from '../components/ExportModal';
import { PlanetTabs } from '../components/PlanetTabs';
import { AddPlanetModal, type PlanetConfig } from '../components/AddPlanetModal';
import { Card } from '@/components/ui/card';

/**
 * Main game page - Multi-planet support
 *
 * Uses GameState for multi-planet management,
 * Selectors for read-only views, and new parametric UI components.
 */
export default function Home() {
  // Initialize logging utilities (disabled by default, enable via console with gameLogger.enable())
  useEffect(() => {
    setupLogging();
  }, []);

  // Command history for URL encoding
  const [commandHistory] = useState(() => new CommandHistory());
  const [urlStateLoaded, setUrlStateLoaded] = useState(false);

  // Initialize multi-planet game state (check URL first)
  const [gameState, setGameState] = useState<GameState>(() => {
    // Try loading from URL hash first
    const urlSnapshot = loadStateFromURL();

    if (urlSnapshot) {
      console.log('[URL State] Loading from URL:', {
        planets: urlSnapshot.planets.length,
        commands: urlSnapshot.cmds.length,
      });

      // For now, just start fresh and log what we would replay
      // Full replay implementation would reconstruct state here
      return createInitialGameState();
    }

    return createInitialGameState();
  });

  const [showAddPlanetModal, setShowAddPlanetModal] = useState(false);
  const [viewTurn, setViewTurn] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [queueValidation, setQueueValidation] = useState<Map<string, QueueValidationResult>>(new Map());
  const [showExportModal, setShowExportModal] = useState<'current' | 'full' | null>(null);
  const [activeTab, setActiveTab] = useState<'building' | 'ship' | 'colonist' | 'research'>('building');

  // Get current planet ID (only changes when switching planets, not on every mutation)
  const currentPlanetId = gameState.currentPlanetId;

  // Get current planet - memoize based on planet ID, not entire gameState
  const currentPlanet = useMemo(() => {
    return gameState.planets.get(currentPlanetId) || null;
  }, [gameState.planets, currentPlanetId]);

  // Initialize controller for the current planet (for timeline/turn management)
  // Use useMemo to avoid recreating controller unnecessarily
  const controller = useMemo(() => {
    if (!currentPlanet || !currentPlanet.timeline) {
      return null;
    }
    // IMPORTANT: Pass the existing timeline to avoid recomputing all turns
    return new GameController(currentPlanet, currentPlanet.timeline);
  }, [currentPlanetId]); // Only recreate when planet ID changes, not when planet state changes

  // Note: viewTurn is synced synchronously in handlePlanetSwitch/handleCreatePlanet
  // to avoid render timing issues with planets that have different start turns

  // Auto-save to URL on state changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const planetConfigs = extractPlanetConfigs(gameState);
        const commands = commandHistory.getCommands();

        // Only save if we have commands (don't save empty initial state)
        if (commands.length > 0) {
          saveStateToURL(planetConfigs, commands);

          // Log size information
          const sizeInfo = estimateEncodedSize(planetConfigs, commands);
          console.log('[URL State] Saved:', {
            planets: planetConfigs.length,
            commands: commands.length,
            urlLength: window.location.href.length,
            jsonSize: sizeInfo.json,
            compressedSize: sizeInfo.encoded,
          });
        }
      } catch (error) {
        console.error('[URL State] Failed to save:', error);
      }
    }, 1000); // Debounce: wait 1 second after last change

    return () => clearTimeout(timer);
  }, [gameState, commandHistory]);

  const currentState = controller?.getStateAtTurn(viewTurn);
  const totalTurns = controller?.getTotalTurns() || 200;

  const defs = currentState?.defs || loadGameData(gameDataRaw as any);

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

  // Use selectors for UI data - re-compute when state changes
  // These hooks must be called unconditionally (Rules of Hooks)
  const summary = useMemo(() => currentState ? getPlanetSummary(currentState) : null, [currentState]);
  const buildingLane = useMemo(() => currentState ? getLaneView(currentState, 'building') : null, [currentState]);
  const shipLane = useMemo(() => currentState ? getLaneView(currentState, 'ship') : null, [currentState]);
  const colonistLane = useMemo(() => currentState ? getLaneView(currentState, 'colonist') : null, [currentState]);
  const researchLane = useMemo(() => currentState ? getLaneView(currentState, 'research') : null, [currentState]);
  const warnings = useMemo(() => currentState ? getWarnings(currentState) : [], [currentState]);

  // Enrich all lanes with validation state in a single useMemo
  const enrichedLanes = useMemo(() => ({
    building: buildingLane ? { ...buildingLane, entries: enrichEntriesWithValidation(buildingLane.entries) } : null,
    ship: shipLane ? { ...shipLane, entries: enrichEntriesWithValidation(shipLane.entries) } : null,
    colonist: colonistLane ? { ...colonistLane, entries: enrichEntriesWithValidation(colonistLane.entries) } : null,
    research: researchLane ? { ...researchLane, entries: enrichEntriesWithValidation(researchLane.entries) } : null,
  }), [buildingLane, shipLane, colonistLane, researchLane, enrichEntriesWithValidation]);

  // Destructure for backward compatibility
  const { building: enrichedBuildingLane, ship: enrichedShipLane, colonist: enrichedColonistLane, research: enrichedResearchLane } = enrichedLanes;

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

    if (!controller) {
      return { allowed: false, reason: 'No controller available' };
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
    if (!controller) {
      return startTurn; // If no controller, just return current turn
    }

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

  // Planet management handlers
  const handlePlanetSwitch = useCallback((planetId: string) => {
    // Sync viewTurn BEFORE switching to avoid render timing issues
    const planet = gameState.planets.get(planetId);
    if (planet) {
      setViewTurn(planet.currentTurn);
    }
    setGameState(prev => switchPlanet(prev, planetId));
  }, [gameState.planets]);

  const handleAddPlanet = useCallback(() => {
    if (gameState.planets.size < gameState.maxPlanets) {
      setShowAddPlanetModal(true);
    }
  }, [gameState.planets.size, gameState.maxPlanets]);

  const handleCreatePlanet = useCallback((config: PlanetConfig) => {
    try {
      const newGameState = addPlanet(gameState, config);
      const newPlanetId = `planet-${newGameState.nextPlanetId - 1}`;
      // Sync viewTurn to new planet's start turn BEFORE switching
      // This prevents render timing issues with controller.getStateAtTurn()
      setViewTurn(config.startTurn);
      setGameState(switchPlanet(newGameState, newPlanetId));
    } catch (e) {
      setError((e as Error).message || 'Failed to create planet');
    }
  }, [gameState]);

  // Command handlers
  const handleQueueItem = useCallback((itemId: string, quantity: number) => {
    setError(null);
    if (!currentPlanet || !controller) {
      setError('No planet selected');
      return;
    }

    try {
      // For research, use global queue
      const def = defs[itemId];
      if (def && def.lane === 'research') {
        const newGameState = queueResearch(gameState, itemId);
        setGameState(newGameState);

        // Record command for URL encoding
        commandHistory.recordQueueResearch(itemId);

        return;
      }

      // For other items, queue to current planet at view turn
      const result = controller.queueItem(viewTurn, itemId, quantity);
      if (!result.success) {
        setError(result.reason || 'Cannot queue item');
        return;
      }

      // Record command for URL encoding
      const planetIdx = getPlanetIndex(gameState, currentPlanetId);
      commandHistory.recordQueue(planetIdx, viewTurn, itemId, quantity);

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });
      }

      // AUTO-ADVANCE: For buildings, move to completion turn
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
  }, [currentPlanet, controller, defs, viewTurn, gameState]);

  const handleCancelItem = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any) => {
    setError(null);
    if (!controller) {
      setError('No planet selected');
      return;
    }

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

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });

        // Validate all remaining queue items after removal
        const getLaneEntries = (state: any, laneId: 'building' | 'ship' | 'colonist' | 'research') => {
          return getLaneView(state, laneId).entries;
        };

        const validationResults = validateAllQueueItems(updatedPlanet, getLaneEntries);

        // Convert validation results to Map for efficient lookup
        const validationMap = new Map<string, QueueValidationResult>();
        for (const result of validationResults) {
          validationMap.set(result.entryId, result);
        }

        setQueueValidation(validationMap);
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, viewTurn, gameState]);

  const handleQuantityChange = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any, newQuantity: number) => {
    setError(null);
    if (!controller) {
      setError('No planet selected');
      return;
    }

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

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, viewTurn, gameState]);

  const handleReorder = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entryId: string, newIndex: number) => {
    setError(null);
    if (!controller) {
      setError('No planet selected');
      return;
    }

    try {
      const result = controller.reorderQueueItem(viewTurn, laneId, entryId, newIndex);

      if (!result.success) {
        setError(`Cannot reorder: ${result.reason || 'unknown error'}`);
        return;
      }

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      console.error('Error reordering item:', e);
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, viewTurn, gameState]);

  const getMaxQuantity = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any): number => {
    if (!controller) return entry.quantity;
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
  }, [controller, viewTurn, canQueueItem]);

  const handleAdvanceTurn = useCallback(() => {
    setError(null);
    if (!controller || !currentPlanet) {
      setError('No planet selected');
      return;
    }

    try {
      controller.nextTurn();
      // Move to the new latest turn
      setViewTurn(controller.getTotalTurns() - 1);

      // Update the planet in game state with new turn
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          const planetToUpdate = newPlanets.get(gameState.currentPlanetId);
          if (planetToUpdate) {
            planetToUpdate.currentTurn = controller.getTotalTurns() - 1;
          }
          newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, currentPlanet, viewTurn, gameState]);

  return (
    <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text font-sans flex flex-col relative">
      {/* Background Overlay */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: 'url(/BG_Nebula.png)',
          backgroundPosition: '33% center',
          opacity: 0.2
        }}
      />

      {/* Main Content Container */}
      <div className="flex flex-col flex-1 relative z-10">
        {/* Header */}
        <header className="bg-pink-nebula-panel px-6 py-4 border-b border-pink-nebula-border">
          <h1 className="text-2xl font-bold tracking-wide">Infinite Conflict Simulator</h1>
        </header>

        {/* Planet Tabs - Multi-planet navigation */}
        <div className="px-6 py-2">
          <PlanetTabs
            planets={gameState.planets}
            currentPlanetId={gameState.currentPlanetId}
            onPlanetSwitch={handlePlanetSwitch}
            onAddPlanet={handleAddPlanet}
            maxPlanets={gameState.maxPlanets}
          />
        </div>

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

        {/* Horizontal Timeline - Between dashboard and queues */}
        <div className="w-full max-w-[1800px] mx-auto px-6">
          <HorizontalTimeline
            currentTurn={viewTurn}
            totalTurns={totalTurns}
            onTurnChange={setViewTurn}
          />
        </div>

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
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </Card>

          {/* Right: Planet Queue (Lane Display) */}
          <Card className="flex-1 p-6" data-export-target="planet-queue">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-pink-nebula-text">Planet Queue</h2>
                {/* URL Size Indicator */}
                {commandHistory.getCommands().length > 0 && (
                  <div className="text-sm text-pink-nebula-text-secondary">
                    <span className="font-mono">
                      {commandHistory.getCommands().length} cmds | {typeof window !== 'undefined' ? window.location.href.length : 0} chars
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url).then(() => {
                      alert(`✅ Shareable link copied!\n\nURL: ${url.length} characters\nCommands: ${commandHistory.getCommands().length}\n\nPaste this link to reload your exact game state.`);
                    }).catch(() => {
                      alert(`Share this URL:\n\n${url}`);
                    });
                  }}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                  title="Copy shareable link with game state"
                >
                  <span>📋</span>
                  <span>Share Link</span>
                </button>
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
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </Card>
        </div>
        </main>
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

      {/* Add Planet Modal */}
      <AddPlanetModal
        isOpen={showAddPlanetModal}
        onClose={() => setShowAddPlanetModal(false)}
        onAddPlanet={handleCreatePlanet}
        currentTurn={currentPlanet?.currentTurn || 1}
      />
    </div>
  );
}
