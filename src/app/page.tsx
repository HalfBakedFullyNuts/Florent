"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GameController } from '../lib/game/commands';
import { createInitialGameState, addPlanet, updatePlanetConfig, resetToHomeworld, switchPlanet, type GameState, type ExtendedPlanetState } from '../lib/game/gameState';
import { getPlanetSummary, getLaneView, getWarnings, canQueueItem as validateQueueItem, getTurnsUntilHousingCap, getFirstEmptyTurns, getFirstFreeTurnForLane, type LaneView } from '../lib/game/selectors';
import { validateAllQueueItems, type QueueValidationResult, getValidationMessage, getDependentQueueItems } from '../lib/game/validation';
import { loadGameData } from '../lib/sim/defs/adapter.client';
import type { LaneId, PlanetState } from '../lib/sim/engine/types';
import gameDataRaw from '../lib/game/game_data.json';
import { setupLogging } from '../lib/game/logging-utils';
import {
  CommandHistory,
  buildShareURL,
  decodeGameState,
  encodeGameState,
  extractPlanetConfigs,
  getEncodedStateFromURL,
  getPlanetIndex,
  getShareMetadataFromSnapshot,
  estimateEncodedSize,
  loadStateFromLocalStorage,
  loadStateFromURL,
  normaliseShareMetadata,
  replayCommands,
  saveEncodedStateToURL,
  type ShareMetadata,
} from '../lib/game/urlState';
import {
  cancelGlobalResearch,
  canQueueGlobalResearch,
  getEarliestPlanetStartTurn,
  getGlobalResearchAtTurn,
  getGlobalResearchLaneView,
  getResearchCompletionTurns,
  queueGlobalResearch,
  queueGlobalResearchWait,
  reorderGlobalResearch,
} from '../lib/game/globalResearch';

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
import { BuildListSelector } from '../components/BuildListSelector';

// Persistence
import { pushHistory, migrateLegacyLocalStorage, saveSharedLink } from '../lib/persistence/savesDb';
import { buildSaveSummary } from '../lib/persistence/saveSummary';

type LoadedGameSnapshot = NonNullable<ReturnType<typeof loadStateFromURL>>;
const SHARE_AUTHOR_STORAGE_KEY = 'florent_share_author';

