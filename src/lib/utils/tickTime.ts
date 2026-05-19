// Round start: 2026-05-10 18:00 UTC (6 pm GMT, first tick spans 6→7 pm).
// Update ROUND_START_MS at the start of each new round.
const ROUND_START_MS = Date.UTC(2026, 4, 10, 18, 0, 0);

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function tickToWallTime(turn: number): Date {
  return new Date(ROUND_START_MS + turn * 3_600_000);
}

/** "Sun 23:00" compact GMT label for use in UI and exports. */
export function formatTickTime(turn: number): string {
  const d = tickToWallTime(turn);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAY[d.getUTCDay()]} ${h}:${m}`;
}

/** "Sun 10 May 23:00 GMT" verbose label for tooltips. */
export function formatTickTimeFull(turn: number): string {
  const d = tickToWallTime(turn);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${h}:${m} GMT`;
}
