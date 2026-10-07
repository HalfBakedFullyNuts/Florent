/**
 * Display metadata and number formats for resources, shared by every table in the UI so a
 * resource always has the same name, abbreviation, colour and digit grouping.
 */

export type ResourceKey =
  | 'metal'
  | 'mineral'
  | 'food'
  | 'energy'
  | 'research_points'
  | 'workers'
  | 'soldiers'
  | 'scientists'
  | 'space'
  | 'space_orbital';

export interface ResourceMeta {
  label: string;
  short: string;
  text: string;
}

export const RESOURCE_META: Record<ResourceKey, ResourceMeta> = {
  metal: { label: 'Metal', short: 'M', text: 'text-res-metal' },
  mineral: { label: 'Mineral', short: 'Mn', text: 'text-res-mineral' },
  food: { label: 'Food', short: 'F', text: 'text-res-food' },
  energy: { label: 'Energy', short: 'E', text: 'text-res-energy' },
  research_points: { label: 'RP', short: 'RP', text: 'text-res-rp' },
  workers: { label: 'Workers', short: 'W', text: 'text-res-workers' },
  soldiers: { label: 'Soldiers', short: 'S', text: 'text-res-soldiers' },
  scientists: { label: 'Scientists', short: 'Sci', text: 'text-res-scientists' },
  space: { label: 'Ground space', short: 'GS', text: 'text-res-ground' },
  space_orbital: { label: 'Orbital space', short: 'OS', text: 'text-res-orbital' },
};

/** Whole number with "." thousands grouping, e.g. 30123 → "30.123". */
export function formatThousands(num: number): string {
  return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Signed per-turn value with one decimal when needed, e.g. 1200.5 → "+1.200,5". */
export function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded < 0 ? '-' : '+';
  const [intStr, decStr] = Math.abs(rounded).toFixed(1).split('.');
  const grouped = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}${decStr === '0' ? '' : `,${decStr}`}`;
}

/** Capacity shorthand, e.g. 50000 → "50k". */
export function formatWithK(num: number): string {
  return num >= 1000 ? `${Math.floor(num / 1000)}k` : num.toString();
}

/** Unsigned value with one decimal when needed, e.g. 651.768 → "651,8"; matches formatSigned's digits. */
export function formatScore(value: number): string {
  return formatSigned(value).slice(1);
}
