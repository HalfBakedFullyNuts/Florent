/**
 * URL State Encoding v2 - Compact Command History
 *
 * v2 changes vs v1:
 *   - Item IDs replaced by numeric codes (0-49, append-only table)
 *   - Work item IDs replaced by sequential integers (seqId) — fixes cancel-on-reload bug
 *   - Turn dropped from queue commands (always 1)
 *   - Planet defaults (abundance 1.0, space 60/40) omitted from URL
 *   - Lane names abbreviated to single char: b/s/n/r
 *   - 'reset' renamed to 'x'
 *
 * Backward compat: v1 URLs are still decoded correctly.
 */

import LZString from 'lz-string';
import { GameState, PlanetConfig, addPlanet, resetToHomeworld, updatePlanetConfig } from './gameState';
import { GameController } from './commands';
import { cancelGlobalResearch, queueGlobalResearch, queueGlobalResearchWait, reorderGlobalResearch } from './globalResearch';
import { LaneId } from '../sim/engine/types';
import {
  DEFAULT_ADDED_PLANET_STARTING,
  normalizePlanetStarting,
} from '../constants/planet';

const STATE_VERSION_V1 = 1;
const STATE_VERSION_V2 = 2;

// ---------------------------------------------------------------------------
// v2 item code table — APPEND ONLY, never reorder existing entries
// ---------------------------------------------------------------------------
const V2_ITEM_IDS: readonly string[] = [
  'army_barracks',           // 0
  'battleship',              // 1
  'bomber',                  // 2
  'colony',                  // 3
  'command_carrier',         // 4
  'comms_satellite',         // 5
  'core_metal_mine',         // 6
  'core_mineral_extractor',  // 7
  'cruiser',                 // 8
  'destroyer',               // 9
  'energy_booster',          // 10
  'farm',                    // 11
  'fighter',                 // 12
  'food_purifier',           // 13
  'freighter',               // 14
  'frigate',                 // 15
  'habitat',                 // 16
  'heavy_weapons_factory',   // 17
  'hospital',                // 18
  'hydroponics_dome',        // 19
  'hydroponics_lab',         // 20
  'hyperspace_beacon',       // 21
  'invasion_ship',           // 22
  'jump_gate',               // 23
  'land_reclamation',        // 24
  'launch_site',             // 25
  'leisure_centre',          // 26
  'light_weapons_factory',   // 27
  'living_quarters',         // 28
  'merchant',                // 29
  'metal_mine',              // 30
  'metal_refinery',          // 31
  'metropolis',              // 32
  'mineral_extractor',       // 33
  'mineral_processor',       // 34
  'orbital_clearing',        // 35
  'outpost',                 // 36
  'outpost_ship',            // 37
  'research_lab',            // 38
  'scientist',               // 39
  'shipyard',                // 40
  'solar_array',             // 41
  'solar_generator',         // 42
  'solar_station',           // 43
  'soldier',                 // 44
  'space_dock',              // 45
  'strip_metal_mine',        // 46
  'strip_mineral_extractor', // 47
  'trader',                  // 48
  'worker',                  // 49
  'planet_management',       // 50
  'resource_collection',     // 51
  'fleet_technology',        // 52
  'pl_6',                    // 53
  'pl_8',                    // 54
  'pl_10',                   // 55
  'pl_12',                   // 56
  'pl_14',                   // 57
  'pl_16',                   // 58
  'pl_18',                   // 59
  'pl_20',                   // 60
  'pl_22',                   // 61
  'pl_24',                   // 62
  'merchant_research',       // 63
  'trader_research',         // 64
  'war_ship_design',         // 65
  'warp_theory',             // 66
  'destroyer_research',      // 67
  'cruiser_research',        // 68
  'battleship_research',     // 69
  'hyperspace_beacon_research', // 70
  'jump_gate_research',      // 71
  'core_metal_mine_research', // 72
  'core_mineral_extractor_research', // 73
  'hydroponics_lab_research', // 74
  'solar_array_research',    // 75
  'mass_production',         // 76
  'land_enhancement',        // 77
  'metal_refinery_research', // 78
  'mineral_processor_research', // 79
  'food_purifier_research',  // 80
  'energy_booster_research', // 81
  'strip_metal_mine_research', // 82
  'strip_mineral_extractor_research', // 83
  'hydroponics_dome_research', // 84
  'solar_station_research',  // 85
];

const V2_ITEM_CODE: Record<string, number> = Object.fromEntries(
  V2_ITEM_IDS.map((id, i) => [id, i])
);

