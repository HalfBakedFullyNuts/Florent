/**
 * Engine-level catalog for static item definitions.
 *
 * Definitions are static game data (loaded once from game_data.json, plus a
 * few deterministic synthetic defs like demolish placeholders). They live here
 * instead of inside every PlanetState snapshot so that timeline cloning stays
 * cheap and memory footprint stays small.
 */

import type { ItemDefinition } from './types';

const NO_CATALOG: Record<string, ItemDefinition> = {};
let catalog: Record<string, ItemDefinition> = NO_CATALOG;

export function setDefsCatalog(defs: Record<string, ItemDefinition>): void {
  if (!defs) {
    throw new Error('setDefsCatalog: defs record is required');
  }
  catalog = defs;
}

export function getDefs(): Record<string, ItemDefinition> {
  return catalog;
}

export function registerDef(def: ItemDefinition): void {
  if (!def || !def.id) {
    throw new Error('registerDef: def with id is required');
  }
  if (catalog === NO_CATALOG) {
    catalog = {};
  }
  catalog[def.id] = def;
}
