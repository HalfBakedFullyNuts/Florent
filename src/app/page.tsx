"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GameController, queueResearch } from '../lib/game/commands';
import { createInitialGameState, addPlanet, switchPlanet, getCurrentPlanet, type GameState, type ExtendedPlanetState } from '../lib/game/gameState';
import { getPlanetSummary, getLaneView, getWarnings, canQueueItem as validateQueueItem, getTurnsUntilHousingCap, getFirstEmptyTurns } from '../lib/game/selectors';
import { validateAllQueueItems, type QueueValidationResult, getValidationMessage, getDependentQueueItems } from '../lib/game/validation';
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
import { DependencyWarningModal } from '../components/DependencyWarningModal';

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

  const [commandHistory] = useState(() => new CommandHistory());
  const [urlStateLoaded, setUrlStateLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
  const [pendingCancellation, setPendingCancellation] = useState<{
    laneId: 'building' | 'ship' | 'colonist' | 'research';
    entry: any;
    brokenDependencies: any[];
  } | null>(null);

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

  // Memoize currentState to ensure React detects changes when viewTurn changes
  // Note: We pass viewTurn directly - controller.getStateAtTurn returns a cloned state
  const currentState = useMemo(() => {
    if (!controller) return undefined;
    return controller.getStateAtTurn(viewTurn);
  }, [controller, viewTurn, gameState]);
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

  // To display the global queue regardless of the turn slider, we pull the timeline's final state
  const fullPlanState = useMemo(() => {
    if (!controller) return undefined;
    // By re-evaluating when gameState changes, we ensure global queue updates
    // when queue mutations happen (since executeCancellation updates gameState).
    return controller.getStateAtTurn(199);
  }, [controller, viewTurn, gameState]); // DO NOT REMOVE gameState 

  // Helper to adjust the status of the global queue items relative to the current viewTurn
  const getAdjustedLaneView = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research') => {
    if (!fullPlanState) return null;
    const view = getLaneView(fullPlanState, laneId);

    view.entries = view.entries.map(entry => {
      let status = entry.status;
      const start = entry.startTurn ?? entry.queuedTurn ?? 0;
      const finish = entry.completionTurn ?? entry.eta ?? 999;

      if (finish <= viewTurn) {
        status = 'completed';
      } else if (start <= viewTurn && viewTurn < finish) {
        status = 'active';
      } else {
        status = 'pending';
      }
      return { ...entry, status };
    });

    return view;
  }, [fullPlanState, viewTurn]);

  const buildingLane = useMemo(() => getAdjustedLaneView('building'), [getAdjustedLaneView]);
  const shipLane = useMemo(() => getAdjustedLaneView('ship'), [getAdjustedLaneView]);
  const colonistLane = useMemo(() => getAdjustedLaneView('colonist'), [getAdjustedLaneView]);
  const researchLane = useMemo(() => getAdjustedLaneView('research'), [getAdjustedLaneView]);

  const warnings = useMemo(() => currentState ? getWarnings(currentState) : [], [currentState]);

  // Calculate first empty turn for each lane (for timeline quick jump buttons)
  // Always search from turn 1, not from viewTurn, so the button shows a consistent target
  const firstEmptyTurns = useMemo(() => {
    if (!controller) return { building: null, ship: null, colonist: null };
    const getState = (turn: number) => controller.getStateAtTurn(turn);
    return getFirstEmptyTurns(getState, 1, totalTurns);
  }, [controller, totalTurns, gameState]);

  // Enrich all lanes with validation state in a single useMemo
  const enrichedLanes = useMemo(() => ({
    building: buildingLane ? { ...buildingLane, entries: enrichEntriesWithValidation(buildingLane.entries) } : null,
    ship: shipLane ? { ...shipLane, entries: enrichEntriesWithValidation(shipLane.entries) } : null,
    colonist: colonistLane ? { ...colonistLane, entries: enrichEntriesWithValidation(colonistLane.entries) } : null,
    research: researchLane ? { ...researchLane, entries: enrichEntriesWithValidation(researchLane.entries) } : null,
  }), [buildingLane, shipLane, colonistLane, researchLane, enrichEntriesWithValidation]);

  // Destructure for backward compatibility
  const { building: enrichedBuildingLane, ship: enrichedShipLane, colonist: enrichedColonistLane, research: enrichedResearchLane } = enrichedLanes;

  // Live count of non-completed queue items across all lanes (used in header badge)
  const totalQueuedItems = useMemo(() => {
    const countNonCompleted = (lane: typeof enrichedBuildingLane) =>
      lane ? lane.entries.filter(e => e.status !== 'completed').length : 0;
    return (
      countNonCompleted(enrichedLanes.building) +
      countNonCompleted(enrichedLanes.ship) +
      countNonCompleted(enrichedLanes.colonist) +
      countNonCompleted(enrichedLanes.research)
    );
  }, [enrichedLanes]);

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

    // Use T1 state for validation so queueing is always possible regardless of the viewed turn
    const viewState = controller.getStateAtTurn(1);
    if (!viewState) {
      return { allowed: false, reason: 'Invalid turn' };
    }

    // Check if THIS SPECIFIC lane is available
    return validateQueueItem(viewState, itemId, quantity);
  }, [defs, controller]);

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

      // For other items, queue to current planet universally at Turn 1
      const result = controller.queueItem(1, itemId, quantity);
      if (!result.success) {
        setError(result.reason || 'Cannot queue item');
        return;
      }

      // Record command for URL encoding
      const planetIdx = getPlanetIndex(gameState, currentPlanetId);
      commandHistory.recordQueue(planetIdx, 1, itemId, quantity);

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });
      }

      // AUTO-ADVANCE: Move to the completion turn of the item we just added
      // Shows the turn immediately following the new structure's completion
      if (def && result.itemId) {
        const finalState = controller.getStateAtTurn(199);
        if (finalState) {
          const laneView = getLaneView(finalState, def.lane);
          const newlyAdded = laneView.entries.find(e => e.id === result.itemId);
          if (newlyAdded) {
            const endTurn = newlyAdded.completionTurn ?? newlyAdded.eta ?? viewTurn;
            setViewTurn(Math.min(endTurn + 1, 199));
          }
        }
      }
    } catch (e) {
      console.error('Error in handleQueueItem:', e);
      setError((e as Error).message || 'Unknown error');
    }
  }, [currentPlanet, currentPlanetId, controller, defs, viewTurn, gameState, commandHistory]);

  const handleQueueWait = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', waitTurns: number) => {
    setError(null);
    if (!currentPlanet || !controller) {
      setError('No planet selected');
      return;
    }

    try {
      const result = controller.queueWaitItem(1, laneId, waitTurns, false);
      if (!result.success) {
        setError(result.reason || 'Cannot queue wait item');
        return;
      }

      // Record command for URL encoding (we'd need to extend URL encoder for wait items if we want it perfect, 
      // but for MVP we just queue it locally)
      // commandHistory.recordQueueWait(...)

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
      console.error('Error in handleQueueWait:', e);
      setError((e as Error).message || 'Unknown error');
    }
  }, [currentPlanet, controller, viewTurn, gameState]);

  // Core execution function to instantly cancel and auto-collapse queues
  const executeCancellation = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any) => {
    // Cancel the item from the plan (T1 state) — works regardless of timeline position
    const result = controller!.cancelPlannedItem(laneId, entry.id);

    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        setError('Item cannot be canceled (may be completed or non-existent)');
      } else {
        setError(result.reason || 'Cannot cancel item');
      }
      return;
    }

    // Record cancel in command history so URL sharing replays it correctly
    const planetIdx = Array.from(gameState.planets.keys()).indexOf(gameState.currentPlanetId);
    commandHistory.recordCancel(Math.max(0, planetIdx), laneId, entry.id);

    // Feature: Queue Auto-Collapse
    // After cancelling, we repack the queue forward to fill gaps.
    controller!.repackQueue(1, laneId);

    // Update the planet in game state
    const updatedPlanet = controller!.getStateAtTurn(viewTurn);
    if (updatedPlanet) {
      setGameState(prev => {
        const newPlanets = new Map(prev.planets);
        newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
        return { ...prev, planets: newPlanets };
      });

      // Validate all remaining queue items after removal
      const getLaneEntries = (state: any, lId: 'building' | 'ship' | 'colonist' | 'research') => {
        return getLaneView(state, lId).entries;
      };

      const validationResults = validateAllQueueItems(updatedPlanet, getLaneEntries);

      // Convert validation results to Map for efficient lookup
      const validationMap = new Map<string, QueueValidationResult>();
      for (const res of validationResults) {
        validationMap.set(res.entryId, res);
      }

      setQueueValidation(validationMap);
    }
  }, [controller, viewTurn, gameState, setGameState, commandHistory]);

  const confirmPendingCancellation = useCallback(() => {
    if (!pendingCancellation || !controller) return;

    // Cancel all broken dependencies (most recent future ones first is safest to avoid weird chronological cascading bugs, though GameController handles it robustly)
    const sortedBroken = [...pendingCancellation.brokenDependencies].sort((a, b) => (b.queuedTurn || 0) - (a.queuedTurn || 0));

    for (const dep of sortedBroken) {
      controller.cancelPlannedItem(dep.laneId as 'building' | 'ship' | 'colonist' | 'research', dep.id);
    }

    // Finally cancel the root element the user actually clicked
    executeCancellation(pendingCancellation.laneId, pendingCancellation.entry);

    // Close modal
    setPendingCancellation(null);
  }, [pendingCancellation, controller, viewTurn, executeCancellation]);

  const handleCancelItem = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any) => {
    setError(null);
    if (!controller) {
      setError('No planet selected');
      return;
    }

    try {
      // 1. Dependency Analysis for prerequisites
      // Need to validate the full timeline to catch future breakages
      const state = controller.getStateAtTurn(199);
      if (state) {
        const getLaneEntries = (s: any, lId: 'building' | 'ship' | 'colonist' | 'research') => getLaneView(s, lId).entries;
        const brokenDependencies = getDependentQueueItems(state, entry, laneId, getLaneEntries);

        // If there are broken things down the line, halt and show warning modal
        if (brokenDependencies.length > 0) {
          setPendingCancellation({
            laneId,
            entry,
            brokenDependencies
          });
          return; // Abort standard cancellation
        }
      }

      // 2. Standard Cancellation Execution
      executeCancellation(laneId, entry);

    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, viewTurn, executeCancellation]);

  const handleQuantityChange = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any, newQuantity: number) => {
    setError(null);
    if (!controller) {
      setError('No planet selected');
      return;
    }

    try {
      // Update quantity preserving position
      const updateResult = controller.updateItemQuantity(1, laneId, entry.id, newQuantity);

      if (!updateResult.success) {
        setError(`Failed to update quantity: ${updateResult.reason}`);
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
      const result = controller.reorderQueueItem(1, laneId, entryId, newIndex);

      if (!result.success) {
        setError(`Cannot reorder: ${result.reason || 'unknown error'}`);
        return;
      }

      // We should repack the queue following a reorder so items lock into their new places mathematically
      controller.repackQueue(1, laneId);

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
    const state = controller.getStateAtTurn(199);
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
            firstEmptyTurns={firstEmptyTurns}
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
                onQueueWait={handleQueueWait}
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
                  {/* Live Queue Item Count */}
                  {totalQueuedItems > 0 && (
                    <div className="text-sm text-pink-nebula-text-secondary">
                      <span className="font-mono">
                        {totalQueuedItems} queued | {isMounted ? window.location.href.length : 0} chars
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
                onTurnClick={setViewTurn}
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