const V2_LANE_ENC: Record<string, string> = {
  building: 'b', ship: 's', colonist: 'n', research: 'r',
};
const V2_LANE_DEC: Record<string, LaneId> = {
  b: 'building', s: 'ship', n: 'colonist', r: 'research',
};

// Default planet values — omitted from v2 URL to save space
const DEFAULT_ABUNDANCE = [1, 1, 1, 1, 1];
const DEFAULT_SPACE: [number, number] = [60, 40];
const DEFAULT_STARTING_POP = DEFAULT_ADDED_PLANET_STARTING.workersTotal;
const DEFAULT_STARTING_STRUCTURES: [number, number, number, number] = [
  DEFAULT_ADDED_PLANET_STARTING.structures.metal_mine,
  DEFAULT_ADDED_PLANET_STARTING.structures.mineral_extractor,
  DEFAULT_ADDED_PLANET_STARTING.structures.farm,
  DEFAULT_ADDED_PLANET_STARTING.structures.solar_generator,
];

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

// v1 format (kept for backward-compat decode only)
type V1CommandType =
  | ['q', number, number, string, number]
  | ['c', number, LaneId, string]
  | ['r', number, LaneId, string, number]
  | ['a', number, number]
  | ['p', V1CompactPlanetConfig]
  | ['s', number]
  | ['qr', string]
  | ['qw', number]
  | ['reset', number];

// v2 format
type V2CommandType =
  | ['q', number, number, number]           // queue: planetIdx, itemCode, qty
  | ['c', number, string, number]           // cancel: planetIdx, laneCode, seqId
  | ['r', number, string, number, number]   // reorder: planetIdx, laneCode, seqId, newIdx
  | ['p', V2CompactPlanetConfig]            // add planet
  | ['ep', number, V2CompactPlanetConfig]   // edit planet: planetIdx, config
  | ['s', number]                           // switch planet
  | ['qr', number]                          // queue research: itemCode
  | ['qw', number]                          // queue research wait: turns
  | ['xa']                                  // reset all additional planets and home queue
  | ['x', number];                          // reset: planetIdx

// Union used at runtime
type CommandType = V1CommandType | V2CommandType;

interface V1CompactPlanetConfig {
  n: string; t: number; a: number[]; s: [number, number];
}
interface V2CompactPlanetConfig {
  n: string; st?: number; a?: number[]; s?: [number, number]; p?: number; b?: [number, number, number, number];
}

interface GameSnapshot {
  v: number;
  planets: (V1CompactPlanetConfig | V2CompactPlanetConfig)[];
  cmds: CommandType[];
  share?: V2ShareMetadata;
}

const STATE_HASH_PREFIX = 'state=';

interface V2ShareMetadata {
  n?: string;
  a?: string;
  t?: string;
}

export interface ShareMetadata {
  name: string;
  author: string;
  sharedAt: string;
}

// ---------------------------------------------------------------------------
// Planet config helpers
// ---------------------------------------------------------------------------

function compactPlanetConfigV2(config: PlanetConfig): V2CompactPlanetConfig {
  const compact: V2CompactPlanetConfig = { n: config.name };
  if (config.startTurn !== 1) compact.st = config.startTurn;
  const a = [
    config.abundance.metal, config.abundance.mineral,
    config.abundance.food, config.abundance.energy,
    config.abundance.research_points,
  ];
  if (a.some((v, i) => v !== DEFAULT_ABUNDANCE[i])) compact.a = a;
  const s: [number, number] = [config.space.groundCap, config.space.orbitalCap];
  if (s[0] !== DEFAULT_SPACE[0] || s[1] !== DEFAULT_SPACE[1]) compact.s = s;
  const starting = normalizePlanetStarting(config.starting);
  if (starting.workersTotal !== DEFAULT_STARTING_POP) compact.p = starting.workersTotal;
  const b: [number, number, number, number] = [
    starting.structures.metal_mine,
    starting.structures.mineral_extractor,
    starting.structures.farm,
    starting.structures.solar_generator,
  ];
  if (b.some((v, i) => v !== DEFAULT_STARTING_STRUCTURES[i])) compact.b = b;
  return compact;
}

