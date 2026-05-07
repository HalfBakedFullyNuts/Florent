"use client";

import React from "react";
import type { ExtendedPlanetState } from "../lib/game/gameState";
import {
  getPlanetSummary,
  type LaneEntry,
  type LaneView,
} from "../lib/game/selectors";
import type { LaneId } from "../lib/sim/engine/types";
import { ALL_LANES, LANE_CONFIG } from "../lib/constants/lanes";
import { formatPlannedWaitTurns } from "../lib/game/waitDuration";
import type { MultiPlanetExportData } from "../lib/export/formatters";

const SUMMARY_TURN = 200;
const OFFICIAL_GAME_URL = "https://www.infiniteconflict.com/";

interface SharedBuildListViewProps {
  name: string;
  author: string;
  planets: Map<string, ExtendedPlanetState>;
  currentPlanetId: string;
  currentTurn: number;
  lanes: Record<LaneId, LaneView | null>;
  multiPlanetData?: MultiPlanetExportData;
  defs: Record<string, any>;
  onPlanetSelect: (planetId: string) => void;
  onExit: () => void;
  onEdit: () => void;
}

interface SummaryInput {
  name: string;
  planets: Map<string, ExtendedPlanetState>;
  lanes: Record<LaneId, LaneView | null>;
  multiPlanetData?: MultiPlanetExportData;
}

interface SummaryFact {
  label: string;
  value: string;
}

export interface SharedBuildListSummary {
  facts: SummaryFact[];
  description: string;
}

type ManagedMetaName =
  | "description"
  | "og:title"
  | "og:description"
  | "twitter:title"
  | "twitter:description";

interface ManagedMeta {
  key: ManagedMetaName;
  element: HTMLMetaElement;
  previousContent: string | null;
  created: boolean;
}

