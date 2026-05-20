// Fallback round start used when the user hasn't calibrated the clock.
// Update this constant at the start of each new round, or just let users calibrate.
const FALLBACK_ROUND_START_MS = Date.UTC(2026, 4, 10, 18, 0, 0);
const STORAGE_KEY = 'ic_round_start_ms';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Read the calibrated round-start from localStorage, falling back to the hardcoded default. */
export function getRoundStartMs(): number {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number(stored);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return FALLBACK_ROUND_START_MS;
}

/**
 * Calibrate the round start using the current browser time and the user's
 * known in-game tick number. Persists to localStorage.
 */
export function setRoundStartFromTick(currentTick: number): void {
  const roundStart = Date.now() - currentTick * 3_600_000;
  localStorage.setItem(STORAGE_KEY, String(roundStart));
}

/** Clear calibration and revert to the hardcoded fallback. */
export function clearRoundStartCalibration(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function tickToWallTime(turn: number, roundStartMs?: number): Date {
  return new Date((roundStartMs ?? getRoundStartMs()) + turn * 3_600_000);
}

/** "Sun 23:00" compact GMT label for use in UI and exports. */
export function formatTickTime(turn: number, roundStartMs?: number): string {
  const d = tickToWallTime(turn, roundStartMs);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAY[d.getUTCDay()]} ${h}:${m}`;
}

/** "Sun 10 May 23:00 GMT" verbose label for tooltips. */
export function formatTickTimeFull(turn: number, roundStartMs?: number): string {
  const d = tickToWallTime(turn, roundStartMs);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${h}:${m} GMT`;
}
