/**
 * Small shared label helpers for save/list UIs.
 */

export function formatOpenedTimestamp(timestamp: number): string {
  const opened = new Date(timestamp);
  const date = opened.toLocaleDateString();
  const time = opened.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} - ${time}`;
}
