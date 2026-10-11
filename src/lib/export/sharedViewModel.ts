/**
 * Row model of the shared build-list view, used by the page (SharedBuildListView) and by the
 * image export so both show the same entries, spans, names and durations.
 */

import type { LaneEntry, LaneView } from '../game/selectors';
import type { LaneId } from '../sim/engine/types';
import { formatPlannedWaitTurns } from '../game/waitDuration';

export interface SharedViewRow {
  id: string;
  /** "T5 – T8" */
  span: string;
  name: string;
  quantity: number;
  duration: number | string | null;
  status: LaneEntry['status'];
  invalid: boolean;
  invalidReason?: string;
}

export interface SharedViewLane {
  laneId: LaneId;
  title: string;
  rows: SharedViewRow[];
}

/** Rows of one lane in start-turn order, with status relative to the viewed turn. */
export function buildSharedLaneRows(lane: LaneView | null, defs: Record<string, any>, currentTurn: number): SharedViewRow[] {
  const entries = [...(lane?.entries ?? [])].sort(compareEntries);
  return entries.map((entry) => ({
    id: entry.id,
    span: `T${entry.startTurn ?? entry.queuedTurn ?? '?'} – T${entry.completionTurn ?? entry.eta ?? '?'}`,
    name: formatEntryName(entry, currentTurn),
    quantity: entry.quantity,
    duration: getDurationTurns(entry, defs[entry.itemId], currentTurn),
    status: getDisplayStatus(entry, currentTurn),
    invalid: entry.invalid === true,
    invalidReason: entry.invalidReason,
  }));
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

function formatEntryName(entry: LaneEntry, currentTurn: number): string {
  if (entry.isAutoWait) return `Auto-wait: ${getWaitTurns(entry, currentTurn)}t`;
  if (entry.isWait) return `Manual wait: ${getWaitTurns(entry, currentTurn)}t`;
  return entry.itemName;
}

function getWaitTurns(entry: LaneEntry, currentTurn: number): number | string {
  if (!entry.isWait) return entry.turnsRemaining;
  return formatPlannedWaitTurns(entry, currentTurn);
}

function getDurationTurns(entry: LaneEntry, def: any, currentTurn: number): number | string | null {
  if (entry.isWait) return getWaitTurns(entry, currentTurn);
  if (entry.turnsRemaining > 0) return entry.turnsRemaining;
  if (def?.durationTurns !== undefined || def?.duration !== undefined) {
    return def?.durationTurns ?? def?.duration;
  }
  const start = entry.startTurn ?? entry.queuedTurn;
  const end = entry.completionTurn ?? entry.eta ?? undefined;
  if (start !== undefined && end !== undefined && end >= start) return end - start + 1;
  return entry.turnsRemaining ?? null;
}
