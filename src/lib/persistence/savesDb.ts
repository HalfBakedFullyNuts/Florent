/**
 * IndexedDB persistence layer for game saves and auto-save history.
 *
 * Three stores:
 *   - `saves`     : named saves the user manages explicitly.
 *   - `history`   : ring buffer of the most recent N auto-saves; lets the user
 *                   "undo" back to any prior auto-save without losing it.
 *   - `shared`    : build lists opened from shared links, cached locally.
 *
 * The encoded payload uses the same v2 format as the share URL — see
 * `src/lib/game/urlState.ts`. Storing the encoded string keeps this layer
 * decoupled from the engine.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const HISTORY_LIMIT = 30;
export const SAVES_CHANGED_EVENT = 'florent:saves-changed';

export interface SaveSummary {
  /** Number of planets in the save. */
  planetCount: number;
  /** Total commands recorded across all planets. */
  commandCount: number;
  /** Highest currentTurn across planets, useful for previews. */
  maxTurn: number;
  /** Comma-joined planet names (truncated for display). */
  planetNames: string;
  /** Optional display name carried by a shared link. */
  shareName?: string;
  /** Optional author carried by a shared link. */
  shareAuthor?: string;
}

export interface SaveRecord {
  /** UUID-like string. */
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  encoded: string;
  summary: SaveSummary;
}

export interface HistoryRecord {
  /** Auto-incremented numeric id. */
  id: number;
  savedAt: number;
  encoded: string;
  summary: SaveSummary;
}

export interface SharedRecord {
  /** Stable id derived from the encoded payload. */
  id: string;
  name: string;
  author: string;
  openedAt: number;
  encoded: string;
  summary: SaveSummary;
}

interface FlorentDB extends DBSchema {
  saves: {
    key: string;
    value: SaveRecord;
    indexes: { 'by-updated': number };
  };
  history: {
    key: number;
    value: HistoryRecord;
    indexes: { 'by-savedAt': number };
  };
  shared: {
    key: string;
    value: SharedRecord;
    indexes: { 'by-openedAt': number };
  };
}

const DB_NAME = 'florent';
const DB_VERSION = 2;

let cached: Promise<IDBPDatabase<FlorentDB>> | null = null;

function getDB(): Promise<IDBPDatabase<FlorentDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB only available in the browser'));
  }
  if (!cached) {
    cached = openDB<FlorentDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('saves')) {
          const saves = db.createObjectStore('saves', { keyPath: 'id' });
          saves.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('history')) {
          const history = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          history.createIndex('by-savedAt', 'savedAt');
        }
        if (!db.objectStoreNames.contains('shared')) {
          const shared = db.createObjectStore('shared', { keyPath: 'id' });
          shared.createIndex('by-openedAt', 'openedAt');
        }
      },
    });
  }
  return cached;
}

/** Reset the cached connection — useful for tests. */
export function resetDbCache(): void {
  cached = null;
}

// ---------------------------------------------------------------------------
// Saves (named, user-managed)
// ---------------------------------------------------------------------------

export async function listSaves(): Promise<SaveRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('saves', 'by-updated');
  return all.reverse(); // newest first
}

export async function getSave(id: string): Promise<SaveRecord | undefined> {
  const db = await getDB();
  return db.get('saves', id);
}

export async function saveSave(record: Omit<SaveRecord, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  const final: SaveRecord = {
    ...record,
    createdAt: record.createdAt ?? now,
    updatedAt: now,
  };
  await db.put('saves', final);
  notifySavesChanged();
}

export async function deleteSave(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('saves', id);
  notifySavesChanged();
}

export async function renameSave(id: string, name: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('saves', id);
  if (!existing) return;
  existing.name = name;
  existing.updatedAt = Date.now();
  await db.put('saves', existing);
  notifySavesChanged();
}

// ---------------------------------------------------------------------------
// History (ring buffer of auto-saves)
// ---------------------------------------------------------------------------