export function SharedBuildListView({
  name,
  author,
  planets,
  currentPlanetId,
  currentTurn,
  lanes,
  multiPlanetData,
  defs,
  onPlanetSelect,
  onExit,
  onEdit,
}: SharedBuildListViewProps) {
  const planetList = Array.from(planets.values());
  const totalItems = ALL_LANES.reduce(
    (sum, laneId) => sum + (lanes[laneId]?.entries.length ?? 0),
    0,
  );
  const summary = React.useMemo(
    () => buildSharedBuildListSummary({ name, planets, lanes, multiPlanetData }),
    [name, planets, lanes, multiPlanetData],
  );
  const originalPageMetadata = React.useRef<{
    title: string;
    metas: ManagedMeta[];
  } | null>(null);

  React.useEffect(() => {
    if (typeof document === "undefined" || summary.description.length === 0) {
      return;
    }

    if (!originalPageMetadata.current) {
      originalPageMetadata.current = {
        title: document.title,
        metas: [
          prepareManagedMeta("description"),
          prepareManagedMeta("og:title"),
          prepareManagedMeta("og:description"),
          prepareManagedMeta("twitter:title"),
          prepareManagedMeta("twitter:description"),
        ],
      };
    }

    const pageTitle = `${name || "Shared build list"} | Infinite Conflict`;
    document.title = pageTitle;
    for (const meta of originalPageMetadata.current.metas) {
      meta.element.setAttribute(
        "content",
        meta.key.endsWith("title") ? pageTitle : summary.description,
      );
    }
  }, [name, summary.description]);

  React.useEffect(() => {
    return () => {
      if (typeof document === "undefined" || !originalPageMetadata.current) {
        return;
      }

      document.title = originalPageMetadata.current.title;
      for (const meta of originalPageMetadata.current.metas) {
        if (meta.created) {
          meta.element.remove();
        } else if (meta.previousContent === null) {
          meta.element.removeAttribute("content");
        } else {
          meta.element.setAttribute("content", meta.previousContent);
        }
      }
    };
  }, []);

  return (
    <main className="flex-1 px-3 py-3 md:px-6 md:py-5">
      <div className="mx-auto w-full max-w-[1500px] space-y-3">
        <section className="overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-slate-950/90 via-[#15132d]/95 to-[#082234]/90 shadow-2xl shadow-cyan-950/25 ring-1 ring-white/10">
          <div className="border-b border-white/10 bg-cyan-300/[0.04] px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/70">
                  Shared list
                </div>
                <h2 className="mt-1 truncate text-2xl font-black text-pink-nebula-text md:text-3xl">
                  {name}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-cyan-100/70 md:text-sm">
                  <span>by {author}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-cyan-200/40 sm:inline-block" />
                  <span>
                    {totalItems} queued item{totalItems === 1 ? "" : "s"}
                  </span>
                  <span className="hidden h-1 w-1 rounded-full bg-cyan-200/40 sm:inline-block" />
                  <a
                    href={OFFICIAL_GAME_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-cyan-100 underline decoration-cyan-200/35 underline-offset-4 transition hover:text-white hover:decoration-cyan-100"
                  >
                    Infinite Conflict
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black text-cyan-50 shadow-lg shadow-black/15 outline-none transition hover:border-cyan-200/35 hover:bg-white/[0.1] focus:ring-2 focus:ring-cyan-200/30"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 18l-6-6 6-6" />
                    <path d="M21 12H9" />
                  </svg>
                  Exit
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200/55 bg-gradient-to-r from-emerald-500/95 to-teal-400/90 px-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 outline-none transition hover:brightness-110 focus:ring-2 focus:ring-emerald-200/45"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                  Edit BL
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 md:p-4">
            {summary.facts.length > 0 && (
              <div
                aria-label="Build list summary"
                className="rounded-2xl border border-cyan-200/15 bg-slate-950/28 p-3"
              >
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/55">
                  Build list summary
                </div>
                <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {summary.facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2"
                    >
                      <dt className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/55">
                        {fact.label}
                      </dt>
                      <dd className="mt-1 text-sm font-black text-pink-nebula-text">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {planetList.length > 1 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/55">
                  Planets in this share
                </div>
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
                            ? "border-cyan-200/60 bg-cyan-300/18 text-cyan-50 shadow-lg shadow-cyan-500/10"
                            : "border-white/10 bg-white/[0.04] text-pink-nebula-muted hover:border-cyan-200/35 hover:text-pink-nebula-text"
                        }`}
                      >
                        <span className="mr-2 text-[10px] uppercase tracking-[0.18em] opacity-65">
                          P{index + 1}
                        </span>
                        <span className="ml-2 text-xs opacity-60">
                          T{planet.startTurn}
                        </span>
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
                className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-4"
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

export function buildSharedBuildListSummary({
  name,
  planets,
  lanes,
  multiPlanetData,
}: SummaryInput): SharedBuildListSummary {
  const facts: SummaryFact[] = [];
  const trimmedName = name.trim();
  if (trimmedName.length > 0) {
    facts.push({ label: "Build list", value: trimmedName });
  }

  const laneEntries = collectSummaryEntries(lanes, multiPlanetData);
  const firstOutpost = findEarliestCompletion(laneEntries, "outpost_ship");
  const firstInvasion = findEarliestCompletion(laneEntries, "invasion_ship");
  const firstSoldiers = findEarliestCompletion(laneEntries, "soldier");
  const outpostsBeforeTurnLimit = countQuantityStartingBefore(
    laneEntries,
    "outpost_ship",
    SUMMARY_TURN,
  );

  if (firstOutpost !== null) {
    facts.push({ label: "First outpost ship", value: `T${firstOutpost}` });
  }
  if (firstInvasion !== null) {
    facts.push({ label: "First invasion ship", value: `T${firstInvasion}` });
  }
  if (firstSoldiers !== null) {
    facts.push({ label: "First soldiers", value: `T${firstSoldiers}` });
  }
  if (outpostsBeforeTurnLimit > 0) {
    facts.push({
      label: `Outposts started before T${SUMMARY_TURN}`,
      value: formatCount(outpostsBeforeTurnLimit),
    });
  }

  const homeSummary = getHomeSummaryAtTurn(planets, SUMMARY_TURN);
  if (homeSummary) {
    facts.push({
      label: `Home output T${SUMMARY_TURN}`,
      value: [
        `M ${formatSignedCount(homeSummary.outputsPerTurn.metal)}`,
        `Min ${formatSignedCount(homeSummary.outputsPerTurn.mineral)}`,
        `F ${formatSignedCount(homeSummary.outputsPerTurn.food)}`,
      ].join(" / "),
    });
    facts.push({
      label: `Home pop T${SUMMARY_TURN}`,
      value: [
        `W ${formatCount(homeSummary.population.workersTotal)}`,
        `S ${formatCount(homeSummary.population.soldiers)}`,
        `Sci ${formatCount(homeSummary.population.scientists)}`,
      ].join(" / "),
    });
  }

  return {
    facts,
    description: facts
      .map((fact) => `${fact.label}: ${fact.value}`)
      .join(" | "),
  };
}

function collectSummaryEntries(
  lanes: Record<LaneId, LaneView | null>,
  multiPlanetData?: MultiPlanetExportData,
): LaneEntry[] {
  if (multiPlanetData?.planets.length) {
    return multiPlanetData.planets.flatMap((planet) =>
      planet.lanes.flatMap((lane) => lane.entries),
    );
  }

  return ALL_LANES.filter((laneId) => laneId !== "research").flatMap(
    (laneId) => lanes[laneId]?.entries ?? [],
  );
}

function findEarliestCompletion(
  entries: LaneEntry[],
  itemId: string,
): number | null {
  let earliest: number | null = null;
  for (const entry of entries) {
    if (entry.itemId !== itemId) continue;
    const completionTurn = entry.completionTurn ?? entry.eta;
    if (typeof completionTurn !== "number" || completionTurn < 1) continue;
    earliest =
      earliest === null ? completionTurn : Math.min(earliest, completionTurn);
  }
  return earliest;
}

function countQuantityStartingBefore(
  entries: LaneEntry[],
  itemId: string,
  turnLimit: number,
): number {
  return entries.reduce((sum, entry) => {
    if (entry.itemId !== itemId) return sum;
    const startTurn = entry.startTurn ?? entry.queuedTurn;
    if (typeof startTurn !== "number" || startTurn >= turnLimit) return sum;
    return sum + Math.max(1, entry.quantity || 1);
  }, 0);
}

function getHomeSummaryAtTurn(
  planets: Map<string, ExtendedPlanetState>,
  turn: number,
) {
  const home = Array.from(planets.values())[0];
  if (!home) return null;

  const stateAtTurn = home.timeline?.getStateAtTurn(turn) ?? home;
  try {
    return getPlanetSummary(stateAtTurn);
  } catch {
    return null;
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatSignedCount(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${formatCount(rounded)}/t`;
}

function prepareManagedMeta(key: ManagedMetaName): ManagedMeta {
  const selector = getMetaSelector(key);
  const existing = document.querySelector(selector);
  if (existing instanceof HTMLMetaElement) {
    return {
      key,
      element: existing,
      previousContent: existing.getAttribute("content"),
      created: false,
    };
  }

  const meta = document.createElement("meta");
  const attribute = key.startsWith("og:") ? "property" : "name";
  meta.setAttribute(attribute, key);
  document.head.appendChild(meta);
  return {
    key,
    element: meta,
    previousContent: null,
    created: true,
  };
}

function getMetaSelector(key: ManagedMetaName): string {
  return key.startsWith("og:")
    ? `meta[property="${key}"]`
    : `meta[name="${key}"]`;
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
      className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.04] to-slate-950/25 p-2 shadow-xl shadow-black/15 md:p-2.5"
    >
      <div className="mb-1.5 flex items-center gap-2 border-b border-white/10 pb-1.5">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-300/10 text-sm shadow-[0_0_18px_rgba(34,211,238,0.12)]"
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate text-sm font-black text-pink-nebula-text md:text-base">
            {config.title}
          </h3>
          <p className="shrink-0 text-[11px] text-pink-nebula-muted">
            {entries.length} item{entries.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/25 px-3 py-2.5 text-center text-xs text-pink-nebula-muted">
          No {config.title.toLowerCase()} queued.
        </div>
      ) : (
        <div className="scroll-nebula min-h-0 space-y-1 xl:max-h-[62vh] xl:overflow-y-auto xl:pr-1">
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
  const start = entry.startTurn ?? entry.queuedTurn ?? "?";
  const end = entry.completionTurn ?? entry.eta ?? "?";
  const duration = getDurationTurns(entry, def, currentTurn);
  const status = getDisplayStatus(entry, currentTurn);

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs ${rowClass(status, entry.invalid)}`}
    >
      <div className="grid min-w-0 grid-cols-[4.75rem_1fr_auto] items-center gap-2">
        <div className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.08em] text-cyan-100/65">
          T{start} - T{end}
        </div>
        <div className="min-w-0 truncate font-bold text-pink-nebula-text">
          {formatEntryName(entry, currentTurn)}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 text-right">
          {entry.quantity > 1 && (
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-pink-nebula-text">
              x{entry.quantity}
            </span>
          )}
          {duration !== null && (
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-pink-nebula-muted">
              {duration}T
            </span>
          )}
        </div>
      </div>
      {entry.invalid && entry.invalidReason && (
        <div className="mt-1 min-w-0">
          <div className="truncate text-xs text-orange-300">
            {entry.invalidReason}
          </div>
        </div>
      )}
    </div>
  );
}

function compareEntries(a: LaneEntry, b: LaneEntry): number {
  return getEntryTurn(a) - getEntryTurn(b);
}

function getEntryTurn(entry: LaneEntry): number {
  return (
    entry.startTurn ??
    entry.queuedTurn ??
    entry.completionTurn ??
    entry.eta ??
    0
  );
}

function getDisplayStatus(
  entry: LaneEntry,
  currentTurn: number,
): LaneEntry["status"] {
  const start = entry.startTurn ?? entry.queuedTurn ?? 0;
  const finish = entry.completionTurn ?? entry.eta ?? 999;
  if (finish <= currentTurn) return "completed";
  if (start <= currentTurn && currentTurn < finish) return "active";
  return entry.status;
}

function formatEntryName(entry: LaneEntry, currentTurn: number): string {
  if (entry.isAutoWait)
    return `Auto-wait: ${getWaitTurns(entry, currentTurn)}t`;
  if (entry.isWait) return `Manual wait: ${getWaitTurns(entry, currentTurn)}t`;
  return entry.itemName;
}

function getWaitTurns(entry: LaneEntry, currentTurn: number): number | string {
  if (!entry.isWait) return entry.turnsRemaining;
  return formatPlannedWaitTurns(entry, currentTurn);
}

function getDurationTurns(
  entry: LaneEntry,
  def?: any,
  currentTurn?: number,
): number | string | null {
  if (entry.isWait)
    return getWaitTurns(entry, currentTurn ?? entry.startTurn ?? 0);
  if (entry.turnsRemaining > 0) return entry.turnsRemaining;
  if (def?.durationTurns !== undefined || def?.duration !== undefined) {
    return def?.durationTurns ?? def?.duration;
  }

  const start = entry.startTurn ?? entry.queuedTurn;
  const end = entry.completionTurn ?? entry.eta ?? undefined;
  if (start !== undefined && end !== undefined && end >= start) {
    return end - start + 1;
  }

  return entry.turnsRemaining ?? null;
}

function rowClass(status: LaneEntry["status"], invalid?: boolean): string {
  if (invalid) return "border-orange-300/35 bg-orange-500/10";
  if (status === "completed")
    return "border-emerald-300/20 bg-emerald-500/[0.08]";
  if (status === "active") return "border-yellow-200/35 bg-yellow-400/[0.10]";
  return "border-blue-200/15 bg-slate-950/28";
}
