"use client";

import React from "react";
import { ArrowLeft, Building2, FlaskConical, Pencil, Rocket, Users, type LucideIcon } from "lucide-react";
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
const LANE_ICONS: Record<LaneId, LucideIcon> = {
  building: Building2,
  ship: Rocket,
  colonist: Users,
  research: FlaskConical,
};
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
    <main className="flex-1 px-4 py-6 md:px-6">
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-4 border-b border-filament pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="eyebrow">Shared list</div>
            <h2 className="mt-1 truncate text-[28px] font-bold leading-9 text-ink">
              {name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
              <span>by {author}</span>
              <span aria-hidden="true" className="text-ink-3">·</span>
              <span>
                {totalItems} queued item{totalItems === 1 ? "" : "s"}
              </span>
              <span aria-hidden="true" className="text-ink-3">·</span>
              <a
                href={OFFICIAL_GAME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink underline decoration-edge underline-offset-4 transition-colors hover:decoration-ink"
              >
                Infinite Conflict
              </a>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onExit} className="btn btn-secondary">
              <ArrowLeft aria-hidden="true" />
              Exit
            </button>
            <button type="button" onClick={onEdit} className="btn btn-primary">
              <Pencil aria-hidden="true" />
              Edit BL
            </button>
          </div>
        </header>

        {summary.facts.length > 0 && (
          <section aria-label="Build list summary" className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Build list summary</h3>
            </div>
            <dl className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {summary.facts.map((fact) => (
                <div key={fact.label} className="well min-w-0 px-3 py-2.5">
                  <dt className="eyebrow truncate">{fact.label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {planetList.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Planets in this share</span>
            <div className="seg flex-wrap">
              {planetList.map((planet, index) => (
                <button
                  key={planet.id}
                  type="button"
                  onClick={() => onPlanetSelect(planet.id)}
                  aria-pressed={planet.id === currentPlanetId}
                  className="seg-item"
                >
                  <span>P{index + 1}</span>
                  <span className="text-xs font-normal text-ink-3">T{planet.startTurn}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {totalItems === 0 ? (
          <div className="panel p-8 text-center text-sm text-ink-2">
            This shared build list has no queued items yet.
          </div>
        ) : (
          <div
            aria-label="Shared build lanes"
            data-testid="shared-lane-board"
            className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4"
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
  const LaneGlyph = LANE_ICONS[laneId];
  const entries = [...(lane?.entries ?? [])].sort(compareEntries);

  return (
    <section
      aria-label={`${config.title} shared lane`}
      className="panel flex min-w-0 flex-col overflow-hidden"
    >
      <div className="panel-head">
        <LaneGlyph className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
        <h3 className="panel-title truncate">{config.title}</h3>
        <span className="chip ml-auto">
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="px-3 py-4 text-center text-sm text-ink-2">
          No {config.title.toLowerCase()} queued.
        </div>
      ) : (
        <div className="scroll-nebula min-h-0 divide-y divide-filament/60 xl:max-h-[62vh] xl:overflow-y-auto">
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
    <div className={`border-l-2 text-[13px] ${rowClass(status, entry.invalid)}`}>
      <div className="grid h-9 min-w-0 grid-cols-[5.5rem_1fr_auto] items-center gap-2 px-3">
        <div className="whitespace-nowrap text-xs text-ink-3">
          T{start} – T{end}
        </div>
        <div className={`min-w-0 truncate font-semibold ${status === "completed" ? "text-ink-2" : "text-ink"}`}>
          {formatEntryName(entry, currentTurn)}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5 text-xs text-ink-2">
          {entry.quantity > 1 && <span className="chip h-5 px-1.5">×{entry.quantity}</span>}
          {duration !== null && <span className="w-8 text-right">{duration}T</span>}
        </div>
      </div>
      {entry.invalid && entry.invalidReason && (
        <div className="-mt-1 truncate px-3 pb-2 text-xs text-danger">
          {entry.invalidReason}
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
  if (invalid) return "border-l-danger";
  if (status === "active") return "border-l-halpha bg-halpha-deep";
  return "border-l-transparent";
}
