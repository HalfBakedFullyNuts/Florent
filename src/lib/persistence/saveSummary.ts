/**
 * Build a human-readable summary from an encoded game-state string.
 * Used by the saves UI to preview entries without restoring them.
 */

import { decodeGameState, getShareMetadataFromSnapshot } from '../game/urlState';
import type { SaveSummary } from './savesDb';

export function buildSaveSummary(encoded: string): SaveSummary {
  const fallback: SaveSummary = {
    planetCount: 0,
    commandCount: 0,
    maxTurn: 0,
    planetNames: '',
  };
  try {
    const decoded = decodeGameState(encoded);
    if (!decoded) return fallback;
    // Compact planet configs (v1/v2) store the name in `n`.
    const names = decoded.planets.map((p) => (p as { n?: string }).n || 'Unnamed').join(', ');
    const share = getShareMetadataFromSnapshot(decoded);
    return {
      planetCount: decoded.planets.length,
      commandCount: decoded.cmds.length,
      // maxTurn requires replay to know — store 0 and let the UI omit it.
      maxTurn: 0,
      planetNames: names.length > 80 ? `${names.slice(0, 77)}...` : names,
      shareName: share?.name,
      shareAuthor: share?.author,
    };
  } catch {
    return fallback;
  }
}

/**
 * Build a SaveSummary directly from the in-memory snapshot inputs, WITHOUT
 * decoding the encoded payload. Used on the autosave hot path where the full
 * decode would be wasted work.
 */
export function buildSaveSummaryFromConfigs(
  planets: Array<{ n?: string; name?: string }>,
  commands: unknown[],
  share?: { name?: string; author?: string } | null
): SaveSummary {
  const names = planets
    .map((p) => p.n || p.name || 'Unnamed')
    .join(', ');
  return {
    planetCount: planets.length,
    commandCount: commands.length,
    maxTurn: 0,
    planetNames: names.length > 80 ? `${names.slice(0, 77)}...` : names,
    shareName: share?.name,
    shareAuthor: share?.author,
  };
}
