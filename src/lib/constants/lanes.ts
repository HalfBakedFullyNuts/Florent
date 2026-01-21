/**
 * Lane configuration constants used across UI components.
 * Centralizes lane metadata to avoid duplication in multiple components.
 */

import type { LaneId } from '../sim/engine/types';

export interface LaneConfig {
  title: string;
  icon: string;
}

/**
 * Configuration for each lane type including display title and icon.
 */
export const LANE_CONFIG: Record<LaneId, LaneConfig> = {
  building: { title: 'Structures', icon: '🏗️' },
  ship: { title: 'Ships', icon: '🚀' },
  colonist: { title: 'Colonists', icon: '👥' },
  research: { title: 'Research', icon: '🔬' },
};

/**
 * Ordered list of production lanes (excludes research for some UI contexts).
 */
export const PRODUCTION_LANES: LaneId[] = ['building', 'ship', 'colonist'];

/**
 * All lanes including research.
 */
export const ALL_LANES: LaneId[] = ['building', 'ship', 'colonist', 'research'];
