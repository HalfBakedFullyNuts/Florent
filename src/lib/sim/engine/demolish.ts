/**
 * Demolish item identity primitives (engine-level).
 *
 * A demolish work item's itemId is the target structure id prefixed with
 * DEMOLISH_PREFIX. Completions use this to reverse a building's effects.
 */

export const DEMOLISH_PREFIX = '__demolish__:';

/** Return the target structure id from a demolish item id, or null. */
export function demolishTarget(itemId: string): string | null {
  return itemId.startsWith(DEMOLISH_PREFIX) ? itemId.slice(DEMOLISH_PREFIX.length) : null;
}
