/**
 * URL State Encoding - Command History Approach
 *
 * Encodes game state as a compressed command history in the URL.
 * Leverages the deterministic nature of the simulation engine:
 * Same commands + same initial state = same final state
 */

import LZString from 'lz-string';
import { GameState, PlanetConfig } from './gameState';
import { LaneId } from '../sim/engine/types';

// Version for backward compatibility
const STATE_VERSION = 1;

/**
 * Command types that can be encoded
 */
type CommandType =
  | ['q', number, number, string, number]      // Queue: [type, planetIdx, turn, itemId, qty]
  | ['c', number, LaneId, string]              // Cancel: [type, planetIdx, lane, entryId]
  | ['r', number, LaneId, string, number]      // Reorder: [type, planetIdx, lane, entryId, newIdx]
  | ['a', number, number]                      // Advance: [type, planetIdx, turns]
  | ['p', PlanetConfig]                        // Add Planet: [type, config]
  | ['s', number]                              // Switch Planet: [type, planetIdx]
  | ['qr', string];                            // Queue Research: [type, itemId]

/**
 * Compact game snapshot for URL encoding
 */
interface GameSnapshot {
  v: number;                    // Version
  planets: CompactPlanetConfig[];
  cmds: CommandType[];
}

/**
 * Compact planet configuration (keys shortened for size)
 */
interface CompactPlanetConfig {
  n: string;                    // name
  t: number;                    // startTurn
  a: number[];                  // abundance [metal, mineral, food, energy, rp]
  s: [number, number];          // space [ground, orbital]
}

/**
 * Convert planet config to compact form
 */
function compactPlanetConfig(config: PlanetConfig): CompactPlanetConfig {
  return {
    n: config.name,
    t: config.startTurn,
    a: [
      config.abundance.metal,
      config.abundance.mineral,
      config.abundance.food,
      config.abundance.energy,
      config.abundance.research_points,
    ],
    s: [config.space.groundCap, config.space.orbitalCap],
  };
}

/**
 * Convert compact config back to full planet config
 */
function expandPlanetConfig(compact: CompactPlanetConfig): PlanetConfig {
  return {
    name: compact.n,
    startTurn: compact.t,
    abundance: {
      metal: compact.a[0],
      mineral: compact.a[1],
      food: compact.a[2],
      energy: compact.a[3],
      research_points: compact.a[4],
    },
    space: {
      groundCap: compact.s[0],
      orbitalCap: compact.s[1],
    },
  };
}

/**
 * Command history recorder
 * Tracks all commands executed during a session
 */
export class CommandHistory {
  private commands: CommandType[] = [];
  private planetConfigs: PlanetConfig[] = [];

  /**
   * Record a queue command
   */
  recordQueue(planetIdx: number, turn: number, itemId: string, quantity: number) {
    this.commands.push(['q', planetIdx, turn, itemId, quantity]);
  }

  /**
   * Record a cancel command
   */
  recordCancel(planetIdx: number, laneId: LaneId, entryId: string) {
    this.commands.push(['c', planetIdx, laneId, entryId]);
  }

  /**
   * Record a reorder command
   */
  recordReorder(planetIdx: number, laneId: LaneId, entryId: string, newIndex: number) {
    this.commands.push(['r', planetIdx, laneId, entryId, newIndex]);
  }

  /**
   * Record turn advancement
   */
  recordAdvance(planetIdx: number, turns: number) {
    this.commands.push(['a', planetIdx, turns]);
  }

  /**
   * Record add planet
   */
  recordAddPlanet(config: PlanetConfig) {
    this.commands.push(['p', config]);
    this.planetConfigs.push(config);
  }

  /**
   * Record planet switch
   */
  recordSwitchPlanet(planetIdx: number) {
    this.commands.push(['s', planetIdx]);
  }

  /**
   * Record research queue
   */
  recordQueueResearch(itemId: string) {
    this.commands.push(['qr', itemId]);
  }

  /**
   * Get all commands
   */
  getCommands(): CommandType[] {
    return [...this.commands];
  }

  /**
   * Get planet configs
   */
  getPlanetConfigs(): PlanetConfig[] {
    return [...this.planetConfigs];
  }

  /**
   * Clear history
   */
  clear() {
    this.commands = [];
    this.planetConfigs = [];
  }
}

/**
 * Encode game snapshot to URL-safe string
 * Uses JSON + LZ-String compression for optimal size
 */
export function encodeGameState(
  planets: PlanetConfig[],
  commands: CommandType[]
): string {
  const snapshot: GameSnapshot = {
    v: STATE_VERSION,
    planets: planets.map(compactPlanetConfig),
    cmds: commands,
  };

  const json = JSON.stringify(snapshot);

  // Use LZ-String compression (50-70% size reduction)
  const encoded = LZString.compressToEncodedURIComponent(json);

  return encoded;
}

/**
 * Decode URL string back to game snapshot
 */
