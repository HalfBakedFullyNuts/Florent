"use client";
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import GameData from '../lib/game/dataManager';
import type { Unit as GUnit, Structure as GStructure } from '../lib/game/dataManager';
import { enqueueItem, processTick, cancelQueueItemImpl, moveQueueItemGlobal, calculateIncome, getMaxBuildCount, updateQueueItemCount, clearBuildQueue } from '../lib/game/agent';
import type { EnqueueOptions } from '../lib/game/agent';
import type { PlayerState, QueueItem } from '../lib/game/types';

const resourceColorMap: Record<string, string> = {
  metal: 'text-[#8f8c8c]',
  mineral: 'text-orange-300',
  food: 'text-green-300',
  energy: 'text-sky-300',
  research_points: 'text-violet-200',
};

function assignQueueSchedule(player: PlayerState) {
  player.meta ||= {};
  let currentStart = player.tick + 1;
  for (const qi of player.buildQueue) {
    qi.meta ||= {};
    if (qi.meta.itemType === 'wait' || qi.type === 'Wait') {
      const waitTurns = Math.max(1, Number(qi.meta.waitTurns || qi.remainingTime || 1));
      qi.type = 'Wait';
      qi.meta.itemType = 'wait';
      qi.meta.waitTurns = waitTurns;
      qi.meta.startTurn = currentStart;
      qi.meta.completionTurn = currentStart + waitTurns - 1;
      qi.remainingTime = waitTurns;
      currentStart += waitTurns;
    } else {
      const def = GameData.getStructureById(qi.name) || GameData.getUnitById(qi.name);
      const buildTime = Math.max(1, def?.build_time_turns || 1);
      qi.meta.startTurn = currentStart;
      qi.meta.completionTurn = currentStart + buildTime - 1;
      qi.remainingTime = buildTime;
      currentStart += buildTime;
    }
  }
  player.meta.queueCompletionTurn = player.buildQueue.length > 0 ? currentStart - 1 : player.tick;
}
type TabType = 'structures' | 'ships' | 'colonists';

// Initialize player state with starting buildings
function initializePlayer(): PlayerState {
  const ownedBuildings: PlayerState['ownedBuildings'] = [
    { id: 'outpost-0', name: 'outpost', builtAtTick: 0 },
    { id: 'metal_mine-0', name: 'metal_mine', builtAtTick: 0 },
    { id: 'metal_mine-1', name: 'metal_mine', builtAtTick: 0 },
    { id: 'metal_mine-2', name: 'metal_mine', builtAtTick: 0 },
    { id: 'mineral_extractor-0', name: 'mineral_extractor', builtAtTick: 0 },
    { id: 'mineral_extractor-1', name: 'mineral_extractor', builtAtTick: 0 },
    { id: 'mineral_extractor-2', name: 'mineral_extractor', builtAtTick: 0 },
    { id: 'farm-0', name: 'farm', builtAtTick: 0 },
    { id: 'solar_generator-0', name: 'solar_generator', builtAtTick: 0 },
  ];

  const spaceUsage = ownedBuildings.reduce(
    (acc, b) => {
      const def = GameData.getStructureById(b.name);
      const costs = def?.build_requirements?.space_cost || [];
      for (const cost of costs) {
        if (cost.type === 'ground_space') acc.ground += cost.amount || 0;
        if (cost.type === 'orbital_space') acc.orbital += cost.amount || 0;
      }
      return acc;
    },
    { ground: 0, orbital: 0 }
  );

  const player: PlayerState = {
    resources: {
      mass: 30000,      // Starting metal
      mineral: 20000,   // Starting mineral
      food: 10000,      // Starting food
      energy: 1000      // Starting energy
    },
    income: { mass: 0, mineral: 0, food: 0, energy: 0 },
    ownedBuildings,
    completedResearch: [],
    buildQueue: [],
    unitQueueByFactory: {},
    unitCounts: { worker: 30000, soldier: 0, scientist: 0 },
    tick: 0,
    meta: {
      housing_worker: 50000,
      housing_soldier: 100000,
      ground_space_used: spaceUsage.ground,
      ground_space_max: 60,
      orbital_space_used: spaceUsage.orbital,
      orbital_space_max: 40,
      workers_busy: 0
    }
  };

  player.income = calculateIncome(player, { metal: 1, mineral: 1, food: 1 });
  assignQueueSchedule(player);
  return player;
}

// calculateIncome moved to engine (../lib/game/agent)

