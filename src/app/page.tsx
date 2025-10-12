"use client";
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import GameData from '../lib/game/dataManager';
import type { Unit as GUnit, Structure as GStructure } from '../lib/game/dataManager';
import { enqueueItem, processTick } from '../lib/game/agent';
import type { PlayerState, QueueItem } from '../lib/game/types';

// Client-only wrapper to prevent hydration mismatches
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  if (!hasMounted) {
    return null;
  }
  return <>{children}</>;
}

type TabType = 'structures' | 'ships' | 'colonists';

// Initialize player state with starting buildings
function initializePlayer(): PlayerState {
  return {
    resources: {
      mass: 30000,      // Starting metal
      mineral: 20000,   // Starting mineral
      food: 10000,      // Starting food
      energy: 1000      // Starting energy
    },
    income: { mass: 0, mineral: 0, food: 0, energy: 0 },
    ownedBuildings: [
      { id: 'outpost-0', name: 'outpost', builtAtTick: 0 },
      { id: 'metal_mine-0', name: 'metal_mine', builtAtTick: 0 },
      { id: 'metal_mine-1', name: 'metal_mine', builtAtTick: 0 },
      { id: 'metal_mine-2', name: 'metal_mine', builtAtTick: 0 },
    ],
    completedResearch: [],
    buildQueue: [],
    unitQueueByFactory: {},
    unitCounts: { worker: 50000, soldier: 0, scientist: 0 },
    tick: 0,
    meta: {
      housing_worker: 50000,
      housing_soldier: 100000,
      ground_space_used: 4,  // outpost + 3 mines
      ground_space_max: 60,
      orbital_space_used: 0,
      orbital_space_max: 50
    }
  };
}