export function decodeGameState(encoded: string): GameSnapshot | null {
  try {
    // Decompress using LZ-String
    const json = LZString.decompressFromEncodedURIComponent(encoded);

    if (!json) {
      console.error('Failed to decompress game state');
      return null;
    }

    const snapshot = JSON.parse(json) as GameSnapshot;

    // Version check
    if (snapshot.v !== STATE_VERSION) {
      console.warn(`State version mismatch: ${snapshot.v} !== ${STATE_VERSION}`);
      return null;
    }

    return snapshot;
  } catch (error) {
    console.error('Failed to decode game state:', error);
    return null;
  }
}

/**
 * Save game state to URL hash
 */
export function saveStateToURL(
  planets: PlanetConfig[],
  commands: CommandType[]
): void {
  if (typeof window === 'undefined') return;
  const encoded = encodeGameState(planets, commands);
  window.location.hash = `state=${encoded}`;
}

/**
 * Load game state from URL hash
 */
export function loadStateFromURL(): GameSnapshot | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;

  if (!hash || !hash.startsWith('#state=')) {
    return null;
  }

  const encoded = hash.substring(7); // Remove '#state='
  return decodeGameState(encoded);
}

/**
 * Clear state from URL
 */
export function clearStateFromURL(): void {
  if (typeof window === 'undefined') return;
  window.location.hash = '';
}

/**
 * Replay commands to reconstruct game state
 * This is where the magic happens - deterministic replay!
 *
 * Note: Full implementation requires importing command functions from commands.ts
 * This is a placeholder that demonstrates the architecture
 */
export function replayCommands(
  initialGameState: GameState,
  commands: CommandType[]
): GameState {
  let gameState = initialGameState;

  console.log(`[URL State] Replaying ${commands.length} commands...`);

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const [type, ...args] = cmd;

    try {
      switch (type) {
        case 'q': {
          // Queue command
          const [planetIdx, turn, itemId, quantity] = args as [number, number, string, number];
          const planetId = Array.from(gameState.planets.keys())[planetIdx];
          if (!planetId) {
            console.warn(`[URL State] Command ${i}: Invalid planet index ${planetIdx}`);
            break;
          }

          // Note: This would call enqueueBuildingForPlanet(gameState, planetId, itemId, quantity)
          // For now, log the action
          console.log(`[URL State] Command ${i}: Queue ${itemId} x${quantity} on planet ${planetIdx} at turn ${turn}`);
          break;
        }

        case 'c': {
          // Cancel command
          const [planetIdx, laneId, entryId] = args as [number, LaneId, string];
          console.log(`[URL State] Command ${i}: Cancel ${laneId} entry ${entryId} on planet ${planetIdx}`);
          break;
        }

        case 'r': {
          // Reorder command
          const [planetIdx, laneId, entryId, newIdx] = args as [number, LaneId, string, number];
          console.log(`[URL State] Command ${i}: Reorder ${laneId} entry ${entryId} to index ${newIdx}`);
          break;
        }

        case 'a': {
          // Advance turns
          const [planetIdx, turns] = args as [number, number];
          console.log(`[URL State] Command ${i}: Advance ${turns} turns on planet ${planetIdx}`);
          break;
        }

        case 'p': {
          // Add planet
          const [config] = args as [PlanetConfig];
          console.log(`[URL State] Command ${i}: Add planet ${config.name}`);
          // gameState = addPlanet(gameState, config);
          break;
        }

        case 's': {
          // Switch planet
          const [planetIdx] = args as [number];
          console.log(`[URL State] Command ${i}: Switch to planet ${planetIdx}`);
          break;
        }

        case 'qr': {
          // Queue research
          const [itemId] = args as [string];
          console.log(`[URL State] Command ${i}: Queue research ${itemId}`);
          // gameState = queueResearch(gameState, itemId);
          break;
        }

        default:
          console.warn(`[URL State] Command ${i}: Unknown command type ${type}`);
      }
    } catch (error) {
      console.error(`[URL State] Command ${i} failed:`, error);
      // Continue with remaining commands
    }
  }

  console.log('[URL State] Replay complete');
  return gameState;
}

/**
 * Extract planet configurations from game state
 */
export function extractPlanetConfigs(gameState: GameState): PlanetConfig[] {
  return Array.from(gameState.planets.values()).map(planet => ({
    name: planet.name,
    startTurn: planet.startTurn,
    abundance: {
      metal: planet.abundance?.metal || 1,
      mineral: planet.abundance?.mineral || 1,
      food: planet.abundance?.food || 1,
      energy: planet.abundance?.energy || 1,
      research_points: planet.abundance?.research_points || 1,
    },
    space: {
      groundCap: planet.space?.groundCap || 60,
      orbitalCap: planet.space?.orbitalCap || 40,
    },
  }));
}

/**
 * Get planet index from ID
 */
export function getPlanetIndex(gameState: GameState, planetId: string): number {
  const planetIds = Array.from(gameState.planets.keys());
  return planetIds.indexOf(planetId);
}

/**
 * Size estimation helper
 */
export function estimateEncodedSize(
  planets: PlanetConfig[],
  commands: CommandType[]
): { json: number; encoded: number; chars: number } {
  const encoded = encodeGameState(planets, commands);
  const json = JSON.stringify({ v: STATE_VERSION, planets, cmds: commands });

  return {
    json: json.length,
    encoded: encoded.length,
    chars: encoded.length,
  };
}