// Simulate to a specific turn
function simulateToTurn(basePlayer: PlayerState, targetTurn: number, abundances: { metal: number; mineral: number; food: number }): PlayerState {
  const player = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;

  while (player.tick < targetTurn) {
    processTick(player, abundances, 1);
    player.income = calculateIncome(player, abundances);
  }

  return player;
}

// Find the next turn when all queues are empty
function findNextEmptyTurn(player: PlayerState, abundances: { metal: number; mineral: number; food: number }): number {
  let simPlayer = JSON.parse(JSON.stringify(player)) as PlayerState;
  let maxTurn = simPlayer.tick + 200; // Safety limit

  while (simPlayer.tick < maxTurn) {
    if (simPlayer.buildQueue.length === 0 &&
        Object.values(simPlayer.unitQueueByFactory).every(q => q.length === 0)) {
      return simPlayer.tick;
    }
    processTick(simPlayer, abundances, 1);
  }

  return simPlayer.tick;
}

export default function Home() {
  const [basePlayer, setBasePlayer] = useState<PlayerState>(() => initializePlayer());
  const [currentTurn, setCurrentTurn] = useState(0);
  const [maxTurn, setMaxTurn] = useState(200);
  const [activeTab, setActiveTab] = useState<TabType>('structures');
  const [queueTab, setQueueTab] = useState<TabType>('structures');
  const [pendingEnqueue, setPendingEnqueue] = useState<{ itemId: string; itemType: 'structure' | 'unit'; waitTurns: number; reason: 'workers' | 'resources'; count: number } | null>(null);
  const [batchCounts, setBatchCounts] = useState<Record<string, number>>({});
  const [queueCountDrafts, setQueueCountDrafts] = useState<Record<string, number>>({});
  const [viewBuildList, setViewBuildList] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [draggingQueueId, setDraggingQueueId] = useState<string | null>(null);

  const abundances = useMemo(() => ({ metal: 1, mineral: 1, food: 1 }), []);

  // Calculate current player state at selected turn
  const currentPlayer = useMemo(() => {
    return simulateToTurn(basePlayer, currentTurn, abundances);
  }, [basePlayer, currentTurn, abundances]);

  // Update income when player state changes
  useEffect(() => {
    const income = calculateIncome(currentPlayer, abundances);
    currentPlayer.income = income;
  }, [currentPlayer, abundances]);

  // Get available items based on tab
  const queuedStructureCounts = useMemo(() => {
    const counts = new Map<string, number>();
    basePlayer.buildQueue.forEach(item => {
      if (item.meta?.itemType === 'structure') {
        counts.set(item.name, (counts.get(item.name) || 0) + 1);
      }
    });
    return counts;
  }, [basePlayer.buildQueue]);

  const queuedStructureIds = useMemo(() => {
    const ids = new Set<string>();
    basePlayer.buildQueue.forEach(item => {
      if (item.meta?.itemType === 'structure') ids.add(item.name);
    });
    return ids;
  }, [basePlayer.buildQueue]);

  const isBatchableUnit = useCallback((unit: GUnit | null) => {
    if (!unit) return false;
    return unit.category === 'ship' || unit.category === 'colonist';
  }, []);

  const getBatchCount = useCallback((id: string) => {
    return batchCounts[id] ?? 1;
  }, [batchCounts]);

  const setBatchCount = useCallback((id: string, value: number) => {
    setBatchCounts(prev => ({ ...prev, [id]: value }));
  }, []);

  const computeMaxCount = useCallback((player: PlayerState, itemId: string, itemType: 'structure' | 'unit') => {
    return Math.max(1, getMaxBuildCount(player, itemId, itemType));
  }, []);

  const availableItems = useMemo(() => {
    if (activeTab === 'structures') {
      return GameData.getAllStructures()
        .filter(s => {
          // Check if requirements are met
          if (s.requirements) {
            for (const req of s.requirements) {
              if (req.type === 'structure') {
                const owned = currentPlayer.ownedBuildings.some(b => b.name === req.id);
                const queued = queuedStructureIds.has(req.id);
                if (!owned && !queued) return false;
              }
              if (req.type === 'research_flag' && !currentPlayer.completedResearch.includes(req.id)) {
                return false;
              }
            }
          }
          // Check max_per_planet
          if (s.max_per_planet !== null && s.max_per_planet !== undefined) {
            const ownedCount = currentPlayer.ownedBuildings.filter(b => b.name === s.id).length;
            const queuedCount = queuedStructureCounts.get(s.id) || 0;
            if (ownedCount + queuedCount >= s.max_per_planet) return false;
          }
          return true;
        });
    } else if (activeTab === 'ships') {
      return GameData.getAllUnits()
        .filter(u => u.category === 'ship')
        .filter(u => {
          if (u.requirements) {
            for (const req of u.requirements) {
              if (req.type === 'structure') {
                const owned = currentPlayer.ownedBuildings.some(b => b.name === req.id);
                const queued = queuedStructureIds.has(req.id);
                if (!owned && !queued) return false;
              }
            }
          }
          return true;
        });
    } else {
      return GameData.getAllUnits()
        .filter(u => u.category === 'colonist')
        .filter(u => {
          if (u.requirements) {
            for (const req of u.requirements) {
              if (req.type === 'structure') {
                const owned = currentPlayer.ownedBuildings.some(b => b.name === req.id);
                const queued = queuedStructureIds.has(req.id);
                if (!owned && !queued) return false;
              }
            }
          }
          return true;
        });
    }
  }, [activeTab, currentPlayer, queuedStructureCounts, queuedStructureIds]);

  const queueTabs: TabType[] = ['structures', 'ships', 'colonists'];

  const filteredBuildQueue = useMemo(() => {
    return basePlayer.buildQueue.filter(item => {
      if (item.meta?.itemType === 'wait' || item.type === 'Wait') return true;
      const itemType = item.meta?.itemType || (item.type === 'Building' ? 'structure' : item.type === 'Unit' ? 'unit' : item.type === 'Research' ? 'research' : undefined);
      if (itemType === 'structure') return queueTab === 'structures';
      if (itemType === 'unit') {
        const unitDef = GameData.getUnitById(item.name);
        if (unitDef?.category === 'ship') return queueTab === 'ships';
        if (unitDef?.category === 'colonist') return queueTab === 'colonists';
        return queueTab === 'structures';
      }
      if (itemType === 'research') return queueTab === 'structures';
      return queueTab === 'structures';
    });
  }, [basePlayer.buildQueue, queueTab]);

  const computeMaxCountForQueueItem = useCallback((queueItem: QueueItem) => {
    const unitDef = GameData.getUnitById(queueItem.name);
    if (!isBatchableUnit(unitDef)) return Number((queueItem.meta as any)?.count || 1);
    const draft = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;
    cancelQueueItemImpl(draft, queueItem.id);
    return computeMaxCount(draft, queueItem.name, 'unit');
  }, [basePlayer, computeMaxCount, isBatchableUnit]);

  // Queue an item and advance time
  const applyPlayerState = useCallback((player: PlayerState) => {
    assignQueueSchedule(player);
    player.income = calculateIncome(player, abundances);
    setBasePlayer(player);
    setCurrentTurn(player.meta?.queueCompletionTurn ?? player.tick);
  }, [abundances, setBasePlayer, setCurrentTurn]);

  const attemptEnqueue = useCallback((itemId: string, itemType: 'structure' | 'unit', count = 1, opts?: EnqueueOptions, showModal = true): ReturnType<typeof enqueueItem> => {
    const run = (options?: EnqueueOptions) => {
      const draft = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;
      const result = enqueueItem(draft, itemId, itemType, count, options);
      return { draft, result };
    };

    const { draft, result } = run(opts);

    if (!result.ok) {
      if (result.reason === 'wait_required' && !opts?.allowAutoWait && !opts?.allowNegativeStocks) {
        const waitTurns = Math.max(0, result.waitTurns ?? 0);
        if (waitTurns === 0) {
          return attemptEnqueue(itemId, itemType, count, { ...opts, allowAutoWait: true }, showModal);
        }
        if (showModal) {
          setPendingEnqueue({ itemId, itemType, waitTurns, reason: result.shortage || 'resources', count });
        }
        return result;
      }
      setLastError(result.reason || 'Unable to queue item');
      return result;
    }

    setLastError(null);
    applyPlayerState(draft);
    return result;
  }, [basePlayer, applyPlayerState]);

  const queueItem = useCallback((itemId: string, itemType: 'structure' | 'unit', count = 1) => {
    setLastError(null);
    attemptEnqueue(itemId, itemType, count);
  }, [attemptEnqueue]);

  const queueWait = useCallback((turns: number) => {
    if (!Number.isFinite(turns) || turns <= 0) return;
    const waitTurns = Math.floor(turns);
    const newPlayer = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;
    const waitItem: QueueItem = {
      id: `wait-${crypto.randomUUID()}`,
      name: 'wait',
      type: 'Wait',
      remainingTime: waitTurns,
      massReserved: 0,
      energyReserved: 0,
      meta: { itemType: 'wait', waitTurns, enqueuedTurn: newPlayer.tick + 1 },
    };
    newPlayer.buildQueue.push(waitItem);
    applyPlayerState(newPlayer);
  }, [basePlayer, applyPlayerState]);

  const handleWaitConfirm = useCallback(() => {
    if (!pendingEnqueue) return;
    attemptEnqueue(pendingEnqueue.itemId, pendingEnqueue.itemType, pendingEnqueue.count, { allowAutoWait: true }, false);
    setPendingEnqueue(null);
  }, [pendingEnqueue, attemptEnqueue]);

  const handleQueueAnyway = useCallback(() => {
    if (!pendingEnqueue) return;
    if (pendingEnqueue.reason === 'workers') {
      setPendingEnqueue(null);
      return;
    }
    attemptEnqueue(pendingEnqueue.itemId, pendingEnqueue.itemType, pendingEnqueue.count, { allowNegativeStocks: true }, false);
    setPendingEnqueue(null);
  }, [pendingEnqueue, attemptEnqueue]);

  const handleCancelPending = useCallback(() => {
    setPendingEnqueue(null);
  }, []);

  const removeQueueItem = useCallback((itemId: string) => {
    const newPlayer = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;
    const res = cancelQueueItemImpl(newPlayer, itemId);
    if (!res.ok) {
      setLastError(res.reason || 'Unable to remove item');
      return;
    }
    setLastError(null);
    applyPlayerState(newPlayer);
    setSelectedQueueId(prev => (prev === itemId ? null : prev));
  }, [basePlayer, applyPlayerState]);

  const handleQueueReorder = useCallback((dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    const newPlayer = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;
    const targetIndex = newPlayer.buildQueue.findIndex(q => q.id === targetId);
    if (targetIndex === -1) return;
    const res = moveQueueItemGlobal(newPlayer, dragId, targetIndex);
    if (!res.ok) {
      setLastError(res.reason || 'Unable to move item');
      return;
    }
    setLastError(null);
    applyPlayerState(newPlayer);
    setSelectedQueueId(dragId);
  }, [basePlayer, applyPlayerState]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    const newPlayer = initializePlayer();
    setBasePlayer(newPlayer);
    setCurrentTurn(0);
    setLastError(null);
  }, []);

  // Format numbers for display - use explicit locale for consistency
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtIncome = (n: number) => (n >= 0 ? `+${fmt(n)}` : fmt(n));

  const groundSpaceUsed = (currentPlayer.meta?.ground_space_used as number) || 0;
  const groundSpaceMax = (currentPlayer.meta?.ground_space_max as number) || 60;
  const orbitalSpaceUsed = (currentPlayer.meta?.orbital_space_used as number) || 0;
  const orbitalSpaceMax = (currentPlayer.meta?.orbital_space_max as number) || 40;
  const groundSpaceRemaining = Math.max(groundSpaceMax - groundSpaceUsed, 0);
  const orbitalSpaceRemaining = Math.max(orbitalSpaceMax - orbitalSpaceUsed, 0);

  const leisureCount = currentPlayer.ownedBuildings.filter(b => b.name === 'leisure_centre' || b.name === 'leisure_center').length;
  const hospitalCount = currentPlayer.ownedBuildings.filter(b => b.name === 'hospital').length;
  const workerCount = currentPlayer.unitCounts?.worker || 0;
  const workerPercentGrowth = Math.floor(workerCount * 0.01);
  const workerBonusGrowth = Math.floor(workerCount * 0.005 * (leisureCount + hospitalCount));
  const foodIncome = currentPlayer.income.food;
  const hasFoodSupport = foodIncome >= 0 || currentPlayer.resources.food >= Math.abs(foodIncome);
  const workerGrowth = hasFoodSupport ? workerPercentGrowth + workerBonusGrowth : 0;
  const busyWorkers = Math.max(0, Number(currentPlayer.meta?.workers_busy || 0));
  const totalHousing = Object.entries(currentPlayer.meta || {}).reduce((acc, [key, value]) => {
    if (!key.startsWith('housing_')) return acc;
    return acc + Number(value || 0);
  }, 0);

  const resourceSummaries = [
    {
      key: 'metal',
      label: 'Metal',
      total: currentPlayer.resources.mass,
      income: currentPlayer.income.mass,
      abundance: Math.round(abundances.metal * 100),
      className: 'text-[#8f8c8c]',
      incomeClass: 'text-[#8f8c8c] font-semibold',
    },
    {
      key: 'mineral',
      label: 'Mineral',
      total: currentPlayer.resources.mineral,
      income: currentPlayer.income.mineral,
      abundance: Math.round(abundances.mineral * 100),
      className: 'text-orange-300',
      incomeClass: 'text-orange-300 font-semibold',
    },
    {
      key: 'food',
      label: 'Food',
      total: currentPlayer.resources.food,
      income: currentPlayer.income.food,
      abundance: Math.round(abundances.food * 100),
      className: 'text-green-300',
      incomeClass: 'text-green-300 font-semibold',
    },
    {
      key: 'energy',
      label: 'Energy',
      total: currentPlayer.resources.energy,
      income: currentPlayer.income.energy,
      abundance: 100,
      className: 'text-sky-300',
      incomeClass: 'text-sky-300 font-semibold',
    },
  ] as Array<{
    key: string;
    label: string;
    total: number;
    income: number;
    abundance: number | null;
    className: string;
    incomeClass: string;
    totalSuffix?: string;
  }>;

  return (
    <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text font-sans">
      {pendingEnqueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" data-testid="wait-modal">
          <div className="bg-pink-nebula-panel border border-pink-nebula-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Construction Delayed</h3>
            <p className="text-sm text-pink-nebula-muted">
              {pendingEnqueue.reason === 'workers'
                ? `More workers need to finish their current assignments before this project can start. Add a wait of ${pendingEnqueue.waitTurns} turn${pendingEnqueue.waitTurns === 1 ? '' : 's'} to free up crews.`
                : `Resources are not available yet. Add a wait of ${pendingEnqueue.waitTurns} turn${pendingEnqueue.waitTurns === 1 ? '' : 's'} to accumulate the required stockpile or queue anyway to allow deficits.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 border border-pink-nebula-border rounded hover:bg-pink-nebula-bg/60 text-sm"
                onClick={handleCancelPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-3 py-1 border border-pink-nebula-border rounded text-sm ${pendingEnqueue.reason === 'workers' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-pink-nebula-accent-secondary'}`}
                onClick={pendingEnqueue.reason === 'workers' ? undefined : handleQueueAnyway}
                disabled={pendingEnqueue.reason === 'workers'}
              >
                Queue Anyway
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-pink-nebula-accent-primary text-pink-nebula-text rounded hover:bg-pink-nebula-accent-secondary text-sm"
                onClick={handleWaitConfirm}
              >
                Add Wait
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-pink-nebula-panel px-6 py-4 flex items-center justify-between border-b border-pink-nebula-border">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-wide">Florent Simulator</span>
          <span className="text-pink-nebula-muted">Turn {currentPlayer.tick}</span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={resetSimulation}
            className="px-3 py-1 rounded bg-pink-nebula-accent-primary text-pink-nebula-text hover:bg-pink-nebula-accent-secondary"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Turn slider */}
      <div className="px-6 py-3 bg-pink-nebula-panel border-b border-pink-nebula-border">
        <div className="flex items-center gap-4">
          <span className="text-sm">View Turn:</span>
          <input
            type="range"
            min={0}
            max={maxTurn}
            value={currentTurn}
            onChange={(e) => setCurrentTurn(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            min={0}
            max={maxTurn}
            value={currentTurn}
            onChange={(e) => setCurrentTurn(Number(e.target.value))}
            className="w-20 px-2 py-1 bg-pink-nebula-bg border border-pink-nebula-border rounded"
          />
          <button
            className="px-2 py-1 text-sm border border-pink-nebula-border rounded hover:bg-pink-nebula-accent-secondary"
            onClick={() => {
              const target = basePlayer.meta?.queueCompletionTurn ?? basePlayer.tick;
              setCurrentTurn(target);
            }}
          >
            Jump to Queue End
          </button>
        </div>
      </div>

      {/* Error message */}
      {lastError && (
        <div className="px-6 py-2 bg-red-900/50 text-red-300 text-sm">
          {lastError}
        </div>
      )}

      {/* Main grid layout */}
      <main className="max-w-7xl mx-auto grid grid-cols-[320px_1fr_320px] gap-6 p-6">
        {/* Left column: Planet summary & completed structures */}
        <aside className="space-y-4">
          <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4" data-testid="home-planet-summary">
            <h2 className="text-lg font-bold mb-3">Home Planet</h2>
            <div className="space-y-3 text-sm">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-pink-nebula-border/40">
                  {resourceSummaries.map(resource => {
                    const label = resource.abundance === null
                      ? resource.label
                      : `${resource.label} (${resource.abundance}%)`;
                    const totalDisplay = resource.totalSuffix
                      ? `${fmt(resource.total)}${resource.totalSuffix}`
                      : fmt(resource.total);
                    return (
                      <tr key={resource.key}>
                        <td className={`${resource.className} font-medium py-1 w-32`}>{label}</td>
                        <td className={`${resource.incomeClass} py-1 text-right w-24`}>{fmtIncome(resource.income)}</td>
                        <td className={`${resource.className} py-1 text-right w-40`}>{totalDisplay}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-between">
                <span className="text-pink-nebula-muted">Space Remaining</span>
                <span>({groundSpaceRemaining}/{orbitalSpaceRemaining})</span>
              </div>
              <div className="pt-2 border-t border-pink-nebula-border space-y-1">
                <div className="flex justify-between text-pink-nebula-muted">
                  <span>Housing</span>
                  <span>{fmt(totalHousing)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="text-amber-200 font-medium py-1 w-32">Workers</td>
                      <td className="text-amber-200 font-semibold py-1 text-right w-24">{fmtIncome(workerGrowth)}</td>
                      <td className="text-amber-200 py-1 text-right w-40">{fmt(workerCount)}</td>
                    </tr>
                    <tr>
                      <td className="text-amber-200 font-medium py-1 w-32 text-xs">Busy Workers</td>
                      <td className="py-1 w-24" />
                      <td className="text-amber-200 py-1 text-right w-40 text-xs">{fmt(busyWorkers)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex justify-between">
                  <span className="text-rose-400">Soldiers</span>
                  <span className="text-rose-400">{fmt(currentPlayer.unitCounts?.soldier || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-300">Scientists</span>
                  <span className="text-yellow-300">{fmt(currentPlayer.unitCounts?.scientist || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4">
            <h2 className="text-lg font-bold mb-4">Completed Structures</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {Object.entries(
                currentPlayer.ownedBuildings.reduce<Record<string, number>>((acc, b) => {
                  const def = GameData.getStructureById(b.name);
                  const key = def?.id || b.name;
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {})
              ).map(([structureId, count]) => {
                const def = GameData.getStructureById(structureId);
                const productionTotals: Partial<Record<'metal' | 'mineral' | 'food' | 'energy', number>> = {};
                for (const prod of def?.operations?.production || []) {
                  if (!['metal', 'mineral', 'food', 'energy'].includes(prod.type)) continue;
                  const amount = Math.round((prod.base_amount || 0) * count);
                  if (amount === 0) continue;
                  productionTotals[prod.type as keyof typeof productionTotals] = (productionTotals[prod.type as keyof typeof productionTotals] || 0) + amount;
                }

                const consumptionTotals: Partial<Record<'metal' | 'mineral' | 'food' | 'energy', number>> = {};
                for (const cons of def?.operations?.consumption || []) {
                  if (cons.type !== 'resource' || !['metal', 'mineral', 'food', 'energy'].includes(cons.id)) continue;
                  const amount = Math.round((cons.amount || 0) * count);
                  if (amount === 0) continue;
                  consumptionTotals[cons.id as keyof typeof consumptionTotals] = (consumptionTotals[cons.id as keyof typeof consumptionTotals] || 0) + amount;
                }

                const spaceCost = (def?.build_requirements?.space_cost || []).reduce((acc, cost) => {
                  if (cost.type === 'ground_space') acc.ground += cost.amount || 0;
                  if (cost.type === 'orbital_space') acc.orbital += cost.amount || 0;
                  return acc;
                }, { ground: 0, orbital: 0 });

                return (
                  <div key={structureId} className="p-2 rounded bg-pink-nebula-bg border border-pink-nebula-border">
                    <div className="text-pink-nebula-text font-semibold flex justify-between">
                      <span>{def?.name || structureId}</span>
                      <span className="text-pink-nebula-muted text-sm">×{count}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      {spaceCost.ground > 0 && (
                        <span className="text-pink-nebula-muted">-{fmt(spaceCost.ground * count)} GS</span>
                      )}
                      {spaceCost.orbital > 0 && (
                        <span className="text-pink-nebula-muted">-{fmt(spaceCost.orbital * count)} OS</span>
                      )}
                      {Object.entries(productionTotals).map(([type, amount]) => (
                        <span key={`prod-${structureId}-${type}`} className={`${resourceColorMap[type] || 'text-pink-nebula-text'} font-semibold`}>+{fmt(amount)}</span>
                      ))}
                      {Object.entries(consumptionTotals).map(([type, amount]) => (
                        <span key={`cons-${structureId}-${type}`} className={`${resourceColorMap[type] || 'text-pink-nebula-text'} font-semibold`}>-{fmt(amount)}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Middle: Available to Build */}
        <section className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Available to Build</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('structures')}
                className={`px-3 py-1 rounded ${activeTab === 'structures' ? 'bg-pink-nebula-accent-primary text-pink-nebula-text' : 'text-pink-nebula-muted border border-pink-nebula-border'}`}
              >
                Structures
              </button>
              <button
                onClick={() => setActiveTab('ships')}
                className={`px-3 py-1 rounded ${activeTab === 'ships' ? 'bg-pink-nebula-accent-primary text-pink-nebula-text' : 'text-pink-nebula-muted border border-pink-nebula-border'}`}
              >
                Ships
              </button>
              <button
                onClick={() => setActiveTab('colonists')}
                className={`px-3 py-1 rounded ${activeTab === 'colonists' ? 'bg-pink-nebula-accent-primary text-pink-nebula-text' : 'text-pink-nebula-muted border border-pink-nebula-border'}`}
              >
                Colonists
              </button>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-pink-nebula-panel border-b border-pink-nebula-border">
                <tr className="text-pink-nebula-muted">
                  <th className="text-left font-medium py-2 px-2">Structure</th>
                  <th className="text-right font-medium py-2 px-2">Metal</th>
                  <th className="text-right font-medium py-2 px-2">Mineral</th>
                  <th className="text-right font-medium py-2 px-2">Food</th>
                  <th className="text-right font-medium py-2 px-2">Energy</th>
                  <th className="text-right font-medium py-2 px-2">Workers</th>
                  <th className="text-right font-medium py-2 px-2">Turns</th>
                </tr>
              </thead>
              <tbody>
                {availableItems.map(item => {
                  const canAfford = item.cost?.every(c => {
                    if (c.type === 'resource') {
                      if (c.id === 'metal') return currentPlayer.resources.mass >= c.amount;
                      if (c.id === 'mineral') return currentPlayer.resources.mineral >= c.amount;
                      if (c.id === 'food') return currentPlayer.resources.food >= c.amount;
                      if (c.id === 'energy') return currentPlayer.resources.energy >= c.amount;
                    }
                    if (c.type === 'unit') {
                      return (currentPlayer.unitCounts?.[c.id] || 0) >= c.amount;
                    }
                    return true;
                  }) ?? true;

                  const rowClasses = canAfford
                    ? 'hover:bg-pink-nebula-accent-secondary/10 cursor-pointer'
                    : 'bg-pink-nebula-bg/40 text-pink-nebula-muted cursor-pointer';

                  const costTotals: Record<'metal' | 'mineral' | 'food' | 'energy', number> = {
                    metal: 0,
                    mineral: 0,
                    food: 0,
                    energy: 0,
                  };

                  for (const cost of item.cost || []) {
                    if (cost.type === 'resource' && costTotals.hasOwnProperty(cost.id as keyof typeof costTotals)) {
                      const key = cost.id as keyof typeof costTotals;
                      costTotals[key] += Math.round(cost.amount || 0);
                    }
                  }

                  if ('operations' in item && item.operations?.consumption) {
                    for (const consumption of item.operations.consumption) {
                      if (consumption.type === 'resource' && consumption.id === 'energy') {
                        costTotals.energy -= Math.round(consumption.amount || 0);
                      }
                    }
                  }

                  const formatCost = (value: number, resourceId: keyof typeof costTotals) => {
                    if (value === 0) return '';
                    const color = resourceColorMap[resourceId];
                    const numeric = fmt(Math.abs(value));
                    const sign = value < 0 ? '-' : '';
                    return <span className={`${color} font-semibold`}>{`${sign}${numeric}`}</span>;
                  };

                  const workersCost = 'build_requirements' in item ? item.build_requirements?.workers_occupied || 0 : 0;
                  const turns = item.build_time_turns ?? 1;

                  return (
                    <tr
                      key={item.id}
                      data-testid={`available-${item.id}`}
                      className={`${rowClasses} border-b border-pink-nebula-border/40`}
                      onClick={() => {
                        queueItem(item.id, activeTab === 'structures' ? 'structure' : 'unit');
                      }}
                    >
                      <td className="py-2 px-2 text-pink-nebula-text font-semibold">{item.name}</td>
                      <td className="py-2 px-2 text-right">{formatCost(costTotals.metal, 'metal')}</td>
                      <td className="py-2 px-2 text-right">{formatCost(costTotals.mineral, 'mineral')}</td>
                      <td className="py-2 px-2 text-right">{formatCost(costTotals.food, 'food')}</td>
                      <td className="py-2 px-2 text-right">{formatCost(costTotals.energy, 'energy')}</td>
                      <td className="py-2 px-2 text-right">{workersCost > 0 ? fmt(workersCost) : ''}</td>
                      <td className="py-2 px-2 text-right text-pink-nebula-muted">{turns}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right column */}
        <aside className="space-y-4">
          {/* Build Queue */}
          <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4" data-testid="build-queue-panel">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">Build Queue</h2>
              <button
                className="text-sm border border-pink-nebula-border px-2 py-1 rounded hover:bg-pink-nebula-accent-secondary"
                onClick={() => {
                  const input = window.prompt('Wait how many turns?', '1');
                  if (!input) return;
                  const turns = Number(input);
                  if (Number.isFinite(turns) && turns > 0) queueWait(turns);
                }}
              >
                Add Wait
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              {queueTabs.map(tab => (
                <button
                  key={tab}
                  type="button"
                  data-testid={`queue-tab-${tab}`}
                  aria-pressed={queueTab === tab}
                  className={`px-3 py-1 rounded ${queueTab === tab ? 'bg-pink-nebula-accent-primary text-pink-nebula-text' : 'text-pink-nebula-muted border border-pink-nebula-border'}`}
                  onClick={() => setQueueTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {filteredBuildQueue.length === 0 ? (
                <div className="text-pink-nebula-muted text-sm">
                  {basePlayer.buildQueue.length === 0 ? 'Queue empty' : 'No items in this category'}
                </div>
              ) : (
                filteredBuildQueue.map((item, idx) => {
                  const def = item.meta?.itemType === 'structure' ? GameData.getStructureById(item.name) : GameData.getUnitById(item.name);
                  const isWait = item.meta?.itemType === 'wait' || item.type === 'Wait';
                  const displayName = isWait
                    ? `Wait for ${item.meta?.waitTurns ?? item.remainingTime ?? 0} turns`
                    : def?.name || item.name;
                  const turnLabel = item.meta?.startTurn ?? (basePlayer.tick + 1);
                  const info = isWait
                    ? `${item.meta?.waitTurns ?? item.remainingTime ?? 0} turns`
                    : `${def?.build_time_turns ?? 1} turns`;
                  const isSelected = item.id === selectedQueueId;
                  const isDragging = item.id === draggingQueueId;
                  const rowTone = isSelected
                    ? 'border-pink-nebula-accent-primary bg-pink-nebula-bg/70'
                    : idx % 2 === 0
                      ? 'bg-pink-nebula-bg border-pink-nebula-border'
                      : 'bg-pink-nebula-bg/60 border-pink-nebula-border/80';
                  return (
                    <div
                      key={item.id}
                      role="listitem"
                      data-testid={`queue-entry-${idx}`}
                      className={`p-2 rounded border transition-colors cursor-pointer ${rowTone} ${isDragging ? 'opacity-70' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        setDraggingQueueId(item.id);
                        try {
                          event.dataTransfer.setData('text/plain', item.id);
                        } catch {
                          // jsdom/dataTransfer can throw; ignore in tests
                        }
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedId = (() => {
                          try {
                            return event.dataTransfer.getData('text/plain');
                          } catch {
                            return null;
                          }
                        })() || draggingQueueId;
                        if (draggedId) {
                          handleQueueReorder(draggedId, item.id);
                        }
                        setDraggingQueueId(null);
                      }}
                      onDragEnd={() => setDraggingQueueId(null)}
                      onClick={() => {
                        setSelectedQueueId(prev => (prev === item.id ? null : item.id));
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-pink-nebula-text text-sm font-semibold flex items-center gap-2">
                          <span className="text-white font-bold">T{turnLabel}</span>
                          <span className="text-pink-nebula-muted">•</span>
                          <span>{displayName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-pink-nebula-muted text-xs">{info}</span>
                          {isSelected && (
                            <button
                              type="button"
                              data-testid={`queue-remove-${idx}`}
                              className="text-xs px-2 py-1 border border-pink-nebula-border rounded hover:bg-rose-500/20 hover:text-rose-200"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeQueueItem(item.id);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </aside>
      </main>
    </div>
  );
}
