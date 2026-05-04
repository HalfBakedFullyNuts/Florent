/**
 * URL State Encoding v3 - Binary-packed command history
 *
 * v3 changes vs v2:
 *   - New links are encoded as `b3.<base64url bytes>` instead of compressed JSON
 *   - Planet configs, commands, and share metadata are packed as varints/UTF-8
 *   - v1/v2 compressed JSON links remain readable
 *
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
const STATE_VERSION_V3 = 3;
const BINARY_STATE_PREFIX = 'b3.';

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
  const snapshotV2: GameSnapshot = {
    v: STATE_VERSION_V2,
    planets: planets.map(compactPlanetConfigV2),
    cmds: commands,
  };
  if (share) snapshotV2.share = share;

  try {
    return encodeBinarySnapshot({
      ...snapshotV2,
      v: STATE_VERSION_V3,
    });
  } catch (error) {
    console.warn('[URL State] Binary encode failed, falling back to v2:', error);
    return LZString.compressToEncodedURIComponent(JSON.stringify(snapshotV2));
  }
}

export function decodeGameState(encoded: string): GameSnapshot | null {
  if (encoded.startsWith(BINARY_STATE_PREFIX)) {
    return decodeBinarySnapshot(encoded);
  }

  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const snapshot = JSON.parse(json) as GameSnapshot;
    if (!isSupportedSnapshotVersion(snapshot.v)) {
      console.warn(`[URL State] Unknown version: ${snapshot.v}`);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function isSupportedSnapshotVersion(version: number): boolean {
  return version === STATE_VERSION_V1 || version === STATE_VERSION_V2 || version === STATE_VERSION_V3;
}

// ---------------------------------------------------------------------------
// Binary v3 codec
// ---------------------------------------------------------------------------

const COMMAND_TAG: Record<string, number> = {
  q: 0,
  c: 1,
  r: 2,
  p: 3,
  ep: 4,
  s: 5,
  qr: 6,
  qw: 7,
  xa: 8,
  x: 9,
};

const COMMAND_BY_TAG: Record<number, V2CommandType[0]> = {
  0: 'q',
  1: 'c',
  2: 'r',
  3: 'p',
  4: 'ep',
  5: 's',
  6: 'qr',
  7: 'qw',
  8: 'xa',
  9: 'x',
};

const LANE_TO_BINARY: Record<string, number> = {
  b: 0,
  s: 1,
  n: 2,
  r: 3,
  building: 0,
  ship: 1,
  colonist: 2,
  research: 3,
};

const BINARY_TO_LANE: Record<number, string> = {
  0: 'b',
  1: 's',
  2: 'n',
  3: 'r',
};

const PLANET_HAS_START_TURN = 1 << 0;
const PLANET_HAS_ABUNDANCE = 1 << 1;
const PLANET_HAS_SPACE = 1 << 2;
const PLANET_HAS_STARTING_POP = 1 << 3;
const PLANET_HAS_STARTING_STRUCTURES = 1 << 4;

const SHARE_HAS_NAME = 1 << 0;
const SHARE_HAS_AUTHOR = 1 << 1;
const SHARE_HAS_TIME = 1 << 2;
const PLANET_FLAG_MASK = PLANET_HAS_START_TURN
  | PLANET_HAS_ABUNDANCE
  | PLANET_HAS_SPACE
  | PLANET_HAS_STARTING_POP
  | PLANET_HAS_STARTING_STRUCTURES;
const SHARE_FLAG_MASK = SHARE_HAS_NAME | SHARE_HAS_AUTHOR | SHARE_HAS_TIME;
const MAX_BINARY_PLANETS = 64;
const MAX_BINARY_COMMANDS = 20000;
const MAX_BINARY_STRING_BYTES = 2048;

function encodeBinarySnapshot(snapshot: GameSnapshot): string {
  const writer = new BinaryWriter();
  writer.writeByte(STATE_VERSION_V3);
  writer.writeVarint(snapshot.planets.length);
  snapshot.planets.forEach((planet) => writeBinaryPlanetConfig(writer, planet as V2CompactPlanetConfig));
  writer.writeVarint(snapshot.cmds.length);
  snapshot.cmds.forEach((command) => writeBinaryCommand(writer, command));
  writeBinaryShare(writer, snapshot.share);
  return `${BINARY_STATE_PREFIX}${bytesToBase64Url(writer.toUint8Array())}`;
}

function decodeBinarySnapshot(encoded: string): GameSnapshot | null {
  try {
    const reader = new BinaryReader(base64UrlToBytes(encoded.slice(BINARY_STATE_PREFIX.length)));
    const version = reader.readByte();
    if (version !== STATE_VERSION_V3) {
      console.warn(`[URL State] Unknown binary version: ${version}`);
      return null;
    }

    const planetCount = reader.readVarint();
    if (planetCount > MAX_BINARY_PLANETS) throw new Error(`Too many planets: ${planetCount}`);
    const planets = Array.from({ length: planetCount }, () => readBinaryPlanetConfig(reader));

    const commandCount = reader.readVarint();
    if (commandCount > MAX_BINARY_COMMANDS) throw new Error(`Too many commands: ${commandCount}`);
    const cmds = Array.from({ length: commandCount }, () => readBinaryCommand(reader));
    const share = readBinaryShare(reader);

    if (!reader.done()) {
      console.warn('[URL State] Binary snapshot has trailing bytes');
      return null;
    }

    const snapshot: GameSnapshot = {
      v: STATE_VERSION_V3,
      planets,
      cmds,
    };
    if (share) snapshot.share = share;
    return snapshot;
  } catch (error) {
    console.warn('[URL State] Binary decode failed:', error);
    return null;
  }
}

function writeBinaryPlanetConfig(writer: BinaryWriter, compact: V2CompactPlanetConfig): void {
  writer.writeString(compact.n);
  let flags = 0;
  if (compact.st !== undefined) flags |= PLANET_HAS_START_TURN;
  if (compact.a !== undefined) flags |= PLANET_HAS_ABUNDANCE;
  if (compact.s !== undefined) flags |= PLANET_HAS_SPACE;
  if (compact.p !== undefined) flags |= PLANET_HAS_STARTING_POP;
  if (compact.b !== undefined) flags |= PLANET_HAS_STARTING_STRUCTURES;
  writer.writeByte(flags);

  if (compact.st !== undefined) writer.writeVarint(compact.st);
  if (compact.a !== undefined) compact.a.forEach((value) => writer.writeScaledNumber(value));
  if (compact.s !== undefined) {
    writer.writeVarint(compact.s[0]);
    writer.writeVarint(compact.s[1]);
  }
  if (compact.p !== undefined) writer.writeVarint(compact.p);
  if (compact.b !== undefined) compact.b.forEach((value) => writer.writeVarint(value));
}

function readBinaryPlanetConfig(reader: BinaryReader): V2CompactPlanetConfig {
  const compact: V2CompactPlanetConfig = { n: reader.readString() };
  const flags = reader.readByte();
  if ((flags & ~PLANET_FLAG_MASK) !== 0) throw new Error(`Unknown planet flags: ${flags}`);

  if (flags & PLANET_HAS_START_TURN) compact.st = reader.readVarint();
  if (flags & PLANET_HAS_ABUNDANCE) {
    compact.a = [
      reader.readScaledNumber(),
      reader.readScaledNumber(),
      reader.readScaledNumber(),
      reader.readScaledNumber(),
      reader.readScaledNumber(),
    ];
  }
  if (flags & PLANET_HAS_SPACE) compact.s = [reader.readVarint(), reader.readVarint()];
  if (flags & PLANET_HAS_STARTING_POP) compact.p = reader.readVarint();
  if (flags & PLANET_HAS_STARTING_STRUCTURES) {
    compact.b = [reader.readVarint(), reader.readVarint(), reader.readVarint(), reader.readVarint()];
  }

  return compact;
}

function writeBinaryCommand(writer: BinaryWriter, command: CommandType): void {
  const type = command[0];
  const tag = COMMAND_TAG[type];
  if (tag === undefined) throw new Error(`Unsupported command type: ${type}`);
  writer.writeByte(tag);

  switch (type) {
    case 'q': {
      if (typeof command[3] === 'string') {
        const itemCode = V2_ITEM_CODE[command[3] as string];
        if (itemCode === undefined) throw new Error(`Unknown item id: ${command[3]}`);
        writer.writeVarint(command[1] as number);
        writer.writeVarint(itemCode);
        writer.writeVarint(command[4] as number);
      } else {
        writer.writeVarint(command[1] as number);
        writer.writeVarint(command[2] as number);
        writer.writeVarint(command[3] as number);
      }
      break;
    }
    case 'c': {
      if (typeof command[3] !== 'number') throw new Error('Legacy cancel commands cannot be binary encoded');
      writer.writeVarint(command[1] as number);
      writer.writeByte(laneToBinaryCode(command[2] as string));
      writer.writeVarint(command[3] as number);
      break;
    }
    case 'r': {
      if (typeof command[3] !== 'number') throw new Error('Legacy reorder commands cannot be binary encoded');
      writer.writeVarint(command[1] as number);
      writer.writeByte(laneToBinaryCode(command[2] as string));
      writer.writeVarint(command[3] as number);
      writer.writeVarint(command[4] as number);
      break;
    }
    case 'p': {
      writeBinaryPlanetConfig(writer, command[1] as V2CompactPlanetConfig);
      break;
    }
    case 'ep': {
      writer.writeVarint(command[1] as number);
      writeBinaryPlanetConfig(writer, command[2] as V2CompactPlanetConfig);
      break;
    }
    case 's':
    case 'x': {
      writer.writeVarint(command[1] as number);
      break;
    }
    case 'qr': {
      const itemRef = command[1];
      const itemCode = typeof itemRef === 'number' ? itemRef : V2_ITEM_CODE[itemRef as string];
      if (itemCode === undefined) throw new Error(`Unknown research item id: ${itemRef}`);
      writer.writeVarint(itemCode);
      break;
    }
    case 'qw': {
      writer.writeVarint(command[1] as number);
      break;
    }
    case 'xa':
      break;
    default:
      throw new Error(`Unsupported command type: ${type}`);
  }
}

function readBinaryCommand(reader: BinaryReader): V2CommandType {
  const tag = reader.readByte();
  const type = COMMAND_BY_TAG[tag];
  if (!type) throw new Error(`Unknown binary command tag: ${tag}`);

  switch (type) {
    case 'q':
      return ['q', reader.readVarint(), reader.readVarint(), reader.readVarint()];
    case 'c':
      return ['c', reader.readVarint(), binaryCodeToLane(reader.readByte()), reader.readVarint()];
    case 'r':
      return ['r', reader.readVarint(), binaryCodeToLane(reader.readByte()), reader.readVarint(), reader.readVarint()];
    case 'p':
      return ['p', readBinaryPlanetConfig(reader)];
    case 'ep':
      return ['ep', reader.readVarint(), readBinaryPlanetConfig(reader)];
    case 's':
      return ['s', reader.readVarint()];
    case 'qr':
      return ['qr', reader.readVarint()];
    case 'qw':
      return ['qw', reader.readVarint()];
    case 'xa':
      return ['xa'];
    case 'x':
      return ['x', reader.readVarint()];
    default:
      throw new Error(`Unsupported binary command type: ${type}`);
  }
}

function writeBinaryShare(writer: BinaryWriter, share: V2ShareMetadata | undefined): void {
  let flags = 0;
  if (share?.n) flags |= SHARE_HAS_NAME;
  if (share?.a) flags |= SHARE_HAS_AUTHOR;
  if (share?.t) flags |= SHARE_HAS_TIME;
  writer.writeByte(flags);
  if (share?.n) writer.writeString(share.n);
  if (share?.a) writer.writeString(share.a);
  if (share?.t) writer.writeString(share.t);
}

function readBinaryShare(reader: BinaryReader): V2ShareMetadata | undefined {
  const flags = reader.readByte();
  if (flags === 0) return undefined;
  if ((flags & ~SHARE_FLAG_MASK) !== 0) throw new Error(`Unknown share flags: ${flags}`);
  const share: V2ShareMetadata = {};
  if (flags & SHARE_HAS_NAME) share.n = reader.readString();
  if (flags & SHARE_HAS_AUTHOR) share.a = reader.readString();
  if (flags & SHARE_HAS_TIME) share.t = reader.readString();
  return share;
}

function laneToBinaryCode(lane: string): number {
  const code = LANE_TO_BINARY[lane];
  if (code === undefined) throw new Error(`Unknown lane: ${lane}`);
  return code;
}

function binaryCodeToLane(code: number): string {
  const lane = BINARY_TO_LANE[code];
  if (lane === undefined) throw new Error(`Unknown lane code: ${code}`);
  return lane;
}

class BinaryWriter {
  private bytes: number[] = [];
  private textEncoder = new TextEncoder();

  writeByte(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error(`Invalid byte: ${value}`);
    this.bytes.push(value);
  }

  writeVarint(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid varint: ${value}`);
    let remaining = Math.floor(value);
    do {
      const byte = remaining % 128;
      remaining = Math.floor(remaining / 128);
      this.bytes.push(remaining > 0 ? byte | 0x80 : byte);
    } while (remaining > 0);
  }

  writeScaledNumber(value: number): void {
    const scaled = Math.round(value * 100);
    if (Number.isFinite(value) && scaled >= 0 && Math.abs(value * 100 - scaled) < 1e-9) {
      this.writeByte(0);
      this.writeVarint(scaled);
      return;
    }

    this.writeByte(1);
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeString(value: string): void {
    const encoded = this.textEncoder.encode(value);
    this.writeVarint(encoded.length);
    this.writeBytes(encoded);
  }

  writeBytes(bytes: Uint8Array): void {
    bytes.forEach((byte) => this.bytes.push(byte));
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

class BinaryReader {
  private offset = 0;
  private textDecoder = new TextDecoder();

  constructor(private bytes: Uint8Array) {}

  readByte(): number {
    if (this.offset >= this.bytes.length) throw new Error('Unexpected end of binary payload');
    return this.bytes[this.offset++];
  }

  readVarint(): number {
    let value = 0;
    let multiplier = 1;

    for (let i = 0; i < 10; i++) {
      const byte = this.readByte();
      value += (byte & 0x7f) * multiplier;
      if ((byte & 0x80) === 0) return value;
      multiplier *= 128;
    }

    throw new Error('Varint is too long');
  }

  readScaledNumber(): number {
    const mode = this.readByte();
    if (mode === 0) return this.readVarint() / 100;
    if (mode !== 1) throw new Error(`Unknown number mode: ${mode}`);

    const start = this.offset;
    const end = start + 8;
    if (end > this.bytes.length) throw new Error('Unexpected end of float64');
    this.offset = end;
    return new DataView(this.bytes.buffer, this.bytes.byteOffset + start, 8).getFloat64(0, true);
  }

  readString(): string {
    const length = this.readVarint();
    if (length > MAX_BINARY_STRING_BYTES) throw new Error(`String is too long: ${length}`);
    const start = this.offset;
    const end = start + length;
    if (end > this.bytes.length) throw new Error('Unexpected end of string');
    this.offset = end;
    return this.textDecoder.decode(this.bytes.slice(start, end));
  }

  done(): boolean {
    return this.offset === this.bytes.length;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
