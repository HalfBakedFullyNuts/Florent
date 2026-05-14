type WaitDurationLike = {
  isWait?: boolean;
  status?: string;
  turnsRemaining?: number;
  queuedTurn?: number;
  startTurn?: number;
  completionTurn?: number;
  eta?: number | null;
  /** Set when the wait was activated in Phase 2b (no first-tick that turn). */
  isPhase2bWait?: boolean;
};

/**
 * Returns the original planned wait length, not just the remaining countdown.
 *
 * Completed and pending projected rows use inclusive turn windows (T1-T5 = 5T).
 * Active rows expose an ETA that behaves like an exclusive end while the item is
 * still ticking, so active waits are derived from elapsed + remaining time.
 */
export function getPlannedWaitTurns(entry: WaitDurationLike, currentTurn?: number): number | undefined {
  if (!entry.isWait) return undefined;

  const remaining = entry.turnsRemaining ?? 0;
  const start = entry.startTurn ?? entry.queuedTurn;
  const end = entry.completionTurn ?? entry.eta ?? undefined;

  if (entry.status === 'active') {
    if (start !== undefined && currentTurn !== undefined && remaining > 0) {
      // Phase 2b waits (isPhase2bWait=true) activate in the same turn a prerequisite
      // completes but do not receive a first tick that turn. Their startTurn is the
      // activation turn (correct for encoding), but the elapsed formula overcounts by 1.
      // Subtracting 1 gives the correct planned duration throughout the wait's lifetime.
      const phase2bOffset = entry.isPhase2bWait ? 1 : 0;
      return Math.max(1, currentTurn - start + remaining - phase2bOffset);
    }
    if (start !== undefined && end !== undefined && end >= start) {
      return Math.max(1, end - start);
    }
  }

  if (entry.status === 'pending' && entry.startTurn === undefined && remaining > 0) {
    return remaining;
  }

  if (start !== undefined && end !== undefined && end >= start) {
    return Math.max(1, end - start + 1);
  }

  return remaining > 0 ? remaining : undefined;
}

export function formatPlannedWaitTurns(entry: WaitDurationLike, currentTurn?: number): number | string {
  return getPlannedWaitTurns(entry, currentTurn)
    ?? (entry.turnsRemaining && entry.turnsRemaining > 0 ? entry.turnsRemaining : '?');
}
