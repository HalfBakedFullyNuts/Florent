/**
 * Test helper: fail loudly when a lookup unexpectedly returns nothing, and narrow
 * the type for the rest of the test (replaces unchecked `!` assertions).
 */
export function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}