function expandPlanetConfigV2(compact: V2CompactPlanetConfig): PlanetConfig {
  const a = compact.a ?? DEFAULT_ABUNDANCE;
  const s = compact.s ?? DEFAULT_SPACE;
  const b = compact.b ?? DEFAULT_STARTING_STRUCTURES;
  return {
    name: compact.n,
    startTurn: compact.st ?? 1,
    abundance: {
      metal: a[0], mineral: a[1], food: a[2],
      energy: a[3], research_points: a[4],
    },
    space: { groundCap: s[0], orbitalCap: s[1] },
    starting: {
      workersTotal: compact.p ?? DEFAULT_STARTING_POP,
      structures: {
        metal_mine: b[0],
        mineral_extractor: b[1],
        farm: b[2],
        solar_generator: b[3],
      },
    },
  };
}

function expandPlanetConfigV1(compact: V1CompactPlanetConfig): PlanetConfig {
  return {
    name: compact.n,
    startTurn: compact.t,
    abundance: {
      metal: compact.a[0], mineral: compact.a[1], food: compact.a[2],
      energy: compact.a[3], research_points: compact.a[4],
    },
    space: { groundCap: compact.s[0], orbitalCap: compact.s[1] },
    starting: normalizePlanetStarting(),
  };
}

// ---------------------------------------------------------------------------
// CommandHistory — records player actions for URL encoding
// ---------------------------------------------------------------------------

export class CommandHistory {
  private commands: V2CommandType[] = [];
  // seqId counter — increments with every queue command
  private nextSeqId = 1;
  // maps live entryId (from queueItem result) → seqId stored in URL
  private entryIdToSeqId = new Map<string, number>();

  /**
   * Record a queue command. Pass the entryId returned by queueItem so cancel/reorder
   * commands can reference it via the compact seqId.
   */
  recordQueue(planetIdx: number, itemId: string, qty: number, entryId: string) {
    const itemCode = V2_ITEM_CODE[itemId];
    if (itemCode === undefined) {
      console.warn(`[CommandHistory] Unknown item: ${itemId}`);
      return;
    }
    const seqId = this.nextSeqId++;
    this.entryIdToSeqId.set(entryId, seqId);
    this.commands.push(['q', planetIdx, itemCode, qty]);
  }

  /** Record a cancel command, referenced by the item's seqId. */
  recordCancel(planetIdx: number, laneId: LaneId, entryId: string) {
    const seqId = this.entryIdToSeqId.get(entryId);
    if (seqId === undefined) {
      console.warn(`[CommandHistory] Cancel: unknown entryId ${entryId}`);
      return;
    }
    const laneCode = V2_LANE_ENC[laneId] ?? laneId;
    this.commands.push(['c', planetIdx, laneCode, seqId]);
  }

  /** Record a reorder command, referenced by the item's seqId. */
  recordReorder(planetIdx: number, laneId: LaneId, entryId: string, newIndex: number) {
    const seqId = this.entryIdToSeqId.get(entryId);
    if (seqId === undefined) {
      console.warn(`[CommandHistory] Reorder: unknown entryId ${entryId}`);
      return;
    }
    const laneCode = V2_LANE_ENC[laneId] ?? laneId;
    this.commands.push(['r', planetIdx, laneCode, seqId, newIndex]);
  }

  recordAddPlanet(config: PlanetConfig) {
    this.commands.push(['p', compactPlanetConfigV2(config)]);
  }

  recordEditPlanet(planetIdx: number, config: PlanetConfig) {
    this.commands.push(['ep', planetIdx, compactPlanetConfigV2(config)]);
  }

  recordSwitchPlanet(planetIdx: number) {
    this.commands.push(['s', planetIdx]);
  }

  recordQueueResearch(itemId: string, entryId: string) {
    const itemCode = V2_ITEM_CODE[itemId];
    if (itemCode === undefined) {
      console.warn(`[CommandHistory] Unknown research item: ${itemId}`);
      return;
    }
    const seqId = this.nextSeqId++;
    this.entryIdToSeqId.set(entryId, seqId);
    this.commands.push(['qr', itemCode]);
  }

  recordQueueResearchWait(turns: number, entryId: string) {
    const seqId = this.nextSeqId++;
    this.entryIdToSeqId.set(entryId, seqId);
    this.commands.push(['qw', turns]);
  }

  recordReset(planetIdx: number) {
    this.commands.push(['x', planetIdx]);
  }

  recordResetAllPlanets() {
    this.commands.push(['xa']);
  }

  getCommands(): V2CommandType[] {
    return [...this.commands];
  }