function withPlanetMetadata(snapshot: PlanetState, existing: ExtendedPlanetState): ExtendedPlanetState {
  return {
    ...snapshot,
    id: existing.id,
    name: existing.name,
    startTurn: existing.startTurn,
    currentTurn: snapshot.currentTurn ?? existing.currentTurn,
    timeline: existing.timeline,
  } as ExtendedPlanetState;
}

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
  const [activeShareMetadata, setActiveShareMetadata] = useState<ShareMetadata | null>(null);
  // Bootstrap-once guard: React StrictMode runs effects twice in dev; we only
  // want to restore state on the first mount, otherwise the second run replays
  // commands on top of the already-restored state and double-counts everything.
  const bootstrappedRef = useRef(false);
  const lastAppliedShareRef = useRef<string | null>(null);

  const rememberOpenedSharedLink = useCallback((encoded: string, snapshot: LoadedGameSnapshot) => {
    const share = getShareMetadataFromSnapshot(snapshot);
    setActiveShareMetadata(share);
    if (!share) return;
    if (typeof window.indexedDB === 'undefined') return;

    const summary = buildSaveSummary(encoded);
    saveSharedLink({
      encoded,
      name: share.name,
      author: share.author,
      summary,
    }).catch((e) => console.warn('[saves] shared link save failed:', e));
  }, []);

  const restoreShareSnapshot = useCallback((snapshot: LoadedGameSnapshot, encoded?: string | null) => {
    const replayedState = replayCommands(createInitialGameState(), snapshot.cmds);
    commandHistory.loadFromSnapshot(snapshot.cmds);
    setActiveShareMetadata(getShareMetadataFromSnapshot(snapshot));
    if (encoded) rememberOpenedSharedLink(encoded, snapshot);
    setGameState(() => ({
      ...replayedState,
      planets: new Map(replayedState.planets),
    }));
  }, [commandHistory, rememberOpenedSharedLink]);

  useEffect(() => {
    setIsMounted(true);
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    // Load state from URL or LocalStorage after hydration. URL wins so an
    // incoming shared build is not masked by this device's last local save.
    let urlSnapshot = loadStateFromURL();
    const encodedFromURL = getEncodedStateFromURL();

    if (urlSnapshot) {
      lastAppliedShareRef.current = encodedFromURL;
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

    if (urlSnapshot) {
      restoreShareSnapshot(urlSnapshot, encodedFromURL);
    }
  }, [restoreShareSnapshot]);

  useEffect(() => {
    const handleHashChange = () => {
      const encoded = getEncodedStateFromURL();
      if (!encoded || encoded === lastAppliedShareRef.current) return;

      const snapshot = decodeGameState(encoded);
      if (!snapshot) {
        setError('Shared build link could not be loaded.');
        return;
      }

      lastAppliedShareRef.current = encoded;
      restoreShareSnapshot(snapshot, encoded);
      setToast('Shared build list loaded from link');
      setTimeout(() => setToast(null), 3000);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [restoreShareSnapshot]);

  const [showAddPlanetModal, setShowAddPlanetModal] = useState(false);
  const [planetModalTurn, setPlanetModalTurn] = useState(1);
  const [editingPlanetId, setEditingPlanetId] = useState<string | null>(null);
  const [viewTurn, setViewTurn] = useState(1);
  const [isAutoJumpEnabled, setIsAutoJumpEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueValidation, setQueueValidation] = useState<Map<string, QueueValidationResult>>(new Map());
  const [showExportModal, setShowExportModal] = useState<'current' | 'full' | null>(null);
  const [showSavesModal, setShowSavesModal] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState<{
    buildingLane: LaneView;
    shipLane: LaneView;
    colonistLane: LaneView;
    currentTurn: number;
  } | null>(null);
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
  const planTurn = currentPlanet?.startTurn ?? 1;

  // Initialize controller for the current planet and timeline identity.
  // Ordinary queue mutations preserve the same timeline cache; planet edits replace it.
  const controller = useMemo(() => {
    if (!currentPlanet || !currentPlanet.timeline) {
      return null;
    }
    return new GameController(currentPlanet, currentPlanet.timeline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlanetId, currentPlanet?.timeline]);

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
          const encoded = encodeGameState(planetConfigs, commands, activeShareMetadata);
          saveEncodedStateToURL(encoded);
          lastAppliedShareRef.current = encoded;

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
          const summary = buildSaveSummary(encoded);
          pushHistory(encoded, summary).catch((e) => console.warn('[saves] history push failed:', e));
        }
      } catch (error) {
        console.error('[URL State] Failed to save:', error);
      }
    }, 1000); // Debounce: wait 1 second after last change

    return () => clearTimeout(timer);
  }, [gameState, commandHistory, activeShareMetadata]);

  // Memoize currentState to ensure React detects changes when viewTurn changes.
  // gameState is intentionally a dep so queue mutations re-run getStateAtTurn —
  // the controller mutates its internal timeline outside React's awareness.
  const currentState = useMemo(() => {
    if (!controller) return undefined;
    return controller.getStateAtTurn(viewTurn);
  // The controller mutates its timeline outside React; gameState is a deliberate cache-busting dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, viewTurn, gameState]);
  const totalTurns = controller?.getTotalTurns() || 200;

  const defs = currentState?.defs || loadGameData(gameDataRaw as any);
  const globalResearch = useMemo(
    () => getGlobalResearchAtTurn(gameState, viewTurn),
    [gameState, viewTurn]
  );
  const researchCompletionTurns = useMemo(
    () => getResearchCompletionTurns(gameState),
    [gameState]
  );
  const getGlobalCompletedResearchForTurn = useCallback((turn: number) => {
    return Array.from(new Set([
      ...(gameState.globalResearch.completed || []),
      ...Array.from(researchCompletionTurns.entries())
        .filter(([, completionTurn]) => completionTurn <= turn)
        .map(([id]) => id),
    ]));
  }, [gameState.globalResearch.completed, researchCompletionTurns]);
  const effectivePlanetLimit = useMemo(
    () => globalResearch.planetLimit,
    [globalResearch.planetLimit]
  );

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
  const summary = useMemo(() => {
    if (!currentState) return null;
    const base = getPlanetSummary(currentState);
    return {
      ...base,
      stocks: {
        ...base.stocks,
        research_points: globalResearch.stock,
      },
      outputsPerTurn: {
        ...base.outputsPerTurn,
        research_points: globalResearch.outputPerTurn,
      },
      planetLimit: globalResearch.planetLimit,
      completedResearch: globalResearch.completed,
    };
  }, [currentState, globalResearch]);

  // To display the full queue regardless of the turn slider, read a simulated
  // future state so delayed prerequisites have their actual start/completion turns.
  const fullPlanState = useMemo(() => {
    if (!controller) return undefined;
    return controller.getStateAtTurn(totalTurns - 1);
  // The controller mutates its timeline outside React; gameState is a deliberate cache-busting dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, totalTurns, gameState]);

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
  const globalResearchLane = useMemo(
    () => getGlobalResearchLaneView(gameState, viewTurn),
    [gameState, viewTurn]
  );

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
    return getFirstEmptyTurns(getState, planTurn, totalTurns);
  // The controller mutates its timeline outside React; gameState is a deliberate cache-busting dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, totalTurns, gameState, planTurn]);

  // Enrich all lanes with validation state in a single useMemo
  const enrichedLanes = useMemo(() => ({
    building: buildingLane ? { ...buildingLane, entries: enrichEntriesWithValidation(buildingLane.entries) } : null,
    ship: shipLane ? { ...shipLane, entries: enrichEntriesWithValidation(shipLane.entries) } : null,
    colonist: colonistLane ? { ...colonistLane, entries: enrichEntriesWithValidation(colonistLane.entries) } : null,
    research: globalResearchLane ? { ...globalResearchLane, entries: enrichEntriesWithValidation(globalResearchLane.entries) } : null,
  }), [buildingLane, shipLane, colonistLane, globalResearchLane, enrichEntriesWithValidation]);

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

    if (def.lane === 'research') {
      const check = canQueueGlobalResearch(gameState, itemId);
      return {
        allowed: check.allowed,
        canQueueEventually: check.allowed,
        waitTurnsNeeded: 0,
        blockers: check.allowed ? [] : [{ type: 'PREREQUISITE', message: check.reason || 'Cannot queue research' }],
        reason: check.reason === 'REQ_MISSING' ? 'REQ_MISSING' : check.reason,
      };
    }

    // Get the T1 state (where the full plan lives) to calculate first-free turn
    const t1State = controller.getStateAtTurn(planTurn);
    if (!t1State) {
      return { allowed: false, canQueueEventually: false, waitTurnsNeeded: 0, blockers: [], reason: 'Invalid turn' };
    }

    // Find the first turn when this lane will be free to activate the item
    const firstFreeTurn = getFirstFreeTurnForLane(t1State, def.lane);

    // Validate against the state at that future turn (or T1 if lane is empty)
    const validationTurn = Math.max(1, firstFreeTurn);
    const validationState = controller.getStateAtTurn(validationTurn) ?? t1State;
    validationState.completedResearch = Array.from(new Set([
      ...(validationState.completedResearch || []),
      ...getGlobalCompletedResearchForTurn(validationTurn),
    ]));

    return validateQueueItem(validationState, itemId, quantity);
  }, [defs, controller, gameState, getGlobalCompletedResearchForTurn, planTurn]);

  const editingPlanetConfig = useMemo<PlanetConfig | undefined>(() => {
    if (!editingPlanetId) return undefined;
    const planet = gameState.planets.get(editingPlanetId);
    if (!planet) return undefined;

    const initialState = planet.timeline?.getStateAtTurn(planet.startTurn) ?? planet;
    return {
      name: planet.name,
      startTurn: planet.startTurn,
      abundance: initialState.abundance,
      space: {
        groundCap: initialState.space.groundCap,
        orbitalCap: initialState.space.orbitalCap,
      },
      starting: {
        workersTotal: initialState.population.workersTotal,
        structures: {
          metal_mine: initialState.completedCounts.metal_mine ?? 0,
          mineral_extractor: initialState.completedCounts.mineral_extractor ?? 0,
          farm: initialState.completedCounts.farm ?? 0,
          solar_generator: initialState.completedCounts.solar_generator ?? 0,
        },
      },
    };
  }, [editingPlanetId, gameState.planets]);

  // Planet management handlers
  const handlePlanetSwitch = useCallback((planetId: string) => {
    if (!planetId || !gameState.planets.has(planetId)) {
      setError(`Planet ${planetId || 'unknown'} does not exist`);
      return;
    }
    // Sync viewTurn BEFORE switching to avoid render timing issues
    const planet = gameState.planets.get(planetId);
    if (planet) {
      setViewTurn(planet.currentTurn);
    }
    setGameState(prev => switchPlanet(prev, planetId));
  }, [gameState]);

  const handleAddPlanet = useCallback(() => {
    setError(null);
    const nextPlanetNumber = gameState.planets.size + 1;
    const earliestTurn = getEarliestPlanetStartTurn(gameState, nextPlanetNumber, viewTurn);
    if (earliestTurn === null) {
      setError(`Planet limit ${nextPlanetNumber} is not unlocked or scheduled in the research queue.`);
      return;
    }
    setEditingPlanetId(null);
    setPlanetModalTurn(Math.max(viewTurn, earliestTurn));
    setShowAddPlanetModal(true);
  }, [gameState, viewTurn]);

  const handleEditPlanet = useCallback((planetId: string) => {
    if (planetId === 'planet-1') return;
    const planet = gameState.planets.get(planetId);
    if (!planet) return;
    setError(null);
    setEditingPlanetId(planetId);
    setPlanetModalTurn(planet.startTurn);
    setShowAddPlanetModal(true);
  }, [gameState.planets]);

  const handleCreatePlanet = useCallback((config: PlanetConfig) => {
    try {
      if (editingPlanetId) {
        const updated = updatePlanetConfig(gameState, editingPlanetId, config);
        const planetIdx = getPlanetIndex(gameState, editingPlanetId);
        commandHistory.recordEditPlanet(planetIdx, config);
        setViewTurn(config.startTurn);
        setGameState(updated);
        setEditingPlanetId(null);
        return true;
      }
      const nextPlanetNumber = gameState.planets.size + 1;
      const earliestTurn = getEarliestPlanetStartTurn(gameState, nextPlanetNumber, config.startTurn);
      const adjustedConfig = earliestTurn !== null && config.startTurn < earliestTurn
        ? { ...config, startTurn: earliestTurn }
        : config;
      const newGameState = addPlanet(gameState, adjustedConfig);
      const newPlanetId = `planet-${newGameState.nextPlanetId - 1}`;
      commandHistory.recordAddPlanet(adjustedConfig);
      // Sync viewTurn to new planet's start turn BEFORE switching
      // This prevents render timing issues with controller.getStateAtTurn()
      setViewTurn(adjustedConfig.startTurn);
      setGameState(switchPlanet(newGameState, newPlanetId));
      setEditingPlanetId(null);
      return true;
    } catch (e) {
      setError((e as Error).message || 'Failed to create planet');
      return false;
    }
  }, [gameState, editingPlanetId, commandHistory]);

  // Command handlers
  const handleQueueItem = useCallback((itemId: string, quantity: number) => {
    setError(null);
    if (!currentPlanet || !controller) {
      setError('No planet selected');
      return;
    }

    try {
      const def = defs[itemId];
      if (def?.lane === 'research') {
        const nextState = queueGlobalResearch(gameState, itemId);
        const queuedEntry = nextState.globalResearch.lane.pendingQueue[nextState.globalResearch.lane.pendingQueue.length - 1];
        if (queuedEntry) commandHistory.recordQueueResearch(itemId, queuedEntry.id);
        setGameState(nextState);
        return;
      }

      const completedResearch = getGlobalCompletedResearchForTurn(viewTurn);
      const researchPrereqs = (def?.prerequisites || []).filter((id: string) => defs[id]?.lane === 'research');
      const missingUnscheduled = researchPrereqs.find((id: string) => !completedResearch.includes(id) && !researchCompletionTurns.has(id));
      if (missingUnscheduled) {
        setError(`Missing research prerequisite: ${defs[missingUnscheduled]?.name || missingUnscheduled}`);
        return;
      }
      const minStartTurn = researchPrereqs.reduce((turn: number | undefined, id: string) => {
        const completionTurn = completedResearch.includes(id) ? undefined : researchCompletionTurns.get(id);
        return completionTurn === undefined ? turn : Math.max(turn ?? 1, completionTurn);
      }, undefined as number | undefined);

      const result = controller.queueItem(planTurn, itemId, quantity, {
        completedResearch,
        minStartTurn,
      });
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
          const existing = newPlanets.get(gameState.currentPlanetId);
          if (existing) newPlanets.set(gameState.currentPlanetId, withPlanetMetadata(updatedPlanet, existing));
          return { ...prev, planets: newPlanets };
        });
      }

      // AUTO-ADVANCE: Move to the completion turn of the item we just added
      // Shows the turn immediately following the new structure's completion
      if (isAutoJumpEnabled && def && result.itemId) {
        const displayState = controller.getStateAtTurn(totalTurns - 1);
        if (displayState) {
          const laneView = getLaneView(displayState, def.lane);
          const newlyAdded = laneView.entries.find(e => e.id === result.itemId);
          if (newlyAdded) {
            const endTurn = newlyAdded.completionTurn ?? newlyAdded.eta ?? viewTurn;
            setViewTurn(Math.min(endTurn + 1, totalTurns - 1));
          }
        }
      }
    } catch (e) {
      console.error('Error in handleQueueItem:', e);
      setError((e as Error).message || 'Unknown error');
    }
  }, [currentPlanet, currentPlanetId, controller, defs, viewTurn, gameState, commandHistory, isAutoJumpEnabled, getGlobalCompletedResearchForTurn, researchCompletionTurns, totalTurns, planTurn]);

  const handleQueueWait = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', waitTurns: number) => {
    setError(null);
    if (!currentPlanet || !controller) {
      setError('No planet selected');
      return;
    }

    try {
      if (laneId === 'research') {
        setGameState(prev => {
          const nextState = queueGlobalResearchWait(prev, waitTurns);
          const queuedEntry = nextState.globalResearch.lane.pendingQueue[nextState.globalResearch.lane.pendingQueue.length - 1];
          if (queuedEntry) commandHistory.recordQueueResearchWait(waitTurns, queuedEntry.id);
          return nextState;
        });
        return;
      }

      const result = controller.queueWaitItem(planTurn, laneId, waitTurns, false);
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
          const existing = newPlanets.get(gameState.currentPlanetId);
          if (existing) newPlanets.set(gameState.currentPlanetId, withPlanetMetadata(updatedPlanet, existing));
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      console.error('Error in handleQueueWait:', e);
      setError((e as Error).message || 'Unknown error');
    }
  }, [currentPlanet, controller, viewTurn, gameState, commandHistory, planTurn]);

  // Core execution function to instantly cancel and auto-collapse queues
  const executeCancellation = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entry: any) => {
    if (laneId === 'research') {
      commandHistory.recordCancel(0, laneId, entry.id);
      setGameState(prev => cancelGlobalResearch(prev, entry.id));
      return;
    }

    // Check if it's the last item before we cancel it
    let wasLastItem = false;
    const maxTurn = totalTurns - 1;
    const preCancelState = controller!.getStateAtTurn(maxTurn);
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
    controller!.repackAllLanes(planTurn);

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
      const scanState = controller!.getStateAtTurn(planTurn);
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
      controller!.repackAllLanes(planTurn);
    }

    setCascadeWarnings(newCascadeWarnings);

    let newViewTurn = viewTurn;
    if (isAutoJumpEnabled && wasLastItem) {
      const postCancelState = controller!.getStateAtTurn(maxTurn);
      if (postCancelState) {
        const laneView = getLaneView(postCancelState, laneId);
        if (laneView.entries.length > 0) {
          const lastItem = laneView.entries[laneView.entries.length - 1];
          const endTurn = lastItem.completionTurn ?? lastItem.eta ?? 1;
          newViewTurn = Math.min(endTurn + 1, maxTurn);
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
        const existing = newPlanets.get(gameState.currentPlanetId);
        if (existing) newPlanets.set(gameState.currentPlanetId, withPlanetMetadata(updatedPlanet, existing));
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
  }, [controller, viewTurn, gameState, setGameState, commandHistory, planTurn, totalTurns, currentPlanet?.startTurn, isAutoJumpEnabled]);

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
    if (laneId === 'research') {
      executeCancellation(laneId, entry);
      return;
    }
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
      const updateResult = controller.updateItemQuantity(planTurn, laneId, entry.id, newQuantity);

      if (!updateResult.success) {
        setError(`Failed to update quantity: ${updateResult.reason}`);
        return;
      }

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          const existing = newPlanets.get(gameState.currentPlanetId);
          if (existing) newPlanets.set(gameState.currentPlanetId, withPlanetMetadata(updatedPlanet, existing));
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, viewTurn, gameState, planTurn]);

  const handleReorder = useCallback((laneId: 'building' | 'ship' | 'colonist' | 'research', entryId: string, newIndex: number) => {
    setError(null);
    if (laneId === 'research') {
      const nextState = reorderGlobalResearch(gameState, entryId, newIndex);
      if (nextState === gameState) {
        setError('Cannot move research before its prerequisites.');
        return;
      }
      commandHistory.recordReorder(0, laneId, entryId, newIndex);
      setGameState(nextState);
      return;
    }
    if (!controller) {
      setError('No planet selected');
      return;
    }

    try {
      const result = controller.reorderQueueItem(planTurn, laneId, entryId, newIndex);

      if (!result.success) {
        setError(`Cannot reorder: ${result.reason || 'unknown error'}`);
        return;
      }

      // We should repack the queue following a reorder so items lock into their new places mathematically
      controller.repackQueue(planTurn, laneId);

      // Update the planet in game state
      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          const existing = newPlanets.get(gameState.currentPlanetId);
          if (existing) newPlanets.set(gameState.currentPlanetId, withPlanetMetadata(updatedPlanet, existing));
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      console.error('Error reordering item:', e);
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, viewTurn, gameState, commandHistory, planTurn]);

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
      const newTurn = controller.getCurrentTurn();
      setViewTurn(newTurn);

      // Update the planet in game state with new turn
      const updatedPlanet = controller.getStateAtTurn(newTurn);
      if (updatedPlanet) {
        setGameState(prev => {
          const newPlanets = new Map(prev.planets);
          const planetToUpdate = newPlanets.get(gameState.currentPlanetId);
          if (planetToUpdate) {
            const merged = withPlanetMetadata(updatedPlanet, planetToUpdate);
            merged.currentTurn = newTurn;
            newPlanets.set(gameState.currentPlanetId, merged);
          }
          return { ...prev, planets: newPlanets };
        });
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [controller, currentPlanet, gameState]);

  // Reset the current planet's queue to its initial starting state
  const handleResetQueue = useCallback(() => {
    setError(null);

    try {
      const resetState = resetToHomeworld(gameState);
      setViewTurn(1);
      setQueueValidation(new Map());
      setCascadeWarnings([]);
      setEditingPlanetId(null);

      commandHistory.recordResetAllPlanets();
      setGameState(resetState);
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    }
  }, [gameState, commandHistory]);

  const openExportModal = useCallback((mode: 'current' | 'full') => {
    setExportSnapshot({
      buildingLane: enrichedBuildingLane || { laneId: 'building' as const, entries: [] },
      shipLane: enrichedShipLane || { laneId: 'ship' as const, entries: [] },
      colonistLane: enrichedColonistLane || { laneId: 'colonist' as const, entries: [] },
      currentTurn: viewTurn,
    });
    setShowExportModal(mode);
  }, [enrichedBuildingLane, enrichedShipLane, enrichedColonistLane, viewTurn]);

  // Snapshot the current encoded state for the saves modal — encapsulates the
  // same encode-once-then-summarise pattern used by the auto-save effect.
  const getCurrentSnapshot = useCallback(() => {
    try {
      const planetConfigs = extractPlanetConfigs(gameState);
      const commands = commandHistory.getCommands();
      if (commands.length === 0) return null;
      const encoded = encodeGameState(planetConfigs, commands, activeShareMetadata);
      const summary = buildSaveSummary(encoded);
      return { encoded, summary };
    } catch {
      return null;
    }
  }, [gameState, commandHistory, activeShareMetadata]);

  const buildCurrentShareURL = useCallback((metadata?: ShareMetadata | null) => {
    const planetConfigs = extractPlanetConfigs(gameState);
    const commands = commandHistory.getCommands();
    if (commands.length === 0) return null;

    const encoded = encodeGameState(planetConfigs, commands, metadata ?? activeShareMetadata);
    saveEncodedStateToURL(encoded);
    lastAppliedShareRef.current = encoded;
    return {
      commandCount: commands.length,
      url: buildShareURL(encoded),
    };
  }, [gameState, commandHistory, activeShareMetadata]);

  const requestShareMetadata = useCallback(() => {
    const defaultName = activeShareMetadata?.name || `${currentPlanet?.name ?? 'Homeworld'} build list`;
    const name = window.prompt('Name this shared build list', defaultName);
    if (name === null) return null;

    let storedAuthor = '';
    try {
      storedAuthor = window.localStorage.getItem(SHARE_AUTHOR_STORAGE_KEY) ?? '';
    } catch { /* ignore */ }

    const defaultAuthor = activeShareMetadata?.author === 'Unknown commander'
      ? storedAuthor
      : activeShareMetadata?.author || storedAuthor;
    const author = window.prompt('Author name for this shared link', defaultAuthor);
    if (author === null) return null;

    const metadata = normaliseShareMetadata({
      name,
      author,
      sharedAt: new Date().toISOString(),
    });
    if (!metadata) return null;

    try {
      window.localStorage.setItem(SHARE_AUTHOR_STORAGE_KEY, metadata.author);
    } catch { /* ignore */ }
    return metadata;
  }, [activeShareMetadata, currentPlanet?.name]);

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

        <BuildListSelector onRestore={handleRestoreSave} />

        {/* Planet Tabs - Multi-planet navigation */}
        <div className="px-3 md:px-6 py-2">
          <PlanetTabs
            planets={gameState.planets}
            currentPlanetId={gameState.currentPlanetId}
            onPlanetSwitch={handlePlanetSwitch}
            onAddPlanet={handleAddPlanet}
            onEditPlanet={handleEditPlanet}
            maxPlanets={effectivePlanetLimit}
            onResetQueue={handleResetQueue}
          />
        </div>

        {activeShareMetadata && (
          <div className="px-3 md:px-6">
            <div className="max-w-[1800px] mx-auto rounded-lg border border-blue-400/30 bg-blue-950/30 px-4 py-3 text-sm text-blue-100 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="font-semibold uppercase tracking-wide text-blue-200">Shared list</span>
              <span className="font-bold text-pink-nebula-text">{activeShareMetadata.name}</span>
              <span className="text-blue-200/80">by {activeShareMetadata.author}</span>
              <span className="text-blue-200/60 sm:ml-auto">Opened from a shared link; save as mine from Saves → Shared.</span>
            </div>
          </div>
        )}

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
                      const metadata = requestShareMetadata();
                      if (!metadata) return;

                      const share = buildCurrentShareURL(metadata);
                      if (!share) {
                        setToast('No queued plan to share yet');
                        setTimeout(() => setToast(null), 3000);
                        return;
                      }
                      const { commandCount: cmds, url } = share;
                      navigator.clipboard.writeText(url).then(() => {
                        setToast(`Link copied — "${metadata.name}" by ${metadata.author}, ${cmds} command${cmds === 1 ? '' : 's'}`);
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
                    onClick={() => openExportModal('current')}
                    title="Export current planet data"
                  >
                    Export / Share
                  </button>
                  <button
                    onClick={() => openExportModal('full')}
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
                maxTurn={totalTurns - 1}
              />
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-pink-nebula-text-secondary pb-8 space-y-2">
          <button
            className="hover:text-pink-nebula-text transition-colors opacity-50 hover:opacity-100"
            onClick={() => {
              const share = buildCurrentShareURL(activeShareMetadata);
              if (share) {
                navigator.clipboard.writeText(share.url);
                alert('Debug URL copied to clipboard!');
              } else {
                alert('No state to copy yet.');
              }
            }}
            title="Copy URL with full command history to clipboard for bug reporting"
          >
            Copy Debug State
          </button>
          <div className="opacity-30 text-[10px]">v0.2.11</div>
        </footer>
      </div>

      {/* Export Modal - TICKET-5 */}
      {showExportModal !== null && exportSnapshot && (
        <ExportModal
          isOpen={true}
          onClose={() => {
            setShowExportModal(null);
            setExportSnapshot(null);
          }}
          buildingLane={exportSnapshot.buildingLane}
          shipLane={exportSnapshot.shipLane}
          colonistLane={exportSnapshot.colonistLane}
          currentTurn={exportSnapshot.currentTurn}
          exportMode={showExportModal}
        />
      )}

      {/* Add Planet Modal */}
      <AddPlanetModal
        isOpen={showAddPlanetModal}
        onClose={() => {
          setShowAddPlanetModal(false);
          setEditingPlanetId(null);
        }}
        onAddPlanet={handleCreatePlanet}
        currentTurn={planetModalTurn}
        mode={editingPlanetId ? 'edit' : 'add'}
        initialConfig={editingPlanetConfig}
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
