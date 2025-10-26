/**
 * Helper utilities for state cloning and manipulation
 */

import type { PlanetState } from './types';

/**
 * Deep clone planet state for immutable operations
 * Note: This uses JSON serialization for simplicity.
 * For production, consider using a library like structuredClone or immer.
 */
export function cloneState(state: PlanetState): PlanetState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Generate unique ID for work items
 */
export function generateWorkItemId(): string {
  return `wi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
