"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { GameController } from "../lib/game/commands";
import {
  createInitialGameState,
  addPlanet,
  updatePlanetConfig,
  removePlanet,
  canRemovePlanet,
  resetToHomeworld,
  switchPlanet,
  planPlanetExpansion,
  getLocalResearchGateForItem,
  refreshLocalResearchGates,
  type GameState,
  type ExtendedPlanetState,
} from "../lib/game/gameState";
import {
  getPlanetSummary,
  getLaneView,
  getWarnings,
  canQueueItem as validateQueueItem,
  getTurnsUntilHousingCap,
  getFirstEmptyTurns,
  getFirstFreeTurnForLane,
  type LaneView,
  type LaneEntry,
} from "../lib/game/selectors";
import {
  validateAllQueueItems,
  type QueueValidationResult,
  getValidationMessage,
  getDependentQueueItems,
  type DependentQueueItem,
} from "../lib/game/validation";
import { Timeline } from "../lib/game/state";
import { getDefs } from "../lib/sim/engine/defsRegistry";
import { computePlanetScore } from "../lib/game/scoring";
import type { LaneId, PlanetState } from "../lib/sim/engine/types";
import { canDemolish, createDemolishDef, DEMOLISH_PREFIX } from "../lib/game/demolish";
import { setupLogging } from "../lib/game/logging-utils";
import { getLogger } from "../lib/game/logger";
import {
  CommandHistory,
  buildCompactShareURL,
  buildShareURL,
  clearStateFromURL,
  decodeGameState,
  encodeCompactShareState,
  encodeGameState,
  extractPlanetConfigs,
  getEncodedStateFromURL,
  getPlanetIndex,
  getShareMetadataFromSnapshot,
  loadStateFromLocalStorage,
  loadStateFromURL,
  normaliseShareMetadata,
  replayCommands,
  saveEncodedStateToURL,
  type ReplayDrop,
  type ShareMetadata,
} from "../lib/game/urlState";
import { formatReplayDropNotice } from "../lib/game/replayNotice";
import { planOrderFromLane } from "../lib/game/queueReorder";
import { STARTING_PLANET_LIMIT } from "../lib/sim/rules/constants";
import {
  cancelGlobalResearch,
  canQueueGlobalResearch,
  getEarliestPlanetStartTurn,
  getGlobalResearchAtTurn,
  getGlobalResearchLaneView,
  getPlanetLimitAtTurn,
  getResearchCompletionTurns,
  queueGlobalResearch,
  queueGlobalResearchWait,
  reorderGlobalResearch,
} from "../lib/game/globalResearch";

// UI Components
import { HorizontalTimeline } from "../components/HorizontalTimeline";
import { PlanetDashboard } from "../components/PlanetDashboard";
import { TabbedLaneDisplay } from "../components/QueueDisplay/TabbedLaneDisplay";
import { TabbedItemGrid } from "../components/LaneBoard/TabbedItemGrid";
import { WarningsPanel } from "../components/WarningsPanel";
import { ExportModal } from "../components/ExportModal";
import { PlanetTabs } from "../components/PlanetTabs";
import {
  AddPlanetModal,
  type BestExpansionSource,
  type PlanetConfig,
} from "../components/AddPlanetModal";
import { LaneTabs } from "../components/LaneTabs";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LANE_CONFIG } from "../lib/constants/lanes";
import { formatScore } from "@/components/ui/resources";
import { Bug, Link2, ListOrdered, ListPlus, RotateCcw, Save, Upload } from "lucide-react";
import { DependencyWarningModal } from "../components/DependencyWarningModal";
import { PlanetActionsModal } from "../components/PlanetActionsModal";
import { SavesModal } from "../components/SavesModal";
import { BuildListSelector } from "../components/BuildListSelector";
import { SharedBuildListView } from "../components/SharedBuildListView";
import {
  clearAutosaveTimer,
  consumeRestoreIntent,
  prepareRestoreForReload,
  type AutosaveTimer,
} from "./restoreState";
import type { MultiPlanetExportData } from "../lib/export/formatters";
import {
  DEFAULT_EXPANSION_TRAVEL_CHOICE,
  type ExpansionTravelChoice,
  getExpansionTravelTime,
} from "../lib/constants/travel";

// Persistence
import {
  pushHistory,
  migrateLegacyLocalStorage,
  saveSharedLink,
} from "../lib/persistence/savesDb";
import { buildSaveSummary, buildSaveSummaryFromConfigs } from "../lib/persistence/saveSummary";

type LoadedGameSnapshot = NonNullable<ReturnType<typeof loadStateFromURL>>;
type RestoreOptions = { shared?: boolean };
const SHARE_AUTHOR_STORAGE_KEY = "florent_share_author";
const INFINITE_CONFLICT_URL = "https://www.infiniteconflict.com/";
const EXTENDED_VIEW_TURNS = 300;

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }

  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea?.remove();
  }
}

/**
 * Turn replay drops into the player-facing notice, naming planets in replay
 * order and items by their game-data names. Null when nothing was dropped.
 */
function buildReplayNotice(drops: ReplayDrop[], replayedState: GameState): string | null {
  if (drops.length === 0) return null;
  for (const drop of drops) {
    console.warn("[replay] skipped step rejected by current rules:", drop);
  }
  const planetNames = Array.from(replayedState.planets.values(), (planet) => planet.name);
  const defs = getDefs();
  const itemNames = Object.fromEntries(Object.keys(defs).map((id) => [id, defs[id].name]));
  return formatReplayDropNotice(drops, planetNames, itemNames);
}

function withPlanetMetadata(
  snapshot: PlanetState,
  existing: ExtendedPlanetState,
): ExtendedPlanetState {
  return {
    ...snapshot,
    id: existing.id,
    name: existing.name,
    startTurn: existing.startTurn,
    currentTurn: snapshot.currentTurn ?? existing.currentTurn,
    timeline: existing.timeline,
  } as ExtendedPlanetState;
}

