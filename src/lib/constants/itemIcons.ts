type ImageDir = 'buildings' | 'ships' | 'colonists' | 'units';

interface ItemIconConfig {
  slug: string;
  dir: ImageDir;
}

const ITEM_ICON_MAP: Record<string, ItemIconConfig> = {
  // ── Structures (buildings) ──────────────────────────────────────────
  outpost:                    { slug: 'outpost',                  dir: 'buildings' },
  farm:                       { slug: 'farm',                     dir: 'buildings' },
  launch_site:                { slug: 'launch-site',              dir: 'buildings' },
  leisure_centre:             { slug: 'leisure-centre',           dir: 'buildings' },
  living_quarters:            { slug: 'living-quarters',          dir: 'buildings' },
  metal_mine:                 { slug: 'metal-mine',               dir: 'buildings' },
  mineral_extractor:          { slug: 'mineral-extractor',        dir: 'buildings' },
  solar_generator:            { slug: 'solar-generator',          dir: 'buildings' },
  research_lab:               { slug: 'research-lab',             dir: 'buildings' },
  comms_satellite:            { slug: 'comms-satellite',          dir: 'buildings' },
  habitat:                    { slug: 'habitat',                  dir: 'buildings' },
  shipyard:                   { slug: 'ship-yard',                dir: 'buildings' },
  colony:                     { slug: 'colony',                   dir: 'buildings' },
  core_metal_mine:            { slug: 'core-metal-mine',          dir: 'buildings' },
  core_mineral_extractor:     { slug: 'core-mineral-extractor',   dir: 'buildings' },
  hydroponics_lab:            { slug: 'hydroponics-lab',          dir: 'buildings' },
  light_weapons_factory:      { slug: 'light-weapons-factory',    dir: 'buildings' },
  solar_array:                { slug: 'solar-array',              dir: 'buildings' },
  army_barracks:              { slug: 'army-barracks',            dir: 'buildings' },
  hyperspace_beacon:          { slug: 'hyperspace-beacon',        dir: 'buildings' },
  hospital:                   { slug: 'hospital',                 dir: 'buildings' },
  metal_refinery:             { slug: 'metal-refinery',           dir: 'buildings' },
  mineral_processor:          { slug: 'mineral-processor',        dir: 'buildings' },
  food_purifier:              { slug: 'food-purifier',            dir: 'buildings' },
  energy_booster:             { slug: 'energy-booster',           dir: 'buildings' },
  metropolis:                 { slug: 'metropolis',               dir: 'buildings' },
  space_dock:                 { slug: 'space-docks',              dir: 'buildings' },
  heavy_weapons_factory:      { slug: 'heavy-weapons-factory',    dir: 'buildings' },
  land_reclamation:           { slug: 'land-reclamation',         dir: 'buildings' },
  orbital_clearing:           { slug: 'orbital-clearing',         dir: 'buildings' },
  jump_gate:                  { slug: 'jump-gate',                dir: 'buildings' },
  strip_metal_mine:           { slug: 'strip-metal-mine',         dir: 'buildings' },
  strip_mineral_extractor:    { slug: 'strip-mineral-extractor',  dir: 'buildings' },
  hydroponics_dome:           { slug: 'hydroponics-dome',         dir: 'buildings' },
  solar_station:              { slug: 'solar-station',            dir: 'buildings' },

  // ── Ships ───────────────────────────────────────────────────────────
  fighter:                    { slug: 'fighter',                  dir: 'ships' },
  bomber:                     { slug: 'bomber',                   dir: 'ships' },
  frigate:                    { slug: 'frigate',                  dir: 'ships' },
  destroyer:                  { slug: 'destroyer',                dir: 'ships' },
  cruiser:                    { slug: 'cruiser',                  dir: 'ships' },
  battleship:                 { slug: 'battleship',               dir: 'ships' },
  freighter:                  { slug: 'freighter',                dir: 'ships' },
  merchant:                   { slug: 'merchant',                 dir: 'ships' },
  trader:                     { slug: 'trader',                   dir: 'ships' },
  command_carrier:            { slug: 'carrier',                  dir: 'ships' },
  invasion_ship:              { slug: 'invasion-ship',            dir: 'ships' },
  outpost_ship:               { slug: 'outpost-ship',             dir: 'units' },

  // ── Colonists ───────────────────────────────────────────────────────
  soldier:                    { slug: 'soldier',                  dir: 'colonists' },
  scientist:                  { slug: 'scientist',                dir: 'colonists' },
  worker:                     { slug: 'worker',                   dir: 'colonists' },
};

const CF_BASE = 'https://beta.infiniteconflict.com/cdn-cgi/image';

/**
 * Returns a Cloudflare image-resizing URL for the given item, or null if no
 * icon slug exists for that item. Never throws.
 */
export function getItemImageUrl(
  itemId: string,
  width: number,
  height: number,
): string | null {
  const config = ITEM_ICON_MAP[itemId];
  if (!config) return null;
  const path = `images/${config.dir}/${config.slug}.jpg`;
  return `${CF_BASE}/width=${width},height=${height},contrast=1,brightness=1,gamma=1,format=webp,quality=90,fit=cover/${path}`;
}