export async function listHistory(): Promise<HistoryRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('history', 'by-savedAt');
  return all.reverse(); // newest first
}

/**
 * Append an auto-save snapshot, then prune the oldest entries past HISTORY_LIMIT.
 * Skips if the latest snapshot has the same encoded payload (no-op change).
 */
export async function pushHistory(encoded: string, summary: SaveSummary): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('history', 'readwrite');
  const store = tx.objectStore('history');
  const idx = store.index('by-savedAt');

  const cursor = await idx.openCursor(null, 'prev');
  if (cursor && cursor.value.encoded === encoded) {
    await tx.done;
    return; // nothing changed since last auto-save
  }

  // IMPORTANT: do NOT include `id` in the value — IndexedDB rejects an
  // explicit-undefined keyPath value with DataError. The autoIncrement-only
  // contract is "omit the field, the engine assigns one".
  const newEntry = { savedAt: Date.now(), encoded, summary };
  await store.add(newEntry as unknown as HistoryRecord);

  // Prune oldest entries beyond HISTORY_LIMIT.
  const count = await store.count();
  if (count > HISTORY_LIMIT) {
    const removeCount = count - HISTORY_LIMIT;
    const oldCursor = await idx.openCursor(null, 'next');
    let removed = 0;
    let walker = oldCursor;
    while (walker && removed < removeCount) {
      await walker.delete();
      removed++;
      walker = await walker.continue();
    }
  }

  await tx.done;
  notifySavesChanged();
}

export async function getHistoryEntry(id: number): Promise<HistoryRecord | undefined> {
  const db = await getDB();
  return db.get('history', id);
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('history', id);
  notifySavesChanged();
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
  notifySavesChanged();
}

// ---------------------------------------------------------------------------
// Shared links (opened from other players)
// ---------------------------------------------------------------------------

export async function listShared(): Promise<SharedRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('shared', 'by-openedAt');
  return all.reverse(); // newest first
}

export async function saveSharedLink(input: {
  encoded: string;
  name: string;
  author: string;
  summary: SaveSummary;
}): Promise<void> {
  const db = await getDB();
  const id = buildSharedRecordId(input.encoded);
  const now = Date.now();
  const final: SharedRecord = {
    id,
    encoded: input.encoded,
    name: input.name,
    author: input.author,
    summary: input.summary,
    openedAt: now,
  };
  await db.put('shared', final);
  notifySavesChanged();
}

export async function deleteSharedLink(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('shared', id);
  notifySavesChanged();
}

function buildSharedRecordId(encoded: string): string {
  let hash = 2166136261;
  for (let i = 0; i < encoded.length; i++) {
    hash ^= encoded.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `shared-${(hash >>> 0).toString(36)}`;
}

function notifySavesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVES_CHANGED_EVENT));
}

// ---------------------------------------------------------------------------
// Migration: copy single-slot localStorage save into history once on first load.
// Lets existing users preserve their last session when IndexedDB takes over.
// ---------------------------------------------------------------------------

const MIGRATION_FLAG = 'florent_idb_migrated_v1';

function getLegacyLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (
      !storage ||
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function'
    ) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

export async function migrateLegacyLocalStorage(buildSummary: (encoded: string) => SaveSummary): Promise<void> {
  if (typeof window === 'undefined') return;
  if (typeof window.indexedDB === 'undefined') return;
  const storage = getLegacyLocalStorage();
  if (!storage) return;

  try {
    if (storage.getItem(MIGRATION_FLAG) === '1') return;
    const encoded = storage.getItem('florent_save');
    if (encoded) {
      const summary = buildSummary(encoded);
      await pushHistory(encoded, summary);
    }
  } catch (err) {
    console.warn('[savesDb] legacy migration failed:', err);
  } finally {
    try { storage.setItem(MIGRATION_FLAG, '1'); } catch { /* ignore */ }
  }
}