// Scan all planets to find the earliest possible outpost-ship arrival at a new planet.
// HW uses 26T galaxy_to_galaxy travel; non-HW planets use 16T inside_galaxy travel.
// Reservation rule lives in gameState.ts (no ships reserved); keep this scanner in sync.
function getBestExpansionSource(
  gameState: GameState,
  upToTurn: number = 200,
): BestExpansionSource | null {
  const planetEntries = Array.from(gameState.planets.entries());
  let best: BestExpansionSource | null = null;

  for (let idx = 0; idx < planetEntries.length; idx++) {
    const [, planet] = planetEntries[idx];
    const isHomeworld = planet.id === 'planet-1';
    const reserved = 0;
    const travelChoice: ExpansionTravelChoice = isHomeworld
      ? 'galaxy_to_galaxy'
      : 'inside_galaxy';
    const travelTime = getExpansionTravelTime(travelChoice);

    const startTurn = planet.startTurn ?? 1;
    const endTurn = Math.min(upToTurn, planet.timeline
      ? planet.startTurn + planet.timeline.getTotalTurns() - 1
      : upToTurn);

    let departureTurn: number | null = null;
    for (let t = startTurn; t <= endTurn; t++) {
      const s = planet.timeline?.getStateAtTurn(t) ?? planet;
      if ((s?.completedCounts?.outpost_ship ?? 0) > reserved) {
        departureTurn = t;
        break;
      }
    }
    if (departureTurn === null) continue;

    const arrival = departureTurn + travelTime;
    const bestArrival = best
      ? best.departureTurn + getExpansionTravelTime(best.travelChoice)
      : Infinity;
    if (arrival < bestArrival) {
      best = { departureTurn, sourcePlanetIdx: idx, travelChoice };
    }
  }

  return best;
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
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(),
  );
  const [isMounted, setIsMounted] = useState(false);
  // Destructive actions wait here until the user confirms them in a ConfirmDialog.
  const [pendingConfirm, setPendingConfirm] = useState<
    { kind: "reset" } | { kind: "clear"; laneId: LaneId } | null
  >(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [activeShareMetadata, setActiveShareMetadata] =
    useState<ShareMetadata | null>(null);
  const [isSharedBuildPreviewOpen, setSharedBuildPreviewOpen] = useState(false);
  const [shareListName, setShareListName] = useState("");
  const [shareAuthor, setShareAuthor] = useState("");
  // Bootstrap-once guard: React StrictMode runs effects twice in dev; we only
  // want to restore state on the first mount, otherwise the second run replays
  // commands on top of the already-restored state and double-counts everything.
  const bootstrappedRef = useRef(false);
  const lastAppliedShareRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<AutosaveTimer | null>(null);
  const restoreInProgressRef = useRef(false);

  const rememberOpenedSharedLink = useCallback(
    (encoded: string, snapshot: LoadedGameSnapshot) => {
      const share =
        getShareMetadataFromSnapshot(snapshot) ??
        normaliseShareMetadata({
          name: "Shared build list",
          author: "Unknown commander",
          sharedAt: new Date().toISOString(),
        });
      setActiveShareMetadata(share);
      setSharedBuildPreviewOpen(true);
      if (!share) return;
      if (typeof window.indexedDB === "undefined") return;

      const summary = buildSaveSummary(encoded);
      saveSharedLink({
        encoded,
        name: share.name,
        author: share.author,
        summary,
      }).catch((e) => console.warn("[saves] shared link save failed:", e));
    },
    [],
  );

  // Persistent until dismissed: plan steps the current rules rejected on load
  const [replayNotice, setReplayNotice] = useState<string | null>(null);

  const restoreShareSnapshot = useCallback(
    (
      snapshot: LoadedGameSnapshot,
      encoded?: string | null,
      options?: RestoreOptions,
    ) => {
      // Show loading indicator first, then defer heavy replay work so the browser
      // gets a chance to paint the indicator before JS blocks the thread.
      setIsReplaying(true);
      setTimeout(() => {
        let replayedState: GameState = createInitialGameState();
        const drops: ReplayDrop[] = [];
        try {
          replayedState = replayCommands(
            createInitialGameState(),
            snapshot.cmds,
            (drop) => drops.push(drop),
          );
        } finally {
          setIsReplaying(false);
        }
        setReplayNotice(buildReplayNotice(drops, replayedState));
        commandHistory.loadFromSnapshot(snapshot.cmds);
        if (encoded && options?.shared) {
          rememberOpenedSharedLink(encoded, snapshot);
        } else {
          setActiveShareMetadata(null);
          setSharedBuildPreviewOpen(false);
        }
        setGameState(() => ({
          ...replayedState,
          planets: new Map(replayedState.planets),
        }));
      }, 0);
    },
    [commandHistory, rememberOpenedSharedLink],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setShareAuthor(
        window.localStorage.getItem(SHARE_AUTHOR_STORAGE_KEY) ?? "",
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!activeShareMetadata) return;
    setShareListName(activeShareMetadata.name);
    if (activeShareMetadata.author !== "Unknown commander") {
      setShareAuthor(activeShareMetadata.author);
    }
  }, [activeShareMetadata]);

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
      console.log("[URL State] Loading from URL:", {
        planets: urlSnapshot.planets.length,
        commands: urlSnapshot.cmds.length,
      });
    } else {
      urlSnapshot = loadStateFromLocalStorage();
      if (urlSnapshot) {
        console.log("[URL State] Loading from LocalStorage:", {
          planets: urlSnapshot.planets.length,
          commands: urlSnapshot.cmds.length,
        });
      }
    }

    if (urlSnapshot) {
      const restoreIntent = consumeRestoreIntent(encodedFromURL);
      const hasShareMetadata =
        getShareMetadataFromSnapshot(urlSnapshot) !== null;
      const shouldRememberSharedLink = Boolean(
        encodedFromURL &&
        (restoreIntent?.shared === true ||
          (!restoreIntent && hasShareMetadata)),
      );
      restoreShareSnapshot(urlSnapshot, encodedFromURL, {
        shared: shouldRememberSharedLink,
      });
    }
  }, [restoreShareSnapshot]);

  const [showAddPlanetModal, setShowAddPlanetModal] = useState(false);
  const [planetModalTurn, setPlanetModalTurn] = useState(1);
  const [editingPlanetId, setEditingPlanetId] = useState<string | null>(null);
  const [planetActionsId, setPlanetActionsId] = useState<string | null>(null);
  const [viewTurn, setViewTurn] = useState(1);
  const [isAutoJumpEnabled, setIsAutoJumpEnabled] = useState(true);
  const [waitCodeStage, setWaitCodeStage] = useState<0 | 1 | 2>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem('ic_wait_code_stage');
    const parsed = stored ? parseInt(stored, 10) : 0;
    return (parsed === 1 || parsed === 2) ? parsed as 0 | 1 | 2 : 0;
  });
  const [showWaitCodeModal, setShowWaitCodeModal] = useState(false);
  const [extendedViewUnlocked, setExtendedViewUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ic_extended_view') === 'true';
  });
  const [waitCodeCounts, setWaitCodeCounts] = useState(() => {
    if (typeof window === 'undefined') return { awoo: 0, aroo: 0 };
    try {
      const stored = localStorage.getItem('ic_wait_code_counts');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          awoo: typeof parsed.awoo === 'number' ? parsed.awoo : 0,
          aroo: typeof parsed.aroo === 'number' ? parsed.aroo : 0,
        };
      }
    } catch { /* ignore parse errors */ }
    return { awoo: 0, aroo: 0 };
  });
  const [error, setError] = useState<string | null>(null);
  const [queueValidation, setQueueValidation] = useState<
    Map<string, QueueValidationResult>
  >(new Map());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSavesModal, setShowSavesModal] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState<{
    buildingLane: LaneView;
    shipLane: LaneView;
    colonistLane: LaneView;
    researchLane: LaneView;
    currentTurn: number;
    multiPlanetData: MultiPlanetExportData;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "building" | "ship" | "colonist" | "research"
  >("building");
  // Mobile-only toggle between Build (Add to Queue) and Queue (Planet Queue) panels.
  // Both render side-by-side on md+ screens; on mobile only the active one is shown.
  const [mobileView, setMobileView] = useState<"build" | "queue">("build");
  useEffect(() => {
    if (activeShareMetadata) {
      setMobileView("queue");
    }
  }, [activeShareMetadata]);
  // Transient toast message; null when nothing to show. Auto-clears after 3s.
  const [toast, setToast] = useState<string | null>(null);
  const [pendingCancellation, setPendingCancellation] = useState<{
    laneId: "building" | "ship" | "colonist" | "research";
    entry: LaneEntry;
    brokenDependencies: DependentQueueItem[];
  } | null>(null);
  // Items auto-removed due to cascade dependency failure after a cancel
  const [cascadeWarnings, setCascadeWarnings] = useState<
    Array<{
      entryId: string;
      laneId: string;
      reason: string;
    }>
  >([]);

  const resetToCleanState = useCallback(
    (message?: string) => {
      commandHistory.clear();
      lastAppliedShareRef.current = null;
      setActiveShareMetadata(null);
      setSharedBuildPreviewOpen(false);
      setGameState(createInitialGameState());
      setViewTurn(1);
      setWaitCodeStage(0);
      setShowWaitCodeModal(false);
      setExtendedViewUnlocked(false);
      setWaitCodeCounts({ awoo: 0, aroo: 0 });
      localStorage.removeItem('ic_wait_code_stage');
      localStorage.removeItem('ic_extended_view');
      localStorage.removeItem('ic_wait_code_counts');
      setQueueValidation(new Map());
      setPendingCancellation(null);
      setCascadeWarnings([]);
      setError(null);
      clearStateFromURL();
      if (message) {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
      }
    },
    [commandHistory],
  );

  useEffect(() => {
    const handleHashChange = () => {
      const encoded = getEncodedStateFromURL();
      if (!encoded) {
        resetToCleanState("Build list reset");
        return;
      }
      if (encoded === lastAppliedShareRef.current) return;

      const snapshot = decodeGameState(encoded);
      if (!snapshot) {
        setError("Shared build link could not be loaded.");
        return;
      }

      lastAppliedShareRef.current = encoded;
      const restoreIntent = consumeRestoreIntent(encoded);
      const hasShareMetadata = getShareMetadataFromSnapshot(snapshot) !== null;
      const restoredAsShared =
        restoreIntent?.shared === true || (!restoreIntent && hasShareMetadata);
      restoreShareSnapshot(snapshot, encoded, {
        shared: restoredAsShared,
      });
      setToast(
        restoredAsShared
          ? "Shared build list loaded from link"
          : "Build list loaded from link",
      );
      setTimeout(() => setToast(null), 3000);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [resetToCleanState, restoreShareSnapshot]);

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
    migrateLegacyLocalStorage(buildSaveSummary).catch((e) =>
      console.warn("[saves] migration failed:", e),
    );
  }, []);

  // Auto-save to URL + IndexedDB history on state changes (debounced).
  useEffect(() => {
    if (restoreInProgressRef.current) return;
    clearAutosaveTimer(autosaveTimerRef);

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      if (restoreInProgressRef.current) return;

      try {
        const planetConfigs = extractPlanetConfigs(gameState);
        const commands = commandHistory.getCommands();

        // Only save if we have commands (don't save empty initial state)
        if (commands.length > 0) {
          const encoded = encodeGameState(
            planetConfigs,
            commands,
            activeShareMetadata,
          );
          saveEncodedStateToURL(encoded);
          lastAppliedShareRef.current = encoded;

          if (getLogger().isEnabled()) {
            console.log("[URL State] Saved:", {
              planets: planetConfigs.length,
              commands: commands.length,
              urlLength: window.location.href.length,
              encodedLength: encoded.length,
            });
          }

          // Push to IndexedDB ring buffer so the user can revert auto-saves.
          // pushHistory dedupes against the most-recent identical encoded payload.
          const summary = buildSaveSummaryFromConfigs(
            planetConfigs as Array<{ n?: string }>,
            commands,
            activeShareMetadata
          );
          pushHistory(encoded, summary).catch((e) =>
            console.warn("[saves] history push failed:", e),
          );
        }
      } catch (error) {
        console.error("[URL State] Failed to save:", error);
      }
    }, 1000); // Debounce: wait 1 second after last change

    return () => clearAutosaveTimer(autosaveTimerRef);
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

  useEffect(() => {
    if (waitCodeStage === 2 && viewTurn === 123 && !extendedViewUnlocked) {
      setShowWaitCodeModal(true);
    }
  }, [waitCodeStage, viewTurn, extendedViewUnlocked]);

  useEffect(() => {
    if (!extendedViewUnlocked) return;
    setGameState((prev) => {
      let changed = false;
      for (const planet of prev.planets.values()) {
        if (
          planet.timeline &&
          planet.timeline.getTotalTurns() < EXTENDED_VIEW_TURNS
        ) {
          planet.timeline.extendToTotalTurns(EXTENDED_VIEW_TURNS);
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, planets: new Map(prev.planets) };
    });
  }, [extendedViewUnlocked, gameState.planets]);

  // Persist easter egg state to localStorage
  useEffect(() => {
    localStorage.setItem('ic_wait_code_stage', String(waitCodeStage));
  }, [waitCodeStage]);

  useEffect(() => {
    localStorage.setItem('ic_extended_view', String(extendedViewUnlocked));
  }, [extendedViewUnlocked]);

  useEffect(() => {
    localStorage.setItem('ic_wait_code_counts', JSON.stringify(waitCodeCounts));
  }, [waitCodeCounts]);

  const totalTurns = controller?.getTotalTurns() || 200;
  const planetTimelineEndTurn = currentPlanet
    ? currentPlanet.startTurn + totalTurns - 1
    : totalTurns;
  const timelineMaxTurn = Math.max(
    extendedViewUnlocked ? EXTENDED_VIEW_TURNS : 200,
    planetTimelineEndTurn,
    viewTurn,
  );
  const currentPlanetNumber = useMemo(() => {
    if (!currentPlanet) return 0;
    return Array.from(gameState.planets.keys()).indexOf(currentPlanet.id) + 1;
  }, [currentPlanet, gameState.planets]);
  const planetLimitAtStart = useMemo(() => {
    if (!currentPlanet) return 0;
    return getPlanetLimitAtTurn(gameState, currentPlanet.startTurn);
  }, [gameState, currentPlanet]);

  // Expensive scan (all planets × timeline) — only recompute when the planet
  // set changes, not on every keystroke/slider tick.
  const expansionSource = useMemo(
    () => getBestExpansionSource(gameState),
    [gameState],
  );
  const planetUnavailableReason = useMemo(() => {
    if (!currentPlanet) return "No planet selected.";
    if (currentPlanetNumber > STARTING_PLANET_LIMIT && currentPlanetNumber > planetLimitAtStart) {
      return `${currentPlanet.name} is blocked by planet-limit research at T${currentPlanet.startTurn}.`;
    }
    if (viewTurn < currentPlanet.startTurn) {
      return `${currentPlanet.name} starts on T${currentPlanet.startTurn} and does not exist yet at T${viewTurn}.`;
    }
    if (!currentState) {
      return `${currentPlanet.name} has no simulated state at T${viewTurn}.`;
    }
    return null;
  }, [
    currentPlanet,
    currentPlanetNumber,
    planetLimitAtStart,
    viewTurn,
    currentState,
  ]);
  const isPlanetViewAvailable = planetUnavailableReason === null;

  const defs = getDefs();

  // Global score across all planets (structures + ships + colonists)
  const globalScore = useMemo(() => {
    let total = 0;
    for (const [, planet] of gameState.planets) {
      if (viewTurn < planet.startTurn) continue;
      const planetState = planet.timeline?.getStateAtTurn(viewTurn);
      if (!planetState) continue;
      const planetSummary = getPlanetSummary(planetState);
      total += computePlanetScore(planetSummary, defs);
    }
    return total;
  }, [gameState.planets, viewTurn, defs]);

  const globalResearch = useMemo(
    () => getGlobalResearchAtTurn(gameState, viewTurn),
    [gameState, viewTurn],
  );
  const researchCompletionTurns = useMemo(
    () => getResearchCompletionTurns(gameState),
    [gameState],
  );
  const effectivePlanetLimit = useMemo(
    () => globalResearch.planetLimit,
    [globalResearch.planetLimit],
  );

  // Helper: Enrich resource-delayed entries with the specific missing-resource text.
  // Called after enrichEntriesWithValidation so both passes are independent.
  const enrichEntriesWithDelay = useCallback(
    (entries: LaneEntry[]): LaneEntry[] => {
      if (!controller) return entries;
      // Fast path: return original reference when no entries need enrichment.
      // Preserves referential equality for downstream useMemos.
      if (!entries.some(e => e.resourceDelayed)) return entries;
      return entries.map((entry, i) => {
        if (!entry.resourceDelayed) return entry;
        const prevEntry = entries[i - 1];
        if (!prevEntry?.isAutoWait) return entry;
        const gapTurn = prevEntry.startTurn;
        if (gapTurn === undefined) return entry;
        const stateAtGap = controller.getStateAtTurn(gapTurn);
        if (!stateAtGap) return entry;
        const def = getDefs()[entry.itemId];
        const costs = (def?.costsPerUnit ?? {}) as unknown as Record<string, number>;
        const stocks = stateAtGap.stocks as unknown as Record<string, number>;
        const qty = entry.quantity;

        const resLabel: Record<string, string> = {
          metal: 'Metal', mineral: 'Mineral', food: 'Food',
          energy: 'Energy', research_points: 'Research',
        };

        const lacking: string[] = [];
        for (const [res, costPerUnit] of Object.entries(costs)) {
          if (res === 'workers' || typeof costPerUnit !== 'number' || costPerUnit <= 0) continue;
          const needed = costPerUnit * qty;
          const have = stocks[res] ?? 0;
          if (have < needed) {
            lacking.push(`${resLabel[res] ?? res}: need ${needed}, have ${Math.floor(have)}`);
          }
        }
        if (typeof costs.workers === 'number' && costs.workers > 0) {
          const needed = costs.workers * qty;
          const have = stateAtGap.population?.workersIdle ?? 0;
          if (have < needed) lacking.push(`Workers: need ${needed}, have ${have}`);
        }

        const reason = lacking.length > 0
          ? `Can't start on time — ${lacking.join('; ')}`
          : 'Waiting for resources to accumulate';
        return { ...entry, resourceDelayReason: reason };
      });
    },
    [controller],
  );

  // Helper: Enrich lane entries with validation state
  const enrichEntriesWithValidation = useCallback(
    (entries: any[]) => {
      // Fast path: return original reference when there's nothing to enrich.
      if (queueValidation.size === 0) return entries;
      return entries.map((entry) => {
        const validation = queueValidation.get(entry.id);
        if (!validation) {
          return entry; // No validation data, return as-is
        }

        return {
          ...entry,
          invalid: !validation.valid,
          invalidReason: validation.reason
            ? getValidationMessage(validation)
            : undefined,
          missingPrereqs: validation.missingPrereqs,
        };
      });
    },
    [queueValidation],
  );

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
      queueLength: globalResearch.queueLength,
      completedResearch: globalResearch.completed,
    };
  }, [currentState, globalResearch]);

  // To display the full queue regardless of the turn slider, read a simulated
  // future state so delayed prerequisites have their actual start/completion turns.
  const fullPlanState = useMemo(() => {
    if (!controller) return undefined;
    return controller.getStateAtTurn(planetTimelineEndTurn);
    // The controller mutates its timeline outside React; gameState is a deliberate cache-busting dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, planetTimelineEndTurn, gameState]);

  // Reorder commands edit the plan at its start, so drag/arrow targets use that queue order
  // rather than row statuses at the viewed turn (which may be past the whole queue).
  const reorderPlan = useMemo(() => {
    if (activeTab === "research") return planOrderFromLane(gameState.globalResearch.lane, true);
    const lane = controller?.getStateAtTurn(planTurn)?.lanes[activeTab];
    return lane ? planOrderFromLane(lane, false) : null;
    // gameState is a deliberate cache-busting dep: the controller mutates its timeline outside React.
  }, [controller, planTurn, activeTab, gameState]);

  // Helper to adjust the status of the global queue items relative to the current viewTurn
  const getAdjustedLaneView = useCallback(
    (laneId: "building" | "ship" | "colonist" | "research") => {
      if (!fullPlanState) return null;
      const view = getLaneView(fullPlanState, laneId);

      // Return a NEW view — mutating the selector result would corrupt any
      // other consumer holding the same object.
      return {
        ...view,
        entries: view.entries.map((entry) => {
          let status = entry.status;
          const start = entry.startTurn ?? entry.queuedTurn ?? 0;
          const finish = entry.completionTurn ?? entry.eta ?? 999;

          if (finish <= viewTurn) {
            status = "completed";
          } else if (start <= viewTurn && viewTurn < finish) {
            status = "active";
          } else {
            status = "pending";
          }
          return { ...entry, status };
        }),
      };
    },
    [fullPlanState, viewTurn],
  );

  const buildingLane = useMemo(
    () => getAdjustedLaneView("building"),
    [getAdjustedLaneView],
  );
  const shipLane = useMemo(
    () => getAdjustedLaneView("ship"),
    [getAdjustedLaneView],
  );
  const colonistLane = useMemo(
    () => getAdjustedLaneView("colonist"),
    [getAdjustedLaneView],
  );
  const globalResearchLane = useMemo(
    () => getGlobalResearchLaneView(gameState, viewTurn),
    [gameState, viewTurn],
  );

  const currentBuilds = useMemo(() => {
    const formatActiveItem = (
      item: PlanetState["lanes"][LaneId]["active"] | LaneView["entries"][number] | null | undefined,
      defs: Record<string, { name?: string }>
    ) => {
      if (!item) return null;
      if (item.isWait) {
        const turns = Math.max(1, item.turnsRemaining ?? 1);
        return `Wait ${turns}T`;
      }
      const name = defs[item.itemId]?.name || item.itemId;
      return item.quantity > 1 ? `${name} ×${item.quantity}` : name;
    };
    const planetDefs = getDefs();
    const researchActive = globalResearchLane?.entries.find(
      (entry) => entry.status === "active",
    );

    return {
      building: formatActiveItem(currentState?.lanes.building.active, planetDefs),
      ship: formatActiveItem(currentState?.lanes.ship.active, planetDefs),
      colonist: formatActiveItem(currentState?.lanes.colonist.active, planetDefs),
      research: formatActiveItem(researchActive, planetDefs),
    };
  }, [currentState, globalResearchLane]);

  const warnings = useMemo(
    () => (currentState ? getWarnings(currentState) : []),
    [currentState],
  );

  // Merge engine warnings with cascade-removal warnings into a single list for the panel.
  // Cascade warnings are reset on next cancellation, so they auto-clear on next user action.
  const allWarnings = useMemo(() => {
    const cascadeItems = cascadeWarnings.map((w) => ({
      type: "QUEUE_CASCADE_REMOVAL" as const,
      message: `Auto-removed: ${w.reason}`,
      severity: "warning" as const,
    }));
    return [...warnings, ...cascadeItems];
  }, [warnings, cascadeWarnings]);

  // Calculate first empty turn for each lane (for timeline quick jump buttons).
  // gameState is intentionally a dep so queue mutations re-evaluate (controller mutates
  // its timeline outside React's awareness — same pattern as currentState/fullPlanState).
  const firstEmptyTurns = useMemo(() => {
    if (!controller) return { building: null, ship: null, colonist: null };
    const getState = (turn: number) => controller.getStateAtTurn(turn);
    return getFirstEmptyTurns(getState, planTurn, planetTimelineEndTurn);
    // The controller mutates its timeline outside React; gameState is a deliberate cache-busting dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, planetTimelineEndTurn, gameState, planTurn]);

  // Enrich all lanes with validation state in a single useMemo
  const enrichedLanes = useMemo(
    () => ({
      building: buildingLane
        ? {
            ...buildingLane,
            entries: enrichEntriesWithDelay(enrichEntriesWithValidation(buildingLane.entries)),
          }
        : null,
      ship: shipLane
        ? {
            ...shipLane,
            entries: enrichEntriesWithDelay(enrichEntriesWithValidation(shipLane.entries)),
          }
        : null,
      colonist: colonistLane
        ? {
            ...colonistLane,
            entries: enrichEntriesWithDelay(enrichEntriesWithValidation(colonistLane.entries)),
          }
        : null,
      research: globalResearchLane
        ? {
            ...globalResearchLane,
            entries: enrichEntriesWithDelay(enrichEntriesWithValidation(globalResearchLane.entries)),
          }
        : null,
    }),
    [
      buildingLane,
      shipLane,
      colonistLane,
      globalResearchLane,
      enrichEntriesWithValidation,
      enrichEntriesWithDelay,
    ],
  );

  // Destructure for backward compatibility
  const {
    building: enrichedBuildingLane,
    ship: enrichedShipLane,
    colonist: enrichedColonistLane,
    research: enrichedResearchLane,
  } = enrichedLanes;

  // Live count of non-completed queue items across all lanes (used in header badge)
  const totalQueuedItems = useMemo(() => {
    const countNonCompleted = (lane: typeof enrichedBuildingLane) =>
      lane ? lane.entries.filter((e) => e.status !== "completed").length : 0;
    return (
      countNonCompleted(enrichedLanes.building) +
      countNonCompleted(enrichedLanes.ship) +
      countNonCompleted(enrichedLanes.colonist) +
      countNonCompleted(enrichedLanes.research)
    );
  }, [enrichedLanes]);

  // Turn deck spectrum: the inclusive turn span of every non-wait queue entry, per lane.
  const laneSpans = useMemo(() => {
    const toSpans = (lane: LaneView | null | undefined) =>
      (lane?.entries ?? []).flatMap((entry) => {
        const start = entry.startTurn ?? entry.queuedTurn;
        const end = entry.completionTurn ?? entry.eta;
        if (entry.isWait || entry.isAutoWait || start == null || end == null) return [];
        const label = entry.quantity > 1 ? `${entry.itemName} ×${entry.quantity}` : entry.itemName;
        return [{ start, end, label }];
      });
    return {
      building: toSpans(enrichedLanes.building),
      ship: toSpans(enrichedLanes.ship),
      colonist: toSpans(enrichedLanes.colonist),
      research: toSpans(enrichedLanes.research),
    };
  }, [enrichedLanes]);

  // Get available items for each lane - must be before early return
  const availableItems = useMemo(() => {
    const items: Record<string, any> = {};
    Object.entries(defs).forEach(([id, def]) => {
      items[id] = def;
    });
    return items;
  }, [defs]);

  // Set of structure IDs that are safe to schedule for demolition at the current view.
  const demolishableIds = useMemo((): ReadonlySet<string> => {
    if (!currentState) return new Set();
    return new Set(
      Object.keys(currentState.completedCounts).filter((id) =>
        !id.startsWith(DEMOLISH_PREFIX) && canDemolish(id, currentState, defs)
      )
    );
  }, [currentState, defs]);

  // canQueueItem callback - must be before early return
  // Uses smart first-free-turn validation: evaluates the item against the state
  // at the turn when it would actually activate, not hardcoded T1.
  const canQueueItem = useCallback(
    (itemId: string, quantity: number) => {
      if (!itemId) {
        return {
          allowed: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          blockers: [],
          reason: "No item selected",
        };
      }

      const def = defs[itemId];
      if (!def) {
        return {
          allowed: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          blockers: [],
          reason: "Unknown item",
        };
      }

      if (!controller) {
        return {
          allowed: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          blockers: [],
          reason: "No controller available",
        };
      }

      if (def.lane === "research") {
        const check = canQueueGlobalResearch(gameState, itemId);
        return {
          allowed: check.allowed,
          canQueueEventually: check.allowed,
          waitTurnsNeeded: 0,
          blockers: check.allowed
            ? []
            : [
                {
                  type: "PREREQUISITE",
                  message: check.reason || "Cannot queue research",
                },
              ],
          reason: check.reason === "REQ_MISSING" ? "REQ_MISSING" : check.reason,
        };
      }

      if (!isPlanetViewAvailable) {
        return {
          allowed: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          blockers: [],
          reason:
            planetUnavailableReason || "Planet is not active at this turn",
        };
      }

      // Get the T1 state (where the full plan lives) to calculate first-free turn
      const t1State = controller.getStateAtTurn(planTurn);
      if (!t1State) {
        return {
          allowed: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          blockers: [],
          reason: "Invalid turn",
        };
      }

      // Find the first turn when this lane will be free to activate the item
      const firstFreeTurn = getFirstFreeTurnForLane(t1State, def.lane);

      // Validate against the state at that future turn (or T1 if lane is empty)
      const validationTurn = Math.max(1, firstFreeTurn);
      const baseValidationState =
        controller.getStateAtTurn(validationTurn) ?? t1State;
      const researchGate = getLocalResearchGateForItem(
        gameState,
        itemId,
        validationTurn,
        defs,
        researchCompletionTurns,
      );
      if (researchGate.blockedResearch.length > 0) {
        return {
          allowed: false,
          canQueueEventually: false,
          waitTurnsNeeded: 0,
          blockers: [],
          reason: "REQ_MISSING",
        };
      }

      const researchReadyTurn = researchGate.minStartTurn;
      const validationState = {
        ...baseValidationState,
        completedResearch: Array.from(
          new Set([
            ...(baseValidationState.completedResearch || []),
            ...researchGate.completedResearch,
            ...researchGate.scheduledResearch,
          ]),
        ),
      };

      const baseResult = validateQueueItem(validationState, itemId, quantity);
      let finalResult = baseResult;
      if (
        researchReadyTurn !== undefined &&
        researchReadyTurn > validationTurn &&
        baseResult.canQueueEventually !== false
      ) {
        const turnsUntilReady = researchReadyTurn - validationTurn;
        finalResult = {
          ...baseResult,
          allowed: false,
          canQueueEventually: true,
          waitTurnsNeeded: Math.max(
            baseResult.waitTurnsNeeded ?? 0,
            turnsUntilReady,
          ),
          blockers: [
            ...(baseResult.blockers || []),
            {
              type: "PREREQUISITE",
              turnsUntilReady,
              message: `Waiting for scheduled research (${turnsUntilReady} turns)`,
            },
          ],
        };
      }

      // waitTurnsNeeded is measured from firstFreeTurn (the turn AFTER the last
      // queue item finishes). The user wants the gap between the last item's
      // completion turn and the new item's start, which is waitTurnsNeeded + 1
      // when the lane is non-empty. Empty-lane case (firstFreeTurn === currentTurn)
      // is already correct.
      const laneHasItems = firstFreeTurn > (t1State.currentTurn ?? planTurn);
      if (laneHasItems && (finalResult.waitTurnsNeeded ?? 0) > 0) {
        finalResult = {
          ...finalResult,
          waitTurnsNeeded: (finalResult.waitTurnsNeeded ?? 0) + 1,
        };
      }

      return finalResult;
    },
    [
      defs,
      controller,
      gameState,
      researchCompletionTurns,
      planTurn,
      isPlanetViewAvailable,
      planetUnavailableReason,
    ],
  );

  const editingPlanetConfig = useMemo<PlanetConfig | undefined>(() => {
    if (!editingPlanetId) return undefined;
    const planet = gameState.planets.get(editingPlanetId);
    if (!planet) return undefined;

    const initialState =
      planet.timeline?.getStateAtTurn(planet.startTurn) ?? planet;
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
          mineral_extractor:
            initialState.completedCounts.mineral_extractor ?? 0,
          farm: initialState.completedCounts.farm ?? 0,
          solar_generator: initialState.completedCounts.solar_generator ?? 0,
        },
      },
    };
  }, [editingPlanetId, gameState.planets]);

  // Planet management handlers
  const handlePlanetSwitch = useCallback(
    (planetId: string) => {
      if (!planetId || !gameState.planets.has(planetId)) {
        setError(`Planet ${planetId || "unknown"} does not exist`);
        return;
      }
      // Sync viewTurn BEFORE switching to avoid render timing issues
      const planet = gameState.planets.get(planetId);
      if (planet) {
        setViewTurn(planet.currentTurn);
      }
      setGameState((prev) => switchPlanet(prev, planetId));
    },
    [gameState],
  );

  const handleAddPlanet = useCallback(() => {
    setError(null);
    const nextPlanetNumber = gameState.planets.size + 1;
    if (nextPlanetNumber <= 4) {
      setEditingPlanetId(null);
      setPlanetModalTurn(viewTurn);
      setShowAddPlanetModal(true);
      return;
    }
    const earliestTurn = getEarliestPlanetStartTurn(
      gameState,
      nextPlanetNumber,
      viewTurn,
    );
    if (earliestTurn === null) {
      setError(
        `Planet limit ${nextPlanetNumber} is not unlocked or scheduled in the research queue.`,
      );
      return;
    }
    setEditingPlanetId(null);
    setPlanetModalTurn(Math.max(viewTurn, earliestTurn));
    setShowAddPlanetModal(true);
  }, [gameState, viewTurn]);

  const handleEditPlanet = useCallback(
    (planetId: string) => {
      if (planetId === "planet-1") return;
      const planet = gameState.planets.get(planetId);
      if (!planet) return;
      setError(null);
      setPlanetActionsId(planetId);
    },
    [gameState.planets],
  );

  const handleOpenModifyPlanet = useCallback(
    (planetId: string) => {
      const planet = gameState.planets.get(planetId);
      if (!planet) return;
      setPlanetActionsId(null);
      setEditingPlanetId(planetId);
      setPlanetModalTurn(planet.startTurn);
      setShowAddPlanetModal(true);
    },
    [gameState.planets],
  );

  const handleDeletePlanet = useCallback(
    (planetId: string) => {
      try {
        const planetIdx = Array.from(gameState.planets.keys()).indexOf(planetId);
        const newGameState = removePlanet(gameState, planetId);
        commandHistory.recordDeletePlanet(planetIdx);
        setPlanetActionsId(null);
        setGameState(newGameState);
      } catch (e) {
        setError((e as Error).message || "Failed to remove planet");
        setPlanetActionsId(null);
      }
    },
    [gameState, commandHistory],
  );

  const handleCreatePlanet = useCallback(
    (config: PlanetConfig) => {
      try {
        if (editingPlanetId) {
          const updated = updatePlanetConfig(
            gameState,
            editingPlanetId,
            config,
          );
          const planetIdx = getPlanetIndex(gameState, editingPlanetId);
          commandHistory.recordEditPlanet(planetIdx, config);
          setViewTurn(config.startTurn);
          setGameState(updated);
          setEditingPlanetId(null);
          return true;
        }
        const nextPlanetNumber = gameState.planets.size + 1;
        let adjustedConfig = config;
        if (nextPlanetNumber > 4) {
          const earliestTurn = getEarliestPlanetStartTurn(
            gameState,
            nextPlanetNumber,
            config.startTurn,
          );
          adjustedConfig =
            earliestTurn !== null && config.startTurn < earliestTurn
              ? { ...config, startTurn: earliestTurn }
              : config;
        }
        // Use the best source from the modal's computed expansion source if available
        const expansionBase = adjustedConfig.expansion ?? {
          travelChoice: DEFAULT_EXPANSION_TRAVEL_CHOICE,
        };
        adjustedConfig = planPlanetExpansion(
          gameState,
          {
            ...adjustedConfig,
            expansion: expansionBase,
          },
          currentPlanetId,
        ).config;
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
        setError((e as Error).message || "Failed to create planet");
        return false;
      }
    },
    [gameState, editingPlanetId, commandHistory, currentPlanetId],
  );

  // Command handlers
  const handleQueueItem = useCallback(
    (itemId: string, quantity: number) => {
      setError(null);
      if (!currentPlanet || !controller) {
        setError("No planet selected");
        return;
      }

      try {
        const def = defs[itemId];
        if (def?.lane === "research") {
          const nextState = queueGlobalResearch(gameState, itemId);
          const queuedEntry =
            nextState.globalResearch.lane.pendingQueue[
              nextState.globalResearch.lane.pendingQueue.length - 1
            ];
          if (queuedEntry)
            commandHistory.recordQueueResearch(itemId, queuedEntry.id);
          setGameState(refreshLocalResearchGates(nextState));
          return;
        }

        if (!isPlanetViewAvailable) {
          setError(
            planetUnavailableReason || "Planet is not active at this turn",
          );
          return;
        }

        const researchGate = getLocalResearchGateForItem(
          gameState,
          itemId,
          planTurn,
          defs,
          researchCompletionTurns,
        );
        const missingUnscheduled = researchGate.blockedResearch[0];
        if (missingUnscheduled) {
          setError(
            `Missing research prerequisite: ${defs[missingUnscheduled]?.name || missingUnscheduled}`,
          );
          return;
        }

        const result = controller.queueItem(planTurn, itemId, quantity, {
          completedResearch: researchGate.completedResearch,
          scheduledResearch: researchGate.scheduledResearch,
          blockedResearch: researchGate.blockedResearch,
          minStartTurn: researchGate.minStartTurn,
        });
        if (!result.success) {
          setError(result.reason || "Cannot queue item");
          return;
        }

        // Record command for URL encoding (pass entryId so cancel commands can reference it)
        const planetIdx = getPlanetIndex(gameState, currentPlanetId);
        commandHistory.recordQueue(
          planetIdx,
          itemId,
          quantity,
          result.itemId ?? "",
        );

        // Update the planet in game state
        const updatedPlanet = controller.getStateAtTurn(viewTurn);
        if (updatedPlanet) {
          setGameState((prev) => {
            const newPlanets = new Map(prev.planets);
            const existing = newPlanets.get(gameState.currentPlanetId);
            if (existing)
              newPlanets.set(
                gameState.currentPlanetId,
                withPlanetMetadata(updatedPlanet, existing),
              );
            return { ...prev, planets: newPlanets };
          });
        }

        // AUTO-ADVANCE: Move to the completion turn of the item we just added
        // Shows the turn immediately following the new structure's completion
        if (isAutoJumpEnabled && def && result.itemId) {
          const displayState = controller.getStateAtTurn(planetTimelineEndTurn);
          if (displayState) {
            const laneView = getLaneView(displayState, def.lane);
            const newlyAdded = laneView.entries.find(
              (e) => e.id === result.itemId,
            );
            if (newlyAdded) {
              const endTurn =
                newlyAdded.completionTurn ?? newlyAdded.eta ?? viewTurn;
              setViewTurn(Math.min(endTurn + 1, planetTimelineEndTurn));
            }
          }
        }
      } catch (e) {
        console.error("Error in handleQueueItem:", e);
        setError((e as Error).message || "Unknown error");
      }
    },
    [
      currentPlanet,
      currentPlanetId,
      controller,
      defs,
      viewTurn,
      gameState,
      commandHistory,
      isAutoJumpEnabled,
      researchCompletionTurns,
      planetTimelineEndTurn,
      planTurn,
      isPlanetViewAvailable,
      planetUnavailableReason,
    ],
  );

  const handleDemolish = useCallback(
    (structureId: string) => {
      if (!controller || !currentState) return;
      const def = defs[structureId];
      if (!def) return;

      // Register the synthetic demolish def so the engine can look it up for
      // worker reservation, validation, and completion handling.
      const demolishDef = createDemolishDef(structureId, defs);

      controller.injectDef(planTurn, demolishDef);

      // Queue the demolish item (prerequisites: [structureId] keeps it waiting
      // in the queue until the target building actually exists at that point).
      const result = controller.queueItem(planTurn, demolishDef.id, 1);
      if (result.success) {
        setGameState((prev) => ({ ...prev }));
      } else {
        setError(`Cannot queue demolition: ${result.reason ?? 'unknown error'}`);
      }
    },
    [controller, currentState, defs, planTurn],
  );

  const recordWaitCodeAttempt = useCallback((waitTurns: number) => {
    setWaitCodeStage((stage) => {
      if (waitTurns === 99) return 1;
      if (waitTurns === 67 && stage === 1) return 2;
      return 0;
    });
  }, []);

  const handleQueueWait = useCallback(
    (
      laneId: "building" | "ship" | "colonist" | "research",
      waitTurns: number,
    ) => {
      setError(null);
      if (!currentPlanet || !controller) {
        setError("No planet selected");
        return;
      }

      try {
        if (laneId === "research") {
          setGameState((prev) => {
            const nextState = queueGlobalResearchWait(prev, waitTurns);
            const queuedEntry =
              nextState.globalResearch.lane.pendingQueue[
                nextState.globalResearch.lane.pendingQueue.length - 1
              ];
            if (queuedEntry)
              commandHistory.recordQueueResearchWait(waitTurns, queuedEntry.id);
            return refreshLocalResearchGates(nextState);
          });
          recordWaitCodeAttempt(waitTurns);
          return;
        }

        const result = controller.queueWaitItem(
          planTurn,
          laneId,
          waitTurns,
          false,
        );
        if (!result.success) {
          setError(result.reason || "Cannot queue wait item");
          return;
        }

        const planetIdx = getPlanetIndex(gameState, currentPlanetId);
        commandHistory.recordQueueWait(
          Math.max(0, planetIdx),
          laneId,
          waitTurns,
          result.itemId ?? "",
        );
        recordWaitCodeAttempt(waitTurns);

        // Update the planet in game state
        const updatedPlanet = controller.getStateAtTurn(viewTurn);
        if (updatedPlanet) {
          setGameState((prev) => {
            const newPlanets = new Map(prev.planets);
            const existing = newPlanets.get(gameState.currentPlanetId);
            if (existing)
              newPlanets.set(
                gameState.currentPlanetId,
                withPlanetMetadata(updatedPlanet, existing),
              );
            return { ...prev, planets: newPlanets };
          });
        }
      } catch (e) {
        console.error("Error in handleQueueWait:", e);
        setError((e as Error).message || "Unknown error");
      }
    },
    [
      currentPlanet,
      currentPlanetId,
      controller,
      viewTurn,
      gameState,
      commandHistory,
      planTurn,
      recordWaitCodeAttempt,
    ],
  );

  const handleWaitCodeChoice = useCallback((choice: "awoo" | "aroo") => {
    setWaitCodeCounts((counts) => ({
      ...counts,
      [choice]: counts[choice] + 1,
    }));
    setExtendedViewUnlocked(true);
  }, []);

  // Core execution function to instantly cancel and auto-collapse queues
  const executeCancellation = useCallback(
    (laneId: "building" | "ship" | "colonist" | "research", entry: any) => {
      if (laneId === "research") {
        commandHistory.recordCancel(0, laneId, entry.id);
        setGameState((prev) =>
          refreshLocalResearchGates(cancelGlobalResearch(prev, entry.id)),
        );
        return;
      }

      // Check if it's the last item before we cancel it
      let wasLastItem = false;
      const maxTurn = planetTimelineEndTurn;
      const preCancelState = controller!.getStateAtTurn(maxTurn);
      if (preCancelState) {
        const laneView = getLaneView(preCancelState, laneId);
        if (
          laneView.entries.length > 0 &&
          laneView.entries[laneView.entries.length - 1].id === entry.id
        ) {
          wasLastItem = true;
        }
      }

      // Cancel the item from the plan (T1 state) — works regardless of timeline position
      const result = controller!.cancelPlannedItem(laneId, entry.id);

      if (!result.success) {
        if (result.reason === "NOT_FOUND") {
          setError(
            "Item cannot be canceled (may be completed or non-existent)",
          );
        } else {
          setError(result.reason || "Cannot cancel item");
        }
        return;
      }

      // Record cancel in command history so URL sharing replays it correctly
      const planetIdx = Array.from(gameState.planets.keys()).indexOf(
        gameState.currentPlanetId,
      );
      commandHistory.recordCancel(Math.max(0, planetIdx), laneId, entry.id);

      // Repack ALL lanes (not just the cancelled lane) so cross-lane dependencies
      // (e.g. a colonist waiting on a building prerequisite) are updated too.
      controller!.repackAllLanes(planTurn);

      // BFS cascade: remove items whose prerequisites include the cancelled item's def ID
      // (and transitively, items that depended on those).
      // This is purely based on the prerequisites graph — NO timing re-checks,
      // which previously caused unrelated items to be incorrectly swept away.
      const newCascadeWarnings: Array<{
        entryId: string;
        laneId: string;
        reason: string;
      }> = [];
      const cancelledDefIds = new Set<string>([entry.itemId]);
      const allLaneIds: Array<"building" | "ship" | "colonist" | "research"> = [
        "building",
        "ship",
        "colonist",
        "research",
      ];

      // Batch all cascade cancels so only one recomputeAll fires at the end.
      // Safe because BFS only reads planTurn state (directly mutated by mutateAtTurn),
      // not future-turn simulated state.
      controller!.withBatch(() => {
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
              const qDef = getDefs()[qEntry.itemId];
              if (!qDef) continue;

              // Only cascade if a prerequisite of this entry was directly cancelled
              const hasCancelledPrereq = qDef.prerequisites?.some((p) =>
                cancelledDefIds.has(p),
              );
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
      });

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
        setGameState((prev) => {
          const newPlanets = new Map(prev.planets);
          const existing = newPlanets.get(gameState.currentPlanetId);
          if (existing)
            newPlanets.set(
              gameState.currentPlanetId,
              withPlanetMetadata(updatedPlanet, existing),
            );
          return { ...prev, planets: newPlanets };
        });
        // Validate all remaining queue items after removal and cascade
        const getLaneEntries = (
          state: any,
          lId: "building" | "ship" | "colonist" | "research",
        ) => {
          return getLaneView(state, lId).entries;
        };

        const validationResults = validateAllQueueItems(
          updatedPlanet,
          getLaneEntries,
        );

        // Convert validation results to Map for efficient lookup
        const validationMap = new Map<string, QueueValidationResult>();
        for (const res of validationResults) {
          validationMap.set(res.entryId, res);
        }

        setQueueValidation(validationMap);
      }
    },
    [
      controller,
      viewTurn,
      gameState,
      setGameState,
      commandHistory,
      planTurn,
      planetTimelineEndTurn,
      currentPlanet?.startTurn,
      isAutoJumpEnabled,
    ],
  );

  const confirmPendingCancellation = useCallback(() => {
    if (!pendingCancellation || !controller) return;

    // Cancel all broken dependencies (most recent future ones first is safest to avoid weird chronological cascading bugs, though GameController handles it robustly)
    const sortedBroken = [...pendingCancellation.brokenDependencies].sort(
      (a, b) => (b.entry.queuedTurn || 0) - (a.entry.queuedTurn || 0),
    );

    for (const dep of sortedBroken) {
      controller.cancelPlannedItem(
        dep.laneId as "building" | "ship" | "colonist" | "research",
        dep.entry.id,
      );
    }

    // Finally cancel the root element the user actually clicked
    executeCancellation(pendingCancellation.laneId, pendingCancellation.entry);

    // Close modal
    setPendingCancellation(null);
  }, [pendingCancellation, controller, executeCancellation]);

  const handleCancelItem = useCallback(
    (laneId: "building" | "ship" | "colonist" | "research", entry: any) => {
      setError(null);
      if (laneId === "research") {
        executeCancellation(laneId, entry);
        return;
      }
      if (!controller) {
        setError("No planet selected");
        return;
      }

      try {
        // 1. Dependency Analysis for prerequisites — run against the VIEW turn's
        // state, i.e. exactly the queue the user sees and is mutating. (The old
        // end-of-timeline scan saw completed rows where dependents can never break.)
        const state = controller.getStateAtTurn(viewTurn);
        if (state) {
          const getLaneEntries = (
            s: any,
            lId: "building" | "ship" | "colonist" | "research",
          ) => getLaneView(s, lId).entries;
          const brokenDependencies = getDependentQueueItems(
            state,
            entry,
            laneId,
            getLaneEntries,
          );

          // If there are broken things down the line, halt and show warning modal
          if (brokenDependencies.length > 0) {
            setPendingCancellation({
              laneId,
              entry,
              brokenDependencies,
            });
            return; // Abort standard cancellation
          }
        }

        // 2. Standard Cancellation Execution
        executeCancellation(laneId, entry);
      } catch (e) {
        setError((e as Error).message || "Unknown error");
      }
    },
    [controller, executeCancellation, viewTurn],
  );

  const handleClearLane = useCallback(
    (laneId: LaneId) => {
      setError(null);

      if (laneId === "research") {
        const entries = getGlobalResearchLaneView(
          gameState,
          planetTimelineEndTurn,
        ).entries;
        if (entries.length === 0) return;

        let nextState = gameState;
        for (const entry of entries) {
          commandHistory.recordCancel(0, "research", entry.id);
          nextState = cancelGlobalResearch(nextState, entry.id);
        }
        setGameState(refreshLocalResearchGates(nextState));
        return;
      }

      if (!controller || !currentPlanet) {
        setError("No planet selected");
        return;
      }

      const planState =
        controller.getStateAtTurn(planetTimelineEndTurn) ??
        controller.getStateAtTurn(planTurn);
      if (!planState) return;

      const entries = getLaneView(planState, laneId).entries;
      if (entries.length === 0) return;

      const planetIdx = Math.max(0, getPlanetIndex(gameState, currentPlanetId));
      const cancelledDefIds = new Set<string>();
      const newCascadeWarnings: Array<{
        entryId: string;
        laneId: string;
        reason: string;
      }> = [];

      const laneIds: Array<"building" | "ship" | "colonist"> = [
        "building",
        "ship",
        "colonist",
      ];

      // Batch all cancels (initial lane + cascade BFS) — all reads are at planTurn,
      // so future-turn simulation can be deferred until the batch closes.
      controller.withBatch(() => {
        for (const entry of entries) {
          const result = controller.cancelPlannedItem(laneId, entry.id);
          if (!result.success) continue;
          commandHistory.recordCancel(planetIdx, laneId, entry.id);
          if (!entry.isWait && !entry.isAutoWait) {
            cancelledDefIds.add(entry.itemId);
          }
        }

        let moreFound = cancelledDefIds.size > 0;
        while (moreFound) {
          moreFound = false;
          const scanState = controller.getStateAtTurn(planTurn);
          if (!scanState) break;

          for (const scanLaneId of laneIds) {
            const scanEntries = getLaneView(scanState, scanLaneId).entries;
            for (const qEntry of scanEntries) {
              if (qEntry.isWait || qEntry.isAutoWait) continue;
              const qDef = getDefs()[qEntry.itemId];
              if (!qDef) continue;

              const hasCancelledPrereq = qDef.prerequisites?.some((prereq) =>
                cancelledDefIds.has(prereq),
              );
              if (!hasCancelledPrereq) continue;

              const result = controller.cancelPlannedItem(scanLaneId, qEntry.id);
              if (!result.success) continue;

              commandHistory.recordCancel(planetIdx, scanLaneId, qEntry.id);
              cancelledDefIds.add(qEntry.itemId);
              newCascadeWarnings.push({
                entryId: qEntry.id,
                laneId: scanLaneId,
                reason: `${qDef.name || qEntry.itemId} - prerequisite removed`,
              });
              moreFound = true;
            }
          }
        }
      });

      controller.repackAllLanes(planTurn);
      setCascadeWarnings(newCascadeWarnings);

      const updatedPlanet = controller.getStateAtTurn(viewTurn);
      if (!updatedPlanet) return;

      setGameState((prev) => {
        const newPlanets = new Map(prev.planets);
        const existing = newPlanets.get(prev.currentPlanetId);
        if (existing) {
          newPlanets.set(
            prev.currentPlanetId,
            withPlanetMetadata(updatedPlanet, existing),
          );
        }
        return { ...prev, planets: newPlanets };
      });

      const getLaneEntries = (
        state: any,
        lId: "building" | "ship" | "colonist" | "research",
      ) => getLaneView(state, lId).entries;
      const validationResults = validateAllQueueItems(
        updatedPlanet,
        getLaneEntries,
      );
      const validationMap = new Map<string, QueueValidationResult>();
      for (const res of validationResults) {
        validationMap.set(res.entryId, res);
      }
      setQueueValidation(validationMap);
    },
    [
      commandHistory,
      controller,
      currentPlanet,
      currentPlanetId,
      gameState,
      planetTimelineEndTurn,
      planTurn,
      viewTurn,
    ],
  );

  const handleQuantityChange = useCallback(
    (
      laneId: "building" | "ship" | "colonist" | "research",
      entry: any,
      newQuantity: number,
    ) => {
      setError(null);
      if (!controller) {
        setError("No planet selected");
        return;
      }

      try {
        // Update quantity preserving position
        const updateResult = controller.updateItemQuantity(
          planTurn,
          laneId,
          entry.id,
          newQuantity,
        );

        if (!updateResult.success) {
          setError(`Failed to update quantity: ${updateResult.reason}`);
          return;
        }

        // Update the planet in game state
        const updatedPlanet = controller.getStateAtTurn(viewTurn);
        if (updatedPlanet) {
          setGameState((prev) => {
            const newPlanets = new Map(prev.planets);
            const existing = newPlanets.get(gameState.currentPlanetId);
            if (existing)
              newPlanets.set(
                gameState.currentPlanetId,
                withPlanetMetadata(updatedPlanet, existing),
              );
            return { ...prev, planets: newPlanets };
          });
        }
      } catch (e) {
        setError((e as Error).message || "Unknown error");
      }
    },
    [controller, viewTurn, gameState, planTurn],
  );

  const handleReorder = useCallback(
    (
      laneId: "building" | "ship" | "colonist" | "research",
      entryId: string,
      newIndex: number,
    ) => {
      setError(null);
      if (laneId === "research") {
        const nextState = reorderGlobalResearch(gameState, entryId, newIndex);
        if (nextState === gameState) {
          setError("Cannot move research before its prerequisites.");
          return;
        }
        commandHistory.recordReorder(0, laneId, entryId, newIndex);
        setGameState(refreshLocalResearchGates(nextState));
        return;
      }
      if (!controller) {
        setError("No planet selected");
        return;
      }

      try {
        const result = controller.reorderQueueItem(
          planTurn,
          laneId,
          entryId,
          newIndex,
        );

        if (!result.success) {
          setError(`Cannot reorder: ${result.reason || "unknown error"}`);
          return;
        }

        // We should repack the queue following a reorder so items lock into their new places mathematically
        controller.repackQueue(planTurn, laneId);
        const planetIdx = getPlanetIndex(gameState, currentPlanetId);
        commandHistory.recordReorder(
          Math.max(0, planetIdx),
          laneId,
          entryId,
          newIndex,
        );

        // Update the planet in game state
        const updatedPlanet = controller.getStateAtTurn(viewTurn);
        if (updatedPlanet) {
          setGameState((prev) => {
            const newPlanets = new Map(prev.planets);
            const existing = newPlanets.get(gameState.currentPlanetId);
            if (existing)
              newPlanets.set(
                gameState.currentPlanetId,
                withPlanetMetadata(updatedPlanet, existing),
              );
            return { ...prev, planets: newPlanets };
          });
        }
      } catch (e) {
        console.error("Error reordering item:", e);
        setError((e as Error).message || "Unknown error");
      }
    },
    [
      controller,
      viewTurn,
      gameState,
      commandHistory,
      planTurn,
      currentPlanetId,
    ],
  );

  const getMaxQuantity = useCallback(
    (
      laneId: "building" | "ship" | "colonist" | "research",
      entry: any,
    ): number => {
      if (!controller) return entry.quantity;
      const state = controller.getStateAtTurn(planetTimelineEndTurn);
      if (!state) return entry.quantity;

      const def = getDefs()[entry.itemId];
      if (!def) return entry.quantity;

      // Binary search for maximum quantity.
      // Cap at 1000 — no ship/colonist batch exceeds this in game data.
      let low = 1;
      let high = 1000;
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
    },
    [controller, canQueueItem, planetTimelineEndTurn],
  );

  const handleAdvanceTurn = useCallback(() => {
    setError(null);
    if (!controller || !currentPlanet) {
      setError("No planet selected");
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
        setGameState((prev) => {
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
      setError((e as Error).message || "Unknown error");
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
      setExportSnapshot(null);
      setShowExportModal(false);

      commandHistory.recordResetAllPlanets();
      setGameState(resetState);
    } catch (e) {
      setError((e as Error).message || "Unknown error");
    }
  }, [gameState, commandHistory]);

  const buildMultiPlanetExportData = useCallback((): MultiPlanetExportData => {
    const planets = Array.from(gameState.planets.values()).map((planet) => {
      const planetController = new GameController(planet, planet.timeline);
      const endTurn = planet.startTurn + planetController.getTotalTurns() - 1;
      const exportState = planetController.getStateAtTurn(endTurn) ?? planet;

      return {
        id: planet.id,
        name: planet.name,
        startTurn: planet.startTurn,
        currentTurn: planet.currentTurn,
        lanes: [
          getLaneView(exportState, "building"),
          getLaneView(exportState, "ship"),
          getLaneView(exportState, "colonist"),
        ],
      };
    });

    return {
      planets,
      researchLane: getGlobalResearchLaneView(gameState, viewTurn),
    };
  }, [gameState, viewTurn]);

  const openExportModal = useCallback(
    () => {
      setExportSnapshot({
        buildingLane: enrichedBuildingLane || {
          laneId: "building" as const,
          entries: [],
        },
        shipLane: enrichedShipLane || { laneId: "ship" as const, entries: [] },
        colonistLane: enrichedColonistLane || {
          laneId: "colonist" as const,
          entries: [],
        },
        researchLane: enrichedResearchLane || {
          laneId: "research" as const,
          entries: [],
        },
        currentTurn: viewTurn,
        multiPlanetData: buildMultiPlanetExportData(),
      });
      setShowExportModal(true);
    },
    [
      enrichedBuildingLane,
      enrichedShipLane,
      enrichedColonistLane,
      enrichedResearchLane,
      viewTurn,
      buildMultiPlanetExportData,
    ],
  );

  // Rebuilt only when the underlying game state or view turn changes — the
  // shared preview previously re-ran this on every render.
  const multiPlanetExportData = useMemo(
    () => buildMultiPlanetExportData(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState, viewTurn],
  );

  // Snapshot the current encoded state for the saves modal — encapsulates the
  // same encode-once-then-summarise pattern used by the auto-save effect.
  const getCurrentSnapshot = useCallback(() => {
    try {
      const planetConfigs = extractPlanetConfigs(gameState);
      const commands = commandHistory.getCommands();
      if (commands.length === 0) return null;
      const encoded = encodeGameState(
        planetConfigs,
        commands,
        activeShareMetadata,
      );
      const summary = buildSaveSummary(encoded);
      return { encoded, summary };
    } catch {
      return null;
    }
  }, [gameState, commandHistory, activeShareMetadata]);

  const buildCurrentShareURL = useCallback(
    (metadata?: ShareMetadata | null) => {
      const commands = commandHistory.getCommands();
      if (commands.length === 0) return null;

      const encoded = encodeCompactShareState(
        gameState,
        metadata ?? activeShareMetadata,
      );
      lastAppliedShareRef.current = encoded;
      const url = buildCompactShareURL(encoded);
      if (typeof window !== "undefined") {
        try {
          window.history.replaceState(window.history.state, "", url);
        } catch {
          // Keep sharing functional even if history replacement fails.
        }
      }
      return {
        commandCount: commands.length,
        url,
      };
    },
    [gameState, commandHistory, activeShareMetadata],
  );

  const buildCurrentDebugURL = useCallback(
    (metadata?: ShareMetadata | null) => {
      const planetConfigs = extractPlanetConfigs(gameState);
      const commands = commandHistory.getCommands();
      if (commands.length === 0) return null;

      const encoded = encodeGameState(
        planetConfigs,
        commands,
        metadata ?? activeShareMetadata,
      );
      saveEncodedStateToURL(encoded);
      lastAppliedShareRef.current = encoded;
      return {
        commandCount: commands.length,
        url: buildShareURL(encoded),
      };
    },
    [gameState, commandHistory, activeShareMetadata],
  );

  const getShareMetadataForCurrentBuild = useCallback(() => {
    const fallbackName = activeShareMetadata?.name || "Build list";
    return normaliseShareMetadata({
      name: shareListName.trim() || fallbackName,
      author: shareAuthor.trim() || undefined,
      sharedAt: new Date().toISOString(),
    });
  }, [activeShareMetadata, shareAuthor, shareListName]);

  // Restore a save: push the encoded state into the URL hash and reload so the
  // existing hash-based bootstrap rebuilds command history from scratch.
  // Reload (vs trying to splice state in-place) avoids any stale closures and
  // keeps the restore path identical to the share-link flow.
  const handleRestoreSave = useCallback(
    (encoded: string, label: string, options?: RestoreOptions) => {
      if (typeof window === "undefined") return;
      try {
        prepareRestoreForReload({
          encoded,
          shared: options?.shared === true,
          autosaveTimerRef,
          restoreInProgressRef,
          lastAppliedShareRef,
        });
        setToast(`Loading "${label}"…`);
        // Reload so loadStateFromURL runs cleanly on next mount.
        setTimeout(() => window.location.reload(), 200);
      } catch (e) {
        restoreInProgressRef.current = false;
        setError(`Failed to restore: ${(e as Error).message}`);
      }
    },
    [],
  );

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopyShareLink = async () => {
    const metadata = getShareMetadataForCurrentBuild();
    if (!metadata) return;

    const share = buildCurrentShareURL(metadata);
    if (!share) {
      showToast("No queued plan to share yet");
      return;
    }
    const { commandCount: cmds, url } = share;
    const copied = await copyTextToClipboard(url);
    if (!copied) {
      showToast("Could not copy — clipboard unavailable");
      return;
    }
    try {
      if (shareAuthor.trim()) {
        window.localStorage.setItem(SHARE_AUTHOR_STORAGE_KEY, shareAuthor.trim());
      }
    } catch {
      /* ignore */
    }
    showToast(`Link copied — "${metadata.name}" by ${metadata.author}, ${cmds} command${cmds === 1 ? "" : "s"}`);
  };

  const handleCopyDebugState = async () => {
    const share = buildCurrentDebugURL(activeShareMetadata);
    if (!share) {
      alert("No state to copy yet.");
      return;
    }
    const copied = await copyTextToClipboard(share.url);
    if (copied) {
      showToast("Debug URL copied to clipboard");
    } else {
      window.prompt("Copy debug URL", share.url);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-void text-ink">
      <div className="emission-glow" aria-hidden="true" />

      {/* BL loading indicator — shown while replayCommands is running on a shared link */}
      {isMounted && isReplaying && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/85" role="status">
          <p className="text-lg font-semibold text-ink">Loading build list…</p>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="border-b border-filament/70">
          <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4 md:px-6">
            <h1 className="flex items-center gap-2.5 font-display text-lg font-extrabold uppercase tracking-[0.08em] text-ink md:text-xl">
              <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 bg-halpha shadow-[0_0_12px_rgba(242,80,140,0.8)]" />
              <a href={INFINITE_CONFLICT_URL} target="_blank" rel="noopener noreferrer" className="rounded-sm hover:text-halpha-soft">
                Infinite Conflict Simulator
              </a>
            </h1>
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="btn btn-primary flex-1 sm:flex-none"
                title="Copy a share link that opens this build list"
              >
                <Link2 aria-hidden="true" />
                Copy share link
              </button>
              <button
                type="button"
                onClick={() => setShowSavesModal(true)}
                className="btn btn-secondary flex-1 sm:flex-none"
                title="Save, load, and import plans (stored on this device)"
              >
                <Save aria-hidden="true" />
                Saves
              </button>
              <button
                type="button"
                onClick={() => openExportModal()}
                className="btn btn-secondary flex-1 sm:flex-none"
                title="Export build list"
              >
                <Upload aria-hidden="true" />
                Export
              </button>
            </div>
          </div>

          <div className="mx-auto grid max-w-[1800px] gap-3 px-4 py-3 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end">
            <BuildListSelector onRestore={handleRestoreSave} />
            <div className="grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="eyebrow mb-1 block">List name</span>
                <input
                  type="text"
                  value={shareListName}
                  onChange={(e) => setShareListName(e.target.value)}
                  placeholder="Build list"
                  className="field"
                />
              </label>
              <label className="block min-w-0">
                <span className="eyebrow mb-1 block">Author</span>
                <input
                  type="text"
                  value={shareAuthor}
                  onChange={(e) => setShareAuthor(e.target.value)}
                  placeholder="Commander"
                  className="field"
                />
              </label>
            </div>
          </div>
        </header>

        {activeShareMetadata && isSharedBuildPreviewOpen ? (
          <SharedBuildListView
            name={activeShareMetadata.name}
            author={activeShareMetadata.author}
            planets={gameState.planets}
            currentPlanetId={gameState.currentPlanetId}
            currentTurn={viewTurn}
            lanes={enrichedLanes}
            multiPlanetData={multiPlanetExportData}
            defs={defs}
            onPlanetSelect={handlePlanetSwitch}
            onExit={() => {
              resetToCleanState("Shared build list closed");
              setMobileView("queue");
            }}
            onEdit={() => {
              setSharedBuildPreviewOpen(false);
              setMobileView("queue");
            }}
          />
        ) : (
          <div className="mx-auto w-full max-w-[1800px] flex-1 px-4 md:px-6">
            {/* Planet bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
              <PlanetTabs
                planets={gameState.planets}
                currentPlanetId={gameState.currentPlanetId}
                onPlanetSwitch={handlePlanetSwitch}
                onAddPlanet={handleAddPlanet}
                onEditPlanet={handleEditPlanet}
                maxPlanets={effectivePlanetLimit}
              />
              <div className="ml-auto flex items-center gap-4">
                <div className="flex items-baseline gap-2" title="Score across all planets at the viewed turn">
                  <span className="eyebrow">Score</span>
                  <span className="text-lg font-semibold text-ink">{formatScore(globalScore)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingConfirm({ kind: "reset" })}
                  className="btn btn-danger btn-sm"
                  title="Start over: remove every colony, queue and research, back to a fresh homeworld at T1"
                >
                  <RotateCcw aria-hidden="true" className="h-3.5! w-3.5!" />
                  Reset plan
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {activeShareMetadata && (
                <div className="callout border-l-oiii flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="eyebrow text-oiii">Shared list</span>
                  <span className="font-semibold text-ink">{activeShareMetadata.name}</span>
                  <span className="text-ink-2">by {activeShareMetadata.author}</span>
                  <span className="text-ink-3 sm:ml-auto">Opened from a shared link; save it as yours from Saves → Shared.</span>
                </div>
              )}

              {error && (
                <div role="alert" className="callout border-l-danger text-danger">
                  {error}
                </div>
              )}
            </div>

            {/* Turn deck — sticky from tablet up so the viewed turn stays in reach while scrolling */}
            <div className="z-30 -mx-4 bg-void/95 px-4 py-2 backdrop-blur-sm md:sticky md:top-0 md:-mx-6 md:px-6">
              <HorizontalTimeline
                currentTurn={viewTurn}
                totalTurns={timelineMaxTurn}
                onTurnChange={setViewTurn}
                firstEmptyTurns={firstEmptyTurns}
                currentBuilds={currentBuilds}
                laneSpans={laneSpans}
                isAutoJumpEnabled={isAutoJumpEnabled}
                onAutoJumpToggle={setIsAutoJumpEnabled}
              />
            </div>

            {/* Economy at the viewed turn */}
            <div className="mt-3">
              {summary ? (
                <PlanetDashboard
                  summary={summary}
                  defs={defs}
                  turnsToHousingCap={currentState ? getTurnsUntilHousingCap(currentState, viewTurn) : null}
                  stocksEstimated={currentState?.activationUsedProjectedProduction === true}
                  onDemolish={handleDemolish}
                  demolishableIds={demolishableIds}
                />
              ) : (
                <div className="callout border-l-caution items-center justify-between gap-4 max-md:flex-col max-md:items-start">
                  <div>
                    <h2 className="font-semibold text-ink">Planet not active at this turn</h2>
                    <p className="mt-0.5 text-ink-2">
                      {planetUnavailableReason || `No planet state is available for T${viewTurn}.`}
                    </p>
                  </div>
                  {currentPlanet && (
                    <button type="button" onClick={() => setViewTurn(currentPlanet.startTurn)} className="btn btn-primary">
                      Go to T{currentPlanet.startTurn}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Workbench — one lane switcher drives both the catalog and the queue */}
            <main className="pb-10 pt-6">
              {!isPlanetViewAvailable ? (
                <section className="panel p-6">
                  <h2 className="panel-title mb-2">Queue unavailable</h2>
                  <p className="text-sm text-ink-2">
                    Move to a turn where this planet exists before adding planet-local queue items. Planet tabs, turn
                    navigation, global research, and Add planet remain available.
                  </p>
                </section>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2 md:flex-nowrap">
                    <div className="seg grid w-full grid-cols-2 md:hidden" role="group" aria-label="Panel">
                      <button type="button" onClick={() => setMobileView("build")} aria-pressed={mobileView === "build"} className="seg-item">
                        <ListPlus aria-hidden="true" />
                        Build
                      </button>
                      <button type="button" onClick={() => setMobileView("queue")} aria-pressed={mobileView === "queue"} className="seg-item">
                        <ListOrdered aria-hidden="true" />
                        Queue
                        {totalQueuedItems > 0 && <span className="text-xs text-ink-3">({totalQueuedItems})</span>}
                      </button>
                    </div>
                    <LaneTabs activeTab={activeTab} onTabChange={setActiveTab} className="w-full shrink-0 md:w-auto" />
                    {/* Warnings (engine + cascade-removal notices) live in this row's free space so they never shift the page */}
                    <WarningsPanel warnings={allWarnings} className="w-full md:ml-2 md:w-auto md:flex-1" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 md:items-start">
                    <div className={`min-w-0 ${mobileView === "build" ? "block" : "hidden md:block"}`}>
                      <TabbedItemGrid
                        availableItems={availableItems}
                        onQueueItem={handleQueueItem}
                        onQueueWait={handleQueueWait}
                        canQueueItem={canQueueItem}
                        activeTab={activeTab}
                      />
                    </div>

                    <div className={`min-w-0 ${mobileView === "queue" ? "block" : "hidden md:block"}`} data-export-target="planet-queue">
                      <TabbedLaneDisplay
                        buildingLane={enrichedBuildingLane}
                        shipLane={enrichedShipLane}
                        colonistLane={enrichedColonistLane}
                        researchLane={enrichedResearchLane}
                        currentTurn={viewTurn}
                        onCancel={handleCancelItem}
                        onQuantityChange={handleQuantityChange}
                        getMaxQuantity={getMaxQuantity}
                        onReorder={handleReorder}
                        onClearLane={(laneId) => setPendingConfirm({ kind: "clear", laneId })}
                        disabled={false}
                        defs={defs}
                        activeTab={activeTab}
                        onTurnClick={setViewTurn}
                        maxTurn={timelineMaxTurn}
                        onDropGridItem={handleQueueItem}
                        reorderPlan={reorderPlan}
                      />
                    </div>
                  </div>
                </>
              )}
            </main>
          </div>
        )}

        <footer className="mt-auto border-t border-filament/70">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-4 text-xs text-ink-3 md:px-6">
            <span>v0.2.88</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCopyDebugState}
              title="Copy URL with full command history to clipboard for bug reporting"
            >
              <Bug aria-hidden="true" className="h-3.5! w-3.5!" />
              Copy debug state
            </button>
          </div>
        </footer>
      </div>

      {pendingConfirm?.kind === "reset" && (
        <ConfirmDialog
          title="Reset plan?"
          description="This removes every colony, queued item and research, and starts again from a fresh homeworld at T1."
          confirmLabel="Reset plan"
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            setPendingConfirm(null);
            handleResetQueue();
          }}
        >
          <p className="text-sm text-ink-2">The current plan stays in Saves → History if you want it back.</p>
        </ConfirmDialog>
      )}

      {pendingConfirm?.kind === "clear" && (
        <ConfirmDialog
          title={`Clear the ${LANE_CONFIG[pendingConfirm.laneId].title.toLowerCase()} lane?`}
          description={`Every entry in the ${LANE_CONFIG[pendingConfirm.laneId].title.toLowerCase()} lane of this ${pendingConfirm.laneId === "research" ? "plan" : "planet"} will be removed.`}
          confirmLabel="Clear lane"
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            const { laneId } = pendingConfirm;
            setPendingConfirm(null);
            handleClearLane(laneId);
          }}
        />
      )}

      {/* Dependency warning — cancelling an item other queue entries rely on */}
      {pendingCancellation && (
        <DependencyWarningModal
          onConfirm={confirmPendingCancellation}
          onCancel={() => setPendingCancellation(null)}
          cancelledItemName={pendingCancellation.entry.itemName}
          brokenDependencies={pendingCancellation.brokenDependencies.map((d) => d.entry)}
        />
      )}

      {/* Export Modal - TICKET-5 */}
      {showExportModal && exportSnapshot && (
        <ExportModal
          isOpen={true}
          onClose={() => {
            setShowExportModal(false);
            setExportSnapshot(null);
          }}
          buildingLane={exportSnapshot.buildingLane}
          shipLane={exportSnapshot.shipLane}
          colonistLane={exportSnapshot.colonistLane}
          researchLane={exportSnapshot.researchLane}
          currentTurn={exportSnapshot.currentTurn}
          multiPlanetData={exportSnapshot.multiPlanetData}
        />
      )}

      {/* Planet Actions Modal — Modify or Delete an existing planet */}
      {(() => {
        const planet = planetActionsId ? gameState.planets.get(planetActionsId) : null;
        const planetKeys = Array.from(gameState.planets.keys());
        const idx = planetActionsId ? planetKeys.indexOf(planetActionsId) : -1;
        return planet ? (
          <PlanetActionsModal
            isOpen={true}
            planetName={planet.name}
            planetLabel={`P${idx + 1}`}
            blockReason={canRemovePlanet(gameState, planet.id)}
            onModify={() => handleOpenModifyPlanet(planet.id)}
            onDelete={() => handleDeletePlanet(planet.id)}
            onClose={() => setPlanetActionsId(null)}
          />
        ) : null;
      })()}

      {/* Add Planet Modal */}
      <AddPlanetModal
        isOpen={showAddPlanetModal}
        onClose={() => {
          setShowAddPlanetModal(false);
          setEditingPlanetId(null);
        }}
        onAddPlanet={handleCreatePlanet}
        currentTurn={planetModalTurn}
        mode={editingPlanetId ? "edit" : "add"}
        initialConfig={editingPlanetConfig}
        expansionSource={editingPlanetId ? undefined : expansionSource ?? undefined}
      />

      {/* Saves Modal — IndexedDB-backed named saves, auto-save history, and JSON import */}
      <SavesModal
        isOpen={showSavesModal}
        onClose={() => setShowSavesModal(false)}
        getCurrentSnapshot={getCurrentSnapshot}
        onRestore={handleRestoreSave}
      />

      {/* Easter egg: the wait-code sequence unlocks the extended planning range */}
      {showWaitCodeModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="wait-code-title">
          <div className="modal wait-code-shell max-w-md overflow-hidden p-6 text-center">
            <div className="wait-code-spark wait-code-spark-a" />
            <div className="wait-code-spark wait-code-spark-b" />
            <div className="wait-code-spark wait-code-spark-c" />

            <div className="relative z-10">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-panel border border-filament bg-veil font-display text-2xl font-extrabold text-halpha-soft">
                123
              </div>
              <h2 id="wait-code-title" className="modal-title mb-2 text-2xl">
                Signal found
              </h2>
              <p className="mx-auto mb-5 max-w-xs text-sm text-ink-2">
                Pick a response. The extended planning range is available after either signal is sent.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleWaitCodeChoice("awoo")}
                  className="wait-code-button rounded-panel border border-halpha/40 bg-halpha/10 px-4 py-4 text-lg font-bold text-ink transition-colors hover:bg-halpha/20"
                >
                  <span>awoo!</span>
                  <span className="mt-1 block text-sm text-halpha-soft">{waitCodeCounts.awoo}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWaitCodeChoice("aroo")}
                  className="wait-code-button rounded-panel border border-oiii/40 bg-oiii/10 px-4 py-4 text-lg font-bold text-ink transition-colors hover:bg-oiii/20"
                >
                  <span>aroo!</span>
                  <span className="mt-1 block text-sm text-oiii">{waitCodeCounts.aroo}</span>
                </button>
              </div>

              {extendedViewUnlocked && (
                <div className="callout mt-5 border-l-res-food justify-center font-semibold">
                  Planning range extended to T{EXTENDED_VIEW_TURNS}.
                </div>
              )}

              <button type="button" onClick={() => setShowWaitCodeModal(false)} className="btn btn-ghost btn-sm mt-4">
                Continue planning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transient toast — shown after copy-link, etc. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-ctl border border-filament bg-veil-hi px-4 py-3 text-sm font-medium text-ink shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_2px_0_0_#F2508C]"
        >
          {toast}
        </div>
      )}

      {replayNotice && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 z-50 flex w-[min(42rem,92vw)] -translate-x-1/2 items-start gap-3 rounded-ctl border border-caution/60 bg-veil-hi px-4 py-3 text-sm text-ink shadow-[0_12px_32px_rgba(0,0,0,0.5),inset_2px_0_0_#F5B544]"
        >
          <span aria-hidden="true" className="font-bold text-caution">!</span>
          <p className="flex-1">{replayNotice}</p>
          <button
            type="button"
            onClick={() => setReplayNotice(null)}
            className="shrink-0 rounded-ctl px-2 py-0.5 text-ink-2 hover:text-ink"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