// Calculate resource production/consumption
function calculateIncome(player: PlayerState, abundances: { metal: number; mineral: number; food: number }) {
  const income = { mass: 0, mineral: 0, food: 0, energy: 0 };

  for (const b of player.ownedBuildings) {
    const def = GameData.getStructureById(b.name);
    if (!def?.operations) continue;

    // Production
    const prods = def.operations.production || [];
    for (const p of prods) {
      let amt = p.base_amount || 0;
      if (p.is_abundance_scaled) {
        if (p.type === 'metal') amt *= abundances.metal;
        if (p.type === 'mineral') amt *= abundances.mineral;
        if (p.type === 'food') amt *= abundances.food;
      }
      if (p.type === 'metal') income.mass += Math.round(amt);
      else if (p.type === 'mineral') income.mineral += Math.round(amt);
      else if (p.type === 'food') income.food += Math.round(amt);
      else if (p.type === 'energy') income.energy += Math.round(amt);
    }

    // Consumption
    const cons = def.operations.consumption || [];
    for (const c of cons) {
      if (c.type === 'resource') {
        const amt = c.amount || 0;
        if (c.id === 'energy') income.energy -= amt;
        else if (c.id === 'metal') income.mass -= amt;
        else if (c.id === 'mineral') income.mineral -= amt;
        else if (c.id === 'food') income.food -= amt;
      }
    }
  }

  // Food consumption from population
  const totalPop = Object.entries(player.unitCounts || {}).reduce((sum, [type, count]) => {
    const unit = GameData.getUnitById(type);
    if (unit?.consumption) {
      for (const c of unit.consumption) {
        if (c.type === 'resource' && c.id === 'food' && 'amount_per_100_pop' in c) {
          income.food -= Math.round((count / 100) * (c.amount_per_100_pop || 0));
        }
      }
    }
    return sum + count;
  }, 0);

  return income;
}

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
  const [lastError, setLastError] = useState<string | null>(null);

  const abundances = { metal: 1, mineral: 1, food: 1 }; // 100% abundances

  // Calculate current player state at selected turn
  const currentPlayer = useMemo(() => {
    return simulateToTurn(basePlayer, currentTurn, abundances);
  }, [basePlayer, currentTurn]);

  // Update income when player state changes
  useEffect(() => {
    const income = calculateIncome(currentPlayer, abundances);
    currentPlayer.income = income;
  }, [currentPlayer]);

  // Get available items based on tab
  const availableItems = useMemo(() => {
    if (activeTab === 'structures') {
      return GameData.getAllStructures()
        .filter(s => {
          // Check if requirements are met
          if (s.requirements) {
            for (const req of s.requirements) {
              if (req.type === 'structure' && !currentPlayer.ownedBuildings.some(b => b.name === req.id)) {
                return false;
              }
              if (req.type === 'research_flag' && !currentPlayer.completedResearch.includes(req.id)) {
                return false;
              }
            }
          }
          // Check max_per_planet
          if (s.max_per_planet !== null && s.max_per_planet !== undefined) {
            const count = currentPlayer.ownedBuildings.filter(b => b.name === s.id).length;
            if (count >= s.max_per_planet) return false;
          }
          return true;
        });
    } else if (activeTab === 'ships') {
      return GameData.getAllUnits()
        .filter(u => u.category === 'ship')
        .filter(u => {
          if (u.requirements) {
            for (const req of u.requirements) {
              if (req.type === 'structure' && !currentPlayer.ownedBuildings.some(b => b.name === req.id)) {
                return false;
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
              if (req.type === 'structure' && !currentPlayer.ownedBuildings.some(b => b.name === req.id)) {
                return false;
              }
            }
          }
          return true;
        });
    }
  }, [activeTab, currentPlayer]);

  // Queue an item and advance time
  const queueItem = useCallback((itemId: string, itemType: 'structure' | 'unit') => {
    setLastError(null);

    // Clone player state
    const newPlayer = JSON.parse(JSON.stringify(basePlayer)) as PlayerState;

    // Try to enqueue
    const res = enqueueItem(newPlayer, itemId, itemType, 1);
    if (!res.ok) {
      setLastError(res.reason || 'Unable to queue item');
      return;
    }

    // Find the turn when this item will complete
    const def = itemType === 'structure' ? GameData.getStructureById(itemId) : GameData.getUnitById(itemId);
    const buildTime = def?.build_time_turns || 1;
    const completionTurn = newPlayer.tick + buildTime;

    // Simulate to that turn
    while (newPlayer.tick < completionTurn) {
      processTick(newPlayer, abundances, 1);
      newPlayer.income = calculateIncome(newPlayer, abundances);
    }

    // Update state
    setBasePlayer(newPlayer);
    setCurrentTurn(findNextEmptyTurn(newPlayer, abundances));
  }, [basePlayer, abundances]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    const newPlayer = initializePlayer();
    setBasePlayer(newPlayer);
    setCurrentTurn(0);
    setLastError(null);
  }, []);

  // Format numbers for display - use explicit locale for consistency
  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtIncome = (n: number) => n >= 0 ? `+${fmt(n)}` : fmt(n);

  // Get ground/orbital space usage
  const groundSpaceUsed = currentPlayer.meta?.ground_space_used as number || 0;
  const groundSpaceMax = currentPlayer.meta?.ground_space_max as number || 60;
  const orbitalSpaceUsed = currentPlayer.meta?.orbital_space_used as number || 0;
  const orbitalSpaceMax = currentPlayer.meta?.orbital_space_max as number || 50;

  return (
    <div className="min-h-screen bg-pink-nebula-bg text-pink-nebula-text font-sans">
      {/* Header */}
      <header className="bg-pink-nebula-panel px-6 py-4 flex items-center justify-between border-b border-pink-nebula-border">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-wide">Florent Simulator</span>
          <span className="text-pink-nebula-muted">Turn {currentPlayer.tick}</span>
        </div>
        <div className="flex items-center gap-6">
          <ClientOnly>
            <div className="flex gap-4 text-sm">
              <span>Metal: {fmt(currentPlayer.resources.mass)} <span className={currentPlayer.income.mass >= 0 ? 'text-green-400' : 'text-red-400'}>({fmtIncome(currentPlayer.income.mass)}/t)</span></span>
              <span>Mineral: {fmt(currentPlayer.resources.mineral)} <span className={currentPlayer.income.mineral >= 0 ? 'text-green-400' : 'text-red-400'}>({fmtIncome(currentPlayer.income.mineral)}/t)</span></span>
              <span>Food: {fmt(currentPlayer.resources.food)} <span className={currentPlayer.income.food >= 0 ? 'text-green-400' : 'text-red-400'}>({fmtIncome(currentPlayer.income.food)}/t)</span></span>
              <span>Energy: {fmt(currentPlayer.resources.energy)} <span className={currentPlayer.income.energy >= 0 ? 'text-green-400' : 'text-red-400'}>({fmtIncome(currentPlayer.income.energy)}/t)</span></span>
            </div>
          </ClientOnly>
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
        {/* Left: Completed Buildings */}
        <aside className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4">
          <h2 className="text-lg font-bold mb-4">Completed Structures</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {currentPlayer.ownedBuildings.map((b, idx) => {
              const def = GameData.getStructureById(b.name);
              return (
                <div key={`${b.id}-${idx}`} className="p-2 rounded bg-pink-nebula-bg border border-pink-nebula-border">
                  <div className="text-pink-nebula-text font-semibold">{def?.name || b.name}</div>
                  <div className="text-pink-nebula-muted text-xs">Built turn {b.builtAtTick}</div>
                </div>
              );
            })}
          </div>
          <ClientOnly>
            <div className="mt-4 pt-4 border-t border-pink-nebula-border space-y-1">
              <div className="text-sm">Workers: {fmt(currentPlayer.unitCounts?.worker || 0)}</div>
              <div className="text-sm">Soldiers: {fmt(currentPlayer.unitCounts?.soldier || 0)}</div>
              <div className="text-sm">Scientists: {fmt(currentPlayer.unitCounts?.scientist || 0)}</div>
            </div>
          </ClientOnly>
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

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
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

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded border ${canAfford ? 'bg-pink-nebula-bg border-pink-nebula-border hover:border-pink-nebula-accent-primary cursor-pointer' : 'bg-pink-nebula-bg/50 border-red-900/50'}`}
                  onClick={() => canAfford && queueItem(item.id, activeTab === 'structures' ? 'structure' : 'unit')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-pink-nebula-text font-semibold">{item.name}</div>
                      <div className="text-pink-nebula-muted text-xs">
                        {item.build_time_turns} turns •
                        {item.cost?.map(c => {
                          if (c.type === 'resource') {
                            return ` ${c.id}: ${c.amount}`;
                          }
                          if (c.type === 'unit') {
                            return ` ${c.id}: ${c.amount}`;
                          }
                          return '';
                        }).join(' •')}
                      </div>
                    </div>
                    {canAfford && (
                      <button className="px-3 py-1 rounded bg-pink-nebula-accent-primary text-pink-nebula-text hover:bg-pink-nebula-accent-secondary text-sm">
                        Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Build Queue & Planet Summary */}
        <aside className="space-y-4">
          {/* Build Queue */}
          <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4">
            <h2 className="text-lg font-bold mb-3">Build Queue</h2>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {currentPlayer.buildQueue.length === 0 ? (
                <div className="text-pink-nebula-muted text-sm">Queue empty</div>
              ) : (
                currentPlayer.buildQueue.map((item, idx) => (
                  <div key={item.id} className="p-2 rounded bg-pink-nebula-bg border border-pink-nebula-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-pink-nebula-text text-sm font-semibold">{item.name}</div>
                        <div className="text-pink-nebula-muted text-xs">
                          {idx === 0 ? `Building... ${item.remainingTime.toFixed(1)} turns left` : 'Queued'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Planet Summary */}
          <div className="bg-pink-nebula-panel rounded-lg border border-pink-nebula-border p-4">
            <h2 className="text-lg font-bold mb-3">Planet Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-pink-nebula-muted">Metal Abundance</span>
                <span>100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pink-nebula-muted">Mineral Abundance</span>
                <span>100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pink-nebula-muted">Food Abundance</span>
                <span>100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pink-nebula-muted">Ground Space</span>
                <span>{groundSpaceUsed}/{groundSpaceMax}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pink-nebula-muted">Orbital Space</span>
                <span>{orbitalSpaceUsed}/{orbitalSpaceMax}</span>
              </div>
              <ClientOnly>
                <div className="pt-2 border-t border-pink-nebula-border">
                  <div className="flex justify-between">
                    <span className="text-pink-nebula-muted">Workers</span>
                    <span>{fmt(currentPlayer.unitCounts?.worker || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pink-nebula-muted">Soldiers</span>
                    <span>{fmt(currentPlayer.unitCounts?.soldier || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-pink-nebula-muted">Scientists</span>
                    <span>{fmt(currentPlayer.unitCounts?.scientist || 0)}</span>
                  </div>
                </div>
              </ClientOnly>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}