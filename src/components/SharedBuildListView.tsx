"use client";

import React from 'react';
import type { ExtendedPlanetState } from '../lib/game/gameState';
import type { LaneEntry, LaneView } from '../lib/game/selectors';
import type { LaneId } from '../lib/sim/engine/types';
import { ALL_LANES, LANE_CONFIG } from '../lib/constants/lanes';

interface SharedBuildListViewProps {
  name: string;
  author: string;
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  currentTurn: number;
  lanes: Record<LaneId, LaneView | null>;
  defs: Record<string, any>;
  onPlanetSelect: (planetId: string) => void;
  onEdit: () => void;
}

export function SharedBuildListView({
  name,
  author,
  planets,
  currentPlanetId,
  currentTurn,
  lanes,
  defs,
  onPlanetSelect,
  onEdit,
}: SharedBuildListViewProps) {
  const planetList = Array.from(planets.values());
  const currentPlanet = planets.get(currentPlanetId) ?? planetList[0] ?? null;
  const totalItems = ALL_LANES.reduce((sum, laneId) => sum + (lanes[laneId]?.entries.length ?? 0), 0);

  return (
    <main className="flex-1 px-3 py-4 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-4">
        <section className="overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-950/90 via-[#15132d]/95 to-[#082234]/90 shadow-2xl shadow-cyan-950/25 ring-1 ring-white/10">
          <div className="border-b border-white/10 bg-cyan-300/[0.04] px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/70">Shared list</div>
                <h2 className="mt-1 truncate text-2xl font-black text-pink-nebula-text md:text-4xl">{name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-cyan-100/70">
                  <span>by {author}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-cyan-200/40 sm:inline-block" />
                  <span>{totalItems} queued item{totalItems === 1 ? '' : 's'}</span>
                  {currentPlanet && (
                    <>
                      <span className="hidden h-1 w-1 rounded-full bg-cyan-200/40 sm:inline-block" />
                      <span>{currentPlanet.name}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200/55 bg-gradient-to-r from-emerald-500/95 to-teal-400/90 px-5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 outline-none transition hover:brightness-110 focus:ring-2 focus:ring-emerald-200/45"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                Edit BL
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4 md:p-6">
            {planetList.length > 1 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/55">Planets in this share</div>
                <div className="flex flex-wrap gap-2">
                  {planetList.map((planet, index) => {
                    const active = planet.id === currentPlanetId;
                    return (
                      <button
                        key={planet.id}
                        type="button"
                        onClick={() => onPlanetSelect(planet.id)}
                        className={`rounded-2xl border px-4 py-2 text-left text-sm font-bold transition ${
                          active
                            ? 'border-cyan-200/60 bg-cyan-300/18 text-cyan-50 shadow-lg shadow-cyan-500/10'
                            : 'border-white/10 bg-white/[0.04] text-pink-nebula-muted hover:border-cyan-200/35 hover:text-pink-nebula-text'
                        }`}
                      >
                        <span className="mr-2 text-[10px] uppercase tracking-[0.18em] opacity-65">P{index + 1}</span>
                        {planet.name}
                        <span className="ml-2 text-xs opacity-60">T{planet.startTurn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {totalItems === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-pink-nebula-muted">
                This shared build list has no queued items yet.
              </div>
            ) : (
              <div
                aria-label="Shared build lanes"
                data-testid="shared-lane-board"
                className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4"
              >
                {ALL_LANES.map((laneId) => (
                  <SharedLaneCard
                    key={laneId}
                    laneId={laneId}
                    lane={lanes[laneId]}
                    currentTurn={currentTurn}
                    defs={defs}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SharedLaneCard({
  laneId,
  lane,
  currentTurn,
  defs,
}: {
  laneId: LaneId;
  lane: LaneView | null;
  currentTurn: number;
  defs: Record<string, any>;
}) {
  const config = LANE_CONFIG[laneId];
  const entries = [...(lane?.entries ?? [])].sort(compareEntries);

  return (
    <section
      aria-label={`${config.title} shared lane`}
      className="flex min-w-0 flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-slate-950/25 p-3 shadow-xl shadow-black/15 md:p-4"
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-lg shadow-[0_0_18px_rgba(34,211,238,0.12)]" aria-hidden="true">
          {config.icon}
        </span>
        <div>
          <h3 className="text-lg font-black text-pink-nebula-text">{config.title}</h3>
          <p className="text-xs text-pink-nebula-muted">{entries.length} item{entries.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/25 px-4 py-6 text-center text-sm text-pink-nebula-muted">
          No {config.title.toLowerCase()} queued.
        </div>
      ) : (
        <div className="scroll-nebula min-h-0 space-y-2 xl:max-h-[68vh] xl:overflow-y-auto xl:pr-1">
          {entries.map((entry) => (
            <SharedLaneRow
              key={entry.id}
              entry={entry}
              def={defs[entry.itemId]}
              currentTurn={currentTurn}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SharedLaneRow({
  entry,
  def,
  currentTurn,
}: {
  entry: LaneEntry;
  def?: any;
  currentTurn: number;
}) {
  const start = entry.startTurn ?? entry.queuedTurn ?? '?';
  const end = entry.completionTurn ?? entry.eta ?? '?';
  const duration = entry.isWait ? getWaitTurns(entry) : entry.turnsRemaining ?? def?.duration ?? null;
  const status = getDisplayStatus(entry, currentTurn);

  return (
    <div className={`rounded-2xl border px-3 py-3 font-mono text-sm ${rowClass(status, entry.invalid)}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.08em] text-cyan-100/65">
          T{start} - T{end}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-right">
          {entry.quantity > 1 && <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-pink-nebula-text">x{entry.quantity}</span>}
          {duration !== null && <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-pink-nebula-muted">{duration}T</span>}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-bold text-pink-nebula-text">{formatEntryName(entry)}</div>
        {entry.invalid && entry.invalidReason && (
          <div className="mt-1 truncate text-xs text-orange-300">{entry.invalidReason}</div>
        )}
      </div>
    </div>
  );
}

function compareEntries(a: LaneEntry, b: LaneEntry): number {
  return getEntryTurn(a) - getEntryTurn(b);
}

function getEntryTurn(entry: LaneEntry): number {
  return entry.startTurn ?? entry.queuedTurn ?? entry.completionTurn ?? entry.eta ?? 0;
}

function getDisplayStatus(entry: LaneEntry, currentTurn: number): LaneEntry['status'] {
  const start = entry.startTurn ?? entry.queuedTurn ?? 0;
  const finish = entry.completionTurn ?? entry.eta ?? 999;
  if (finish <= currentTurn) return 'completed';
  if (start <= currentTurn && currentTurn < finish) return 'active';
  return entry.status;
}

function formatEntryName(entry: LaneEntry): string {
  if (entry.isAutoWait) return `Auto-wait: ${getWaitTurns(entry)}t`;
  if (entry.isWait) return `Manual wait: ${getWaitTurns(entry)}t`;
  return entry.itemName;
}

function getWaitTurns(entry: LaneEntry): number | string {
  if (!entry.isWait) return entry.turnsRemaining;
  if (entry.turnsRemaining > 0) return entry.turnsRemaining;

  const start = entry.startTurn ?? entry.queuedTurn;
  const end = entry.completionTurn ?? entry.eta ?? undefined;
  if (start !== undefined && end !== undefined && end > start) {
    return end - start;
  }

  return entry.turnsRemaining || '?';
}

function rowClass(status: LaneEntry['status'], invalid?: boolean): string {
  if (invalid) return 'border-orange-300/35 bg-orange-500/10';
  if (status === 'completed') return 'border-emerald-300/20 bg-emerald-500/[0.08]';
  if (status === 'active') return 'border-yellow-200/35 bg-yellow-400/[0.10]';
  return 'border-blue-200/15 bg-slate-950/28';
}
