/**
 * Player-facing notice for plan steps the current game rules rejected on load
 * (e.g. an old plan queuing a Research Lab the homeworld now starts with).
 */
import type { ReplayDrop } from './urlState';

const MAX_LISTED_STEPS = 5;

interface DropGroup {
  item: string;
  planet: string;
  quantity: number;
}

/**
 * Merge drops of the same item on the same planet, keeping first-seen order,
 * and label each group with readable item/planet names (ids/indexes as fallback).
 */
function groupDrops(
  drops: ReplayDrop[],
  planetNames: string[],
  itemNames: Record<string, string>
): DropGroup[] {
  const groups = new Map<string, DropGroup>();
  for (const drop of drops) {
    const key = `${drop.planetIndex}:${drop.itemId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += drop.quantity;
      continue;
    }
    const item = itemNames[drop.itemId] ?? drop.itemId;
    const planet = planetNames[drop.planetIndex] ?? `Planet ${drop.planetIndex + 1}`;
    groups.set(key, { item, planet, quantity: drop.quantity });
  }
  return Array.from(groups.values());
}

/**
 * Build the notice text, or null when nothing was dropped.
 * Lists at most MAX_LISTED_STEPS groups; the step count covers every drop.
 */
export function formatReplayDropNotice(
  drops: ReplayDrop[],
  planetNames: string[],
  itemNames: Record<string, string>
): string | null {
  if (!Array.isArray(drops) || drops.length === 0) return null;
  if (!Array.isArray(planetNames)) throw new Error('planetNames must be an array');

  const groups = groupDrops(drops, planetNames, itemNames);
  const formatGroup = (group: DropGroup) => `${group.item} ×${group.quantity} (${group.planet})`;
  const listed = groups.slice(0, MAX_LISTED_STEPS).map(formatGroup).join(', ');
  const hidden = groups.length - MAX_LISTED_STEPS;
  const tail = hidden > 0 ? `, and ${hidden} more.` : '.';
  const steps = drops.length === 1 ? '1 step' : `${drops.length} steps`;
  const verb = drops.length === 1 ? 'was' : 'were';

  return `${steps} of this plan couldn't be applied under the current game rules and ${verb} skipped: ${listed}${tail}`;
}
