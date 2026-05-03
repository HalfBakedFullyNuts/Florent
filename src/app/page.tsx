"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GameController } from '../lib/game/commands';
import { createInitialGameState, addPlanet, switchPlanet, getCurrentPlanet, type GameState, type ExtendedPlanetState } from '../lib/game/gameState';
import { getPlanetSummary, getLaneView, getWarnings, canQueueItem as validateQueueItem, getTurnsUntilHousingCap, getFirstEmptyTurns, getFirstFreeTurnForLane, getFirstFreeTurnForResearch } from '../lib/game/selectors';
import { validateAllQueueItems, type QueueValidationResult, getValidationMessage, getDependentQueueItems } from '../lib/game/validation';
import { loadGameData } from '../lib/sim/defs/adapter.client';
import type { LaneId } from '../lib/sim/engine/types';
import gameDataRaw from '../lib/game/game_data.json';
import { setupLogging } from '../lib/game/logging-utils';
import { CommandHistory, loadStateFromURL, saveStateToURL, extractPlanetConfigs, getPlanetIndex, estimateEncodedSize, loadStateFromLocalStorage, replayCommands } from '../lib/game/urlState';

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
import { SavesModal } from '../components/SavesModal';

// Persistence
import { encodeGameState } from '../lib/game/urlState';
import { pushHistory, migrateLegacyLocalStorage } from '../lib/persistence/savesDb';
import { buildSaveSummary } from '../lib/persistence/saveSummary';

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
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Load state from URL or LocalStorage after hydration
    let urlSnapshot = loadStateFromURL();

    if (urlSnapshot) {
      console.log('[URL State] Loading from URL:', {
        planets: urlSnapshot.planets.length,
        commands: urlSnapshot.cmds.length,
      });
    } else {
      urlSnapshot = loadStateFromLocalStorage();
      if (urlSnapshot) {
        console.log('[URL State] Loading from LocalStorage:', {
          planets: urlSnapshot.planets.length,
          commands: urlSnapshot.cmds.length,
        });
      }
    }

    if (urlSnapshot && urlSnapshot.cmds.length > 0) {
      // Reconstruct state by replaying commands
      const state = replayCommands(createInitialGameState(), urlSnapshot.cmds);

      // Restore command history (rebuilds seqId map so future cancels work)
      commandHistory.loadFromSnapshot(urlSnapshot.cmds);

      setGameState(state);
    }
  }, [commandHistory]);

  const [showAddPlanetModal, setShowAddPlanetModal] = useState(false);
  const [viewTurn, setViewTurn] = useState(1);
  const [isAutoJumpEnabled, setIsAutoJumpEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueValidation, setQueueValidation] = useState<Map<string, QueueValidationResult>>(new Map());
  const [showExportModal, setShowExportModal] = useState<'current' | 'full' | null>(null);
  const [showSavesModal, setShowSavesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'building' | 'ship' | 'colonist' | 'research'>('building');
  // Mobile-only toggle between Build (Add to Queue) and Queue (Planet Queue) panels.
  // Both render side-by-side on md+ screens; on mobile only the active one is shown.
  const [mobileView, setMobileView] = useState<'build' | 'queue'>('build');
  // Transient toast message; null when nothing to show. Auto-clears after 3s.
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCancellation, setPendingCancellation] = useState<{
    laneId: 'building' | 'ship' | 'colonist' | 'research';
    entry: any;
    brokenDependencies: any[];
  } | null>(null);
  // Items auto-removed due to cascade dependency failure after a cancel
  const [cascadeWarnings, setCascadeWarnings] = useState<Array<{
    entryId: string;
    laneId: string;
    reason: string;
  }>>([]);

  // Get current planet ID (only changes when switching planets, not on every mutation)
  const currentPlanetId = gameState.currentPlanetId;

  // Get current planet - memoize based on planet ID, not entire gameState
  const currentPlanet = useMemo(() => {
    return gameState.planets.get(currentPlanetId) || null;
  }, [gameState.planets, currentPlanetId]);

  // Initialize controller for the current planet (for timeline/turn management).
  // Intentionally depends only on currentPlanetId — recreating on every planet-state
  // change would discard the controller's internal timeline cache (very expensive).
  const controller = useMemo(() => {
    if (!currentPlanet || !currentPlanet.timeline) {
      return null;
    }
    return new GameController(currentPlanet, currentPlanet.timeline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlanetId]);

  // Note: viewTurn is synced synchronously in handlePlanetSwitch/handleCreatePlanet
  // to avoid render timing issues with planets that have different start turns

  // One-time migration of any pre-IndexedDB localStorage save into the history store.
  useEffect(() => {
    migrateLegacyLocalStorage(buildSaveSummary).catch((e) => console.warn('[saves] migration failed:', e));
  }, []);

  // Auto-save to URL + IndexedDB history on state changes (debounced).
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

          // Push to IndexedDB ring buffer so the user can revert auto-saves.
          // pushHistory dedupes against the most-recent identical encoded payload.
          const encoded = encodeGameState(planetConfigs, commands);
          const summary = buildSaveSummary(encoded);
          pushHistory(encoded, summary).catch((e) => console.warn('[saves] history push failed:', e));
        }
      } catch (error) {
        console.error('[URL State] Failed to save:', error);
      }
    }, 1000); // Debounce: wait 1 second after last change

    return () => clearTimeout(timer);
  }, [gameState, commandHistory]);

  // Memoize currentState to ensure React detects changes when viewTurn changes.
  // gameState is intentionally a dep so queue mutations re-run getStateAtTurn —
  // the controller mutates its internal timeline outside React's awareness.
  const currentState = useMemo(() => {
    if (!controller) return undefined;
    return controller.getStateAtTurn(viewTurn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // To display the global queue regardless of the turn slider, we pull the timeline's final state.
  // gameState is intentionally a dep so mutations re-run getStateAtTurn (controller mutates
  // its timeline outside React's awareness — same pattern as currentState).
  const fullPlanState = useMemo(() => {
    if (!controller) return undefined;
    return controller.getStateAtTurn(199);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, gameState]);

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

  // Merge engine warnings with cascade-removal warnings into a single list for the panel.
  // Cascade warnings are reset on next cancellation, so they auto-clear on next user action.
  const allWarnings = useMemo(() => {
    const cascadeItems = cascadeWarnings.map(w => ({
      type: 'QUEUE_CASCADE_REMOVAL' as const,
      message: `Auto-removed: ${w.reason}`,
      severity: 'warning' as const,
    }));
    return [...warnings, ...cascadeItems];
  }, [warnings, cascadeWarnings]);

  // Calculate first empty turn for each lane (for timeline quick jump buttons).
  // gameState is intentionally a dep so queue mutations re-evaluate (controller mutates
  // its timeline outside React's awareness — same pattern as currentState/fullPlanState).
  const firstEmptyTurns = useMemo(() => {
    if (!controller) return { building: null, ship: null, colonist: null };
    const getState = (turn: number) => controller.getStateAtTurn(turn);
    return getFirstEmptyTurns(getState, 1, totalTurns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Uses smart first-free-turn validation: evaluates the item against the state
  // at the turn when it would actually activate, not hardcoded T1.
  const canQueueItem = useCallback((itemId: string, quantity: number) => {
    if (!itemId) {
      return { allowed: false, canQueueEventually: false, waitTurnsNeeded: 0, blockers: [], reason: 'No item selected' };
    }

    const def = defs[itemId];
    if (!def) {
      return { allowed: false, canQueueEventually: false, waitTurnsNeeded: 0, blockers: [], reason: 'Unknown item' };
    }

    if (!controller) {
      return { allowed: false, canQueueEventually: false, waitTurnsNeeded: 0, blockers: [], reason: 'No controller available' };
    }

    // Get the T1 state (where the full plan lives) to calculate first-free turn
    const t1State = controller.getStateAtTurn(1);
    if (!t1State) {
      return { allowed: false, canQueueEventually: false, waitTurnsNeeded: 0, blockers: [], reason: 'Invalid turn' };
    }

    // Find the first turn when this lane will be free to activate the item
    const firstFreeTurn = def.lane === 'research'
      ? getFirstFreeTurnForResearch(t1State)
      : getFirstFreeTurnForLane(t1State, def.lane);

    // Validate against the state at that future turn (or T1 if lane is empty)
    const validationTurn = Math.max(1, firstFreeTurn);
    const validationState = controller.getStateAtTurn(validationTurn) ?? t1State;

    return validateQueueItem(validationState, itemId, quantity);
  }, [defs, controller]);

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
      const def = defs[itemId];
      const result = controller.queueItem(1, itemId, quantity);
      if (!result.success) {
        setError(result.reason || 'Cannot queue item');
        return;
      }

      // Record command for URL encoding (pass entryId so cancel commands can reference it)
      const planetIdx = getPlanetIndex(gameState, currentPlanetId);
      commandHistory.recordQueue(planetIdx, itemId, quantity, result.itemId ?? '');

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
      if (isAutoJumpEnabled && def && result.itemId) {
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
  }, [currentPlanet, currentPlanetId, controller, defs, viewTurn, gameState, commandHistory, isAutoJumpEnabled]);

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
    // Check if it's the last item before we cancel it
    let wasLastItem = false;
    const preCancelState = controller!.getStateAtTurn(199);
    if (preCancelState) {
      const laneView = getLaneView(preCancelState, laneId);
      if (laneView.entries.length > 0 && laneView.entries[laneView.entries.length - 1].id === entry.id) {
        wasLastItem = true;
      }
    }

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

    // Repack ALL lanes (not just the cancelled lane) so cross-lane dependencies
    // (e.g. a colonist waiting on a building prerequisite) are updated too.
    controller!.repackAllLanes(1);

    // BFS cascade: remove items whose prerequisites include the cancelled item's def ID
    // (and transitively, items that depended on those).
    // This is purely based on the prerequisites graph — NO timing re-checks,
    // which previously caused unrelated items to be incorrectly swept away.
    const newCascadeWarnings: Array<{ entryId: string; laneId: string; reason: string }> = [];
    const cancelledDefIds = new Set<string>([entry.itemId]);
    const allLaneIds: Array<'building' | 'ship' | 'colonist' | 'research'> = ['building', 'ship', 'colonist', 'research'];

    let moreFound = true;
    while (moreFound) {
      moreFound = false;
      const scanState = controller!.getStateAtTurn(1);
      if (!scanState) break;

      for (const scanLaneId of allLaneIds) {
        const entries = getLaneView(scanState, scanLaneId).entries;
        for (const qEntry of entries) {
          // Skip wait items and entries already scheduled for removal
          if (qEntry.isWait || qEntry.isAutoWait) continue;
          const qDef = scanState.defs[qEntry.itemId];
          if (!qDef) continue;

          // Only cascade if a prerequisite of this entry was directly cancelled
          const hasCancelledPrereq = qDef.prerequisites?.some(p => cancelledDefIds.has(p));
          if (hasCancelledPrereq) {
            // This entry is now broken — cascade it too
            cancelledDefIds.add(qEntry.itemId);
            newCascadeWarnings.push({
              entryId: qEntry.id,
              laneId: scanLaneId,
              reason: `${qDef.name || qEntry.itemId} — prerequisite removed`,
            });
            controller!.cancelPlannedItem(scanLaneId, qEntry.id);
            moreFound = true; // Another pass needed for transitive dependents
          }
        }
      }
    }

    // Repack once after all cascade removals to close the resulting gaps
    if (newCascadeWarnings.length > 0) {
      controller!.repackAllLanes(1);
    }

    setCascadeWarnings(newCascadeWarnings);

    let newViewTurn = viewTurn;
    if (isAutoJumpEnabled && wasLastItem) {
      const postCancelState = controller!.getStateAtTurn(199);
      if (postCancelState) {
        const laneView = getLaneView(postCancelState, laneId);
        if (laneView.entries.length > 0) {
          const lastItem = laneView.entries[laneView.entries.length - 1];
          const endTurn = lastItem.completionTurn ?? lastItem.eta ?? 1;
          newViewTurn = Math.min(endTurn + 1, 199);
        } else {
          newViewTurn = currentPlanet?.startTurn ?? 1;
        }
      }
    }

    // Update the planet in game state
    const updatedPlanet = controller!.getStateAtTurn(newViewTurn);
    if (updatedPlanet) {
      setGameState(prev => {
        const newPlanets = new Map(prev.planets);
        newPlanets.set(gameState.currentPlanetId, updatedPlanet as ExtendedPlanetState);
        return { ...prev, planets: newPlanets };
      });
      // Validate all remaining queue items after removal and cascade
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
  }, [controller, viewTurn, gameState, setGameState, commandHistory, currentPlanet?.startTurn, isAutoJumpEnabled]);

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
  }, [pendingCancellation, controller, executeCancellation]);

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
  }, [controller, executeCancellation]);

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
  }, [controller, canQueueItem]);

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

  // Reset the current planet's queue to its initial starting state
  const handleResetQueue = useCallback(() => {
    setError(null);
    if (!controller) {
      setError('No planet selected');
      return;
    }

    try {
      controller.resetQueue();
      setViewTurn(1);
      setQueueValidation(new Map());
      setCascadeWarnings([]);

      // Record the reset in command history by clearing all commands for this planet
      // Simplest approach: push a full reset command (URL will replay correctly)
      const planetIdx = getPlanetIndex(gameState, currentPlanetId);
      commandHistory.recordReset(planetIdx);

      // Reflect fresh state in gameState
      const freshState = controller.getStateAtTurn(1);
      if (freshState) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          newPlanets.set(currentPlanetId, freshState as ExtendedPlanetState);
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, currentPlanetId, gameState, commandHistory]);

  // Snapshot the current encoded state for the saves modal — encapsulates the
  // same encode-once-then-summarise pattern used by the auto-save effect.
  const getCurrentSnapshot = useCallback(() => {
    try {
      const planetConfigs = extractPlanetConfigs(gameState);
      const commands = commandHistory.getCommands();
      if (commands.length === 0) return null;
      const encoded = encodeGameState(planetConfigs, commands);
      const summary = buildSaveSummary(encoded);
      return { encoded, summary };
    } catch {
      return null;
    }
  }, [gameState, commandHistory]);

  // Restore a save: push the encoded state into the URL hash and reload so the
  // existing hash-based bootstrap rebuilds command history from scratch.
  // Reload (vs trying to splice state in-place) avoids any stale closures and
  // keeps the restore path identical to the share-link flow.
  const handleRestoreSave = useCallback((encoded: string, label: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.location.hash = `state=${encoded}`;
      setToast(`Loading "${label}"…`);
      // Reload so loadStateFromURL runs cleanly on next mount.
      setTimeout(() => window.location.reload(), 200);
    } catch (e) {
      setError(`Failed to restore: ${(e as Error).message}`);
    }
  }, []);

  // Guard against undefined state — all hooks are declared above
  if (!currentState || !summary || !enrichedBuildingLane || !enrichedShipLane || !enrichedColonistLane || !enrichedResearchLane) {
    return <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text p-6">
      <h1 className="text-2xl font-bold">Error: Invalid turn {viewTurn}</h1>
    </div>;
  }

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
        <header className="bg-pink-nebula-panel px-3 md:px-6 py-3 md:py-4 border-b border-pink-nebula-border">
          <h1 className="text-lg md:text-2xl font-bold tracking-wide">Infinite Conflict Simulator</h1>
        </header>

        {/* Planet Tabs - Multi-planet navigation */}
        <div className="px-3 md:px-6 py-2">
          <PlanetTabs
            planets={gameState.planets}
            currentPlanetId={gameState.currentPlanetId}
            onPlanetSwitch={handlePlanetSwitch}
            onAddPlanet={handleAddPlanet}
            maxPlanets={gameState.maxPlanets}
            onResetQueue={handleResetQueue}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-auto mt-4 w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl px-6 bg-red-900/20 border border-red-400 rounded p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Warnings Panel — includes engine warnings + cascade-removal notices */}
        {allWarnings.length > 0 && (
          <div className="px-3 md:px-6 mt-4">
            <WarningsPanel warnings={allWarnings} />
          </div>
        )}

        {/* Planet Dashboard - Horizontal Overview */}
        <PlanetDashboard
          summary={summary}
          defs={defs}
          turnsToHousingCap={currentState ? getTurnsUntilHousingCap(currentState, viewTurn) : null}
          stocksEstimated={currentState?.activationUsedProjectedProduction === true}
        />

        {/* Horizontal Timeline - Between dashboard and queues */}
        <div className="w-full max-w-[1800px] mx-auto px-3 md:px-6">
          <HorizontalTimeline
            currentTurn={viewTurn}
            totalTurns={totalTurns}
            onTurnChange={setViewTurn}
            firstEmptyTurns={firstEmptyTurns}
            isAutoJumpEnabled={isAutoJumpEnabled}
            onAutoJumpToggle={setIsAutoJumpEnabled}
          />
        </div>

        {/* Main Content - Side-by-side Tabbed Displays */}
        <main className="flex-1 max-w-[1800px] mx-auto w-full px-3 md:px-6 py-4 md:py-6">
          {/* Mobile-only Build/Queue toggle: switches which panel is visible on phones */}
          <div className="md:hidden flex gap-1 mb-3 p-1 bg-pink-nebula-panel/50 rounded-lg border border-pink-nebula-border">
            <button
              onClick={() => setMobileView('build')}
              className={`flex-1 py-2 px-3 rounded-md font-semibold text-sm transition-colors ${
                mobileView === 'build'
                  ? 'bg-pink-nebula-accent-primary text-white shadow'
                  : 'text-pink-nebula-text hover:bg-pink-nebula-panel'
              }`}
            >
              ➕ Build
            </button>
            <button
              onClick={() => setMobileView('queue')}
              className={`flex-1 py-2 px-3 rounded-md font-semibold text-sm transition-colors ${
                mobileView === 'queue'
                  ? 'bg-pink-nebula-accent-primary text-white shadow'
                  : 'text-pink-nebula-text hover:bg-pink-nebula-panel'
              }`}
            >
              📋 Queue {totalQueuedItems > 0 && <span className="ml-1 text-xs opacity-80">({totalQueuedItems})</span>}
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {/* Left: Add to Queue (Item Selection) */}
            <Card className={`flex-1 min-w-0 p-3 md:p-6 ${mobileView === 'build' ? 'block' : 'hidden md:block'}`}>
              <h2 className="text-xl md:text-2xl font-bold text-pink-nebula-text mb-4 md:mb-6">Add to Queue</h2>
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
            <Card className={`flex-1 min-w-0 p-3 md:p-6 ${mobileView === 'queue' ? 'block' : 'hidden md:block'}`} data-export-target="planet-queue">
              <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-between mb-4 md:mb-6">
                <div className="flex flex-wrap items-center gap-2 md:gap-4 min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold text-pink-nebula-text">Planet Queue</h2>
                  {/* Live Queue Item Count */}
                  {totalQueuedItems > 0 && (
                    <div className="text-xs md:text-sm text-pink-nebula-text-secondary">
                      <span className="font-mono">
                        {totalQueuedItems} queued <span className="hidden sm:inline">| {isMounted ? window.location.href.length : 0} chars</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const url = window.location.href;
                      const cmds = commandHistory.getCommands().length;
                      navigator.clipboard.writeText(url).then(() => {
                        setToast(`Link copied — ${cmds} command${cmds === 1 ? '' : 's'}, ${url.length} chars`);
                        setTimeout(() => setToast(null), 3000);
                      }).catch(() => {
                        setToast('Could not copy — clipboard unavailable');
                        setTimeout(() => setToast(null), 3000);
                      });
                    }}
                    className="flex-1 sm:flex-initial px-3 md:px-4 py-2.5 md:py-2 min-h-[44px] md:min-h-0 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                    title="Copy shareable link with game state"
                  >
                    <span>📋</span>
                    <span>Share Link</span>
                  </button>
                  <button
                    onClick={() => setShowSavesModal(true)}
                    className="flex-1 sm:flex-initial px-3 md:px-4 py-2.5 md:py-2 min-h-[44px] md:min-h-0 bg-slate-700 hover:bg-slate-600 text-pink-nebula-text font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                    title="Save, load, and import plans (stored on this device)"
                  >
                    <span>💾</span>
                    <span>Saves</span>
                  </button>
                  <button
                    className="flex-1 sm:flex-initial px-3 md:px-4 py-2.5 md:py-2 min-h-[44px] md:min-h-0 border border-pink-nebula-text text-pink-nebula-text rounded hover:bg-pink-nebula-text hover:text-pink-nebula-bg transition-colors text-sm md:text-base"
                    onClick={() => setShowExportModal('current')}
                    title="Export current planet data"
                  >
                    Export / Share
                  </button>
                  <button
                    onClick={() => setShowExportModal('full')}
                    className="flex-1 sm:flex-initial px-3 md:px-4 py-2.5 md:py-2 min-h-[44px] md:min-h-0 bg-pink-nebula-accent-primary text-pink-nebula-bg font-semibold rounded-lg hover:bg-pink-nebula-accent-secondary transition-colors text-sm md:text-base"
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

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-pink-nebula-text-secondary pb-8 space-y-2">
          <button
            className="hover:text-pink-nebula-text transition-colors opacity-50 hover:opacity-100"
            onClick={() => {
              const hash = window.location.hash;
              if (hash) {
                navigator.clipboard.writeText(window.location.href);
                alert('Debug URL copied to clipboard!');
              } else {
                alert('No state to copy yet.');
              }
            }}
            title="Copy URL with full command history to clipboard for bug reporting"
          >
            Copy Debug State
          </button>
          <div className="opacity-30 text-[10px]">v0.2.0</div>
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

      {/* Add Planet Modal */}
      <AddPlanetModal
        isOpen={showAddPlanetModal}
        onClose={() => setShowAddPlanetModal(false)}
        onAddPlanet={handleCreatePlanet}
        currentTurn={currentPlanet?.currentTurn || 1}
      />

      {/* Saves Modal — IndexedDB-backed named saves, auto-save history, and JSON import */}
      <SavesModal
        isOpen={showSavesModal}
        onClose={() => setShowSavesModal(false)}
        getCurrentSnapshot={getCurrentSnapshot}
        onRestore={handleRestoreSave}
      />

      {/* Transient toast — shown after copy-link, etc. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 max-w-[90vw] bg-pink-nebula-panel border border-pink-nebula-accent-primary rounded-lg shadow-2xl text-pink-nebula-text text-sm font-medium pointer-events-none animate-in fade-in slide-in-from-bottom-2"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