  /**
   * Load commands from a decoded snapshot (e.g. after loading from URL).
   * Rebuilds the seqId map so future cancels from this session work correctly.
   *
   * Handles both v1 and v2 'q' command shapes:
   *   v1: ['q', planetIdx, turn, itemId(string), qty]   (5 elements)
   *   v2: ['q', planetIdx, itemCode(number), qty]       (4 elements)
   * The cmd[3] type discriminates: string => v1, number => v2.
   */
  loadFromSnapshot(cmds: CommandType[]) {
    this.commands = [];
    this.nextSeqId = 1;
    this.entryIdToSeqId.clear();

    for (const cmd of cmds) {
      if (cmd[0] === 'q') {
        const seqId = this.nextSeqId++;
        // Items replayed from URL get deterministic IDs __s1, __s2, …
        this.entryIdToSeqId.set(`__s${seqId}`, seqId);
        let planetIdx: number;
        let itemCode: number;
        let qty: number;
        if (typeof cmd[3] === 'string') {
          // v1: cmd[3] is the string itemId, cmd[4] is qty.
          planetIdx = cmd[1] as number;
          itemCode = V2_ITEM_CODE[cmd[3] as string] ?? -1;
          qty = (cmd[4] as number) ?? 1;
        } else {
          // v2: cmd[2] is the numeric itemCode, cmd[3] is qty.
          planetIdx = cmd[1] as number;
          itemCode = cmd[2] as number;
          qty = (cmd[3] as number) ?? 1;
        }
        this.commands.push(['q', planetIdx, itemCode, qty]);
      } else if (cmd[0] === 'qr' || cmd[0] === 'qw') {
        const seqId = this.nextSeqId++;
        this.entryIdToSeqId.set(`__s${seqId}`, seqId);
        this.commands.push(cmd as V2CommandType);
      } else {
        // Keep all other commands as-is (they are version-normalised during replay)
        this.commands.push(cmd as V2CommandType);
      }
    }
  }

  clear() {
    this.commands = [];
    this.nextSeqId = 1;
    this.entryIdToSeqId.clear();
  }
}

// ---------------------------------------------------------------------------
// Encode / Decode
// ---------------------------------------------------------------------------

export function encodeGameState(
  planets: PlanetConfig[],
  commands: V2CommandType[],
  shareMetadata?: Partial<ShareMetadata> | null
): string {
  const share = compactShareMetadata(shareMetadata);
  const snapshot: GameSnapshot = {
    v: STATE_VERSION_V2,
    planets: planets.map(compactPlanetConfigV2),
    cmds: commands,
  };
  if (share) snapshot.share = share;
  return LZString.compressToEncodedURIComponent(JSON.stringify(snapshot));
}

export function decodeGameState(encoded: string): GameSnapshot | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const snapshot = JSON.parse(json) as GameSnapshot;
    if (snapshot.v !== STATE_VERSION_V1 && snapshot.v !== STATE_VERSION_V2) {
      console.warn(`[URL State] Unknown version: ${snapshot.v}`);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function normaliseShareMetadata(
  metadata?: Partial<ShareMetadata> | null
): ShareMetadata | null {
  if (!metadata) return null;

  const name = cleanShareField(metadata.name, 80);
  const author = cleanShareField(metadata.author, 60);
  const sharedAt = cleanShareField(metadata.sharedAt, 40) || new Date().toISOString();

  if (!name && !author) return null;
  return {
    name: name || 'Shared build list',
    author: author || 'Unknown commander',
    sharedAt,
  };
}

function compactShareMetadata(
  metadata?: Partial<ShareMetadata> | null
): V2ShareMetadata | undefined {
  const normalized = normaliseShareMetadata(metadata);
  if (!normalized) return undefined;
  return {
    n: normalized.name,
    a: normalized.author,
    t: normalized.sharedAt,
  };
}

function cleanShareField(value: string | undefined, maxLength: number): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function getShareMetadataFromSnapshot(snapshot: GameSnapshot): ShareMetadata | null {
  const share = snapshot.share;
  if (!share) return null;
  return normaliseShareMetadata({
    name: share.n,
    author: share.a,
    sharedAt: share.t,
  });
}

// ---------------------------------------------------------------------------
// URL / LocalStorage persistence
// ---------------------------------------------------------------------------

export function saveStateToURL(
  planets: PlanetConfig[],
  commands: V2CommandType[]
): void {
  if (typeof window === 'undefined') return;
  const encoded = encodeGameState(planets, commands);
  saveEncodedStateToURL(encoded);
}

export function buildShareURL(encoded: string): string {
  if (typeof window === 'undefined') return `#${STATE_HASH_PREFIX}${encoded}`;
  const url = new URL(window.location.href);
  url.hash = `${STATE_HASH_PREFIX}${encoded}`;
  return url.toString();
}

export function saveEncodedStateToURL(encoded: string): void {
  if (typeof window === 'undefined') return;
  const url = buildShareURL(encoded);
  try {
    window.history.replaceState(window.history.state, '', url);
  } catch {
    window.location.hash = `${STATE_HASH_PREFIX}${encoded}`;
  }
  try {
    window.localStorage.setItem('florent_save', encoded);
  } catch { /* ignore */ }
}

export function getEncodedStateFromURL(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith(`#${STATE_HASH_PREFIX}`)) return null;
  return hash.substring(STATE_HASH_PREFIX.length + 1);
}

