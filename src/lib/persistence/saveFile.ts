/**
 * JSON file export/import. Wraps the same encoded format used in the share URL,
 * but adds human-readable metadata so users can browse files outside the app.
 */

import { decodeGameState, getShareMetadataFromSnapshot } from '../game/urlState';
import type { SaveSummary } from './savesDb';

const FILE_FORMAT_VERSION = 1;

export interface SaveFile {
  /** Format version of THIS file wrapper, not the encoded payload version. */
  format: number;
  /** Display name (optional — falls back to "Imported save" on load). */
  name?: string;
  exportedAt: string; // ISO timestamp
  app: 'florent';
  /** Decoded for browsability — re-derived on import, not trusted. */
  metadata: SaveSummary;
  /** The actual portable payload — same string the share URL uses. */
  encoded: string;
}

/** Serialise to a pretty-printed JSON string. */
export function serialiseSaveFile(input: { name?: string; encoded: string; summary: SaveSummary }): string {
  const file: SaveFile = {
    format: FILE_FORMAT_VERSION,
    name: input.name,
    exportedAt: new Date().toISOString(),
    app: 'florent',
    metadata: input.summary,
    encoded: input.encoded,
  };
  return JSON.stringify(file, null, 2);
}

/** Trigger a browser download of the given JSON content. */
export function downloadSaveFile(filename: string, contents: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedSaveFile {
  ok: boolean;
  reason?: string;
  file?: SaveFile;
}

/** Parse a JSON string into a SaveFile and validate that the encoded payload decodes. */
export function parseSaveFile(jsonText: string): ParsedSaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, reason: 'Not valid JSON' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'JSON root is not an object' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== 'florent') {
    return { ok: false, reason: 'Not a Florent save file (app field missing)' };
  }
  if (typeof obj.encoded !== 'string' || !obj.encoded) {
    return { ok: false, reason: 'Missing encoded payload' };
  }
  const decoded = decodeGameState(obj.encoded);
  if (!decoded) {
    return { ok: false, reason: 'Encoded payload could not be decoded' };
  }
  const share = getShareMetadataFromSnapshot(decoded);
  return {
    ok: true,
    file: {
      format: typeof obj.format === 'number' ? obj.format : FILE_FORMAT_VERSION,
      name: typeof obj.name === 'string' ? obj.name : undefined,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      app: 'florent',
      metadata: (obj.metadata as SaveSummary) ?? {
        planetCount: decoded.planets.length,
        commandCount: decoded.cmds.length,
        maxTurn: 0,
        // Compact planet configs use `n` for name.
        planetNames: decoded.planets.map((p) => (p as { n?: string }).n || 'Unnamed').join(', '),
        shareName: share?.name,
        shareAuthor: share?.author,
      },
      encoded: obj.encoded,
    },
  };
}

/** Build a default filename from a save name (sanitised) and timestamp. */
export function buildDefaultFilename(name?: string): string {
  const safe = (name ?? 'florent-save')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'florent-save';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `${safe}_${stamp}.florent.json`;
}