export function loadStateFromURL(): GameSnapshot | null {
  if (typeof window === 'undefined') return null;
  const encoded = getEncodedStateFromURL();
  return encoded ? decodeGameState(encoded) : null;
}

export function loadStateFromLocalStorage(): GameSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const encoded = window.localStorage.getItem('florent_save');
    if (!encoded) return null;
    return decodeGameState(encoded);
  } catch {
    return null;
  }
}

export function clearStateFromURL(): void {
  if (typeof window === 'undefined') return;
  window.location.hash = '';
  try { window.localStorage.removeItem('florent_save'); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Command replay
// ---------------------------------------------------------------------------

/**
 * Replay recorded commands to reconstruct game state.
 * Handles both v1 and v2 snapshots.
 * Returns the seqId→entryId map so the caller can rebuild CommandHistory.
 */
export function replayCommands(
  initialGameState: GameState,
  commands: CommandType[]
): GameState {
  let gameState = initialGameState;
  // seqId counter: increments for every 'q' command in order
  let seqCounter = 0;
  // maps seqId → deterministic entry ID used on replay
  const seqToEntryId = new Map<number, string>();

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const type = cmd[0];

    try {
      switch (type) {
        case 'q': {
          seqCounter++;
          const deterministicId = `__s${seqCounter}`;
          seqToEntryId.set(seqCounter, deterministicId);

          let planetIdx: number, itemId: string, qty: number;
          if (typeof cmd[3] === 'string') {
            // v1: ['q', planetIdx, turn, itemId, qty]
            [, planetIdx, , itemId, qty] = cmd as ['q', number, number, string, number];
          } else {
            // v2: ['q', planetIdx, itemCode, qty]
            const itemCode = cmd[2] as number;
            itemId = V2_ITEM_IDS[itemCode] ?? '';
            planetIdx = cmd[1] as number;
            qty = cmd[3] as number;
          }
          if (!itemId) break;

          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          const planet = gameState.planets.get(planetId);
          if (planet?.timeline) {
            const controller = new GameController(planet, planet.timeline);
            controller.queueItem(planet.startTurn, itemId, qty, { preserveId: deterministicId });
          }
          break;
        }

        case 'c': {
          let planetIdx: number, laneId: LaneId, entryId: string;
          if (typeof cmd[3] === 'string') {
            // v1: ['c', planetIdx, laneId, entryId]
            [, planetIdx, laneId, entryId] = cmd as ['c', number, LaneId, string];
          } else {
            // v2: ['c', planetIdx, laneCode, seqId]
            const seqId = cmd[3] as number;
            laneId = V2_LANE_DEC[cmd[2] as string] ?? (cmd[2] as LaneId);
            entryId = seqToEntryId.get(seqId) ?? '';
            planetIdx = cmd[1] as number;
          }
          if (!entryId) break;

          if (laneId === 'research') {
            gameState = cancelGlobalResearch(gameState, entryId);
            break;
          }

          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          const planet = gameState.planets.get(planetId);
          if (planet?.timeline) {
            const controller = new GameController(planet, planet.timeline);
            controller.cancelPlannedItem(laneId, entryId);
          }
          break;
        }

        case 'r': {
          // reorder — v2: ['r', planetIdx, laneCode, seqId, newIdx]
          const planetIdx = cmd[1] as number;
          const laneCode = cmd[2] as string;
          const laneId: LaneId = V2_LANE_DEC[laneCode] ?? (laneCode as LaneId);
          const seqId = cmd[3] as number;
          const newIdx = cmd[4] as number;
          const entryId = seqToEntryId.get(seqId) ?? '';
          if (!entryId) break;

          if (laneId === 'research') {
            gameState = reorderGlobalResearch(gameState, entryId, newIdx);
            break;
          }

          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          const planet = gameState.planets.get(planetId);
          if (planet?.timeline) {
            const controller = new GameController(planet, planet.timeline);
            controller.reorderQueueItem(planet.startTurn, laneId, entryId, newIdx);
          }
          break;
        }

        case 'p': {
          const rawConfig = cmd[1] as V1CompactPlanetConfig | V2CompactPlanetConfig;
          const config = 't' in rawConfig
            ? expandPlanetConfigV1(rawConfig as V1CompactPlanetConfig)
            : expandPlanetConfigV2(rawConfig as V2CompactPlanetConfig);
          gameState = addPlanet(gameState, config);
          break;
        }

        case 'ep': {
          const planetIdx = cmd[1] as number;
          const rawConfig = cmd[2] as V2CompactPlanetConfig;
          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          if (planetId) {
            gameState = updatePlanetConfig(gameState, planetId, expandPlanetConfigV2(rawConfig));
          }
          break;
        }

        case 's': {
          const planetIdx = cmd[1] as number;
          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          if (planetId) gameState = { ...gameState, currentPlanetId: planetId };
          break;
        }

        case 'qr': {
          seqCounter++;
          const deterministicId = `__s${seqCounter}`;
          seqToEntryId.set(seqCounter, deterministicId);
          const itemRef = cmd[1];
          const itemId = typeof itemRef === 'number'
            ? V2_ITEM_IDS[itemRef] ?? ''
            : itemRef as string;
          if (itemId) gameState = queueGlobalResearch(gameState, itemId, deterministicId);
          break;
        }

        case 'qw': {
          seqCounter++;
          const deterministicId = `__s${seqCounter}`;
          seqToEntryId.set(seqCounter, deterministicId);
          const turns = cmd[1] as number;
          gameState = queueGlobalResearchWait(gameState, turns, deterministicId);
          break;
        }

        case 'x':
        case 'reset': {
          const planetIdx = cmd[1] as number;
          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          const planet = gameState.planets.get(planetId);
          if (planet?.timeline) {
            const controller = new GameController(planet, planet.timeline);
            controller.resetQueue();
          }
          break;
        }

        case 'xa': {
          gameState = resetToHomeworld(gameState);
          break;
        }

        default:
          console.warn(`[URL State] Unknown command type: ${type}`);
      }
    } catch (err) {
      console.error(`[URL State] Command ${i} (${type}) failed:`, err);
    }
  }

  return gameState;
}

// ---------------------------------------------------------------------------
// Helpers used by the app
// ---------------------------------------------------------------------------

export function extractPlanetConfigs(gameState: GameState): PlanetConfig[] {
  return Array.from(gameState.planets.values()).map(planet => {
    const initialState = planet.timeline?.getStateAtTurn(planet.startTurn) ?? planet;
    return {
      name: planet.name,
      startTurn: planet.startTurn,
      abundance: {
        metal: initialState.abundance?.metal ?? 1,
        mineral: initialState.abundance?.mineral ?? 1,
        food: initialState.abundance?.food ?? 1,
        energy: initialState.abundance?.energy ?? 1,
        research_points: initialState.abundance?.research_points ?? 1,
      },
      space: {
        groundCap: initialState.space?.groundCap ?? 60,
        orbitalCap: initialState.space?.orbitalCap ?? 40,
      },
      starting: {
        workersTotal: initialState.population?.workersTotal ?? DEFAULT_STARTING_POP,
        structures: {
          metal_mine: initialState.completedCounts?.metal_mine ?? 0,
          mineral_extractor: initialState.completedCounts?.mineral_extractor ?? 0,
          farm: initialState.completedCounts?.farm ?? 0,
          solar_generator: initialState.completedCounts?.solar_generator ?? 0,
        },
      },
    };
  });
}

export function getPlanetIndex(gameState: GameState, planetId: string): number {
  return Array.from(gameState.planets.keys()).indexOf(planetId);
}

export function estimateEncodedSize(
  planets: PlanetConfig[],
  commands: V2CommandType[]
): { json: number; encoded: number; chars: number } {
  const encoded = encodeGameState(planets, commands);
  const snapshot = { v: STATE_VERSION_V2, planets: planets.map(compactPlanetConfigV2), cmds: commands };
  return {
    json: JSON.stringify(snapshot).length,
    encoded: encoded.length,
    chars: encoded.length,
  };
}
