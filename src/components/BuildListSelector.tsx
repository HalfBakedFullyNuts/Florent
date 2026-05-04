"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteHistoryEntry,
  deleteSave,
  deleteSharedLink,
  listHistory,
  listSaves,
  listShared,
  SAVES_CHANGED_EVENT,
  type HistoryRecord,
  type SaveRecord,
  type SharedRecord,
} from '../lib/persistence/savesDb';
import { formatOpenedTimestamp } from '../lib/persistence/saveLabels';

type BuildListOption =
  | { kind: 'history'; id: string; label: string; record: HistoryRecord }
  | { kind: 'own'; id: string; label: string; record: SaveRecord }
  | { kind: 'shared'; id: string; label: string; record: SharedRecord };

const RECENT_LOCAL_LIMIT = 5;

export interface BuildListSelectorProps {
  onRestore: (encoded: string, label: string) => void;
}

/**
 * Local build-list switcher. Named saves are user-owned; shared lists are only
 * cached locally after opening a shared link and are never synced.
 */
export function BuildListSelector({ onRestore }: BuildListSelectorProps) {
  const [recentLocalLists, setRecentLocalLists] = useState<HistoryRecord[]>([]);
  const [ownLists, setOwnLists] = useState<SaveRecord[]>([]);
  const [sharedLists, setSharedLists] = useState<SharedRecord[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return;
    setLoading(true);
    setError(null);
    try {
      const [own, shared, history] = await Promise.all([listSaves(), listShared(), listHistory()]);
      const namedEncodings = new Set(own.map((record) => record.encoded));
      const seenRecentEncodings = new Set<string>();
      const recentOwnedHistory = history
        .filter((record) => !record.summary.shareName && !record.summary.shareAuthor)
        .filter((record) => !namedEncodings.has(record.encoded))
        .filter((record) => {
          if (seenRecentEncodings.has(record.encoded)) return false;
          seenRecentEncodings.add(record.encoded);
          return true;
        })
        .slice(0, RECENT_LOCAL_LIMIT);
      setRecentLocalLists(recentOwnedHistory);
      setOwnLists(own);
      setSharedLists([...shared].sort((a, b) => b.openedAt - a.openedAt));
    } catch (e) {
      setError((e as Error).message || 'Could not load build lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(SAVES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SAVES_CHANGED_EVENT, refresh);
  }, [refresh]);

  const options = useMemo(() => {
    const recentLocal = recentLocalLists.map((record): BuildListOption => ({
      kind: 'history',
      id: String(record.id),
      label: buildRecentLocalLabel(record),
      record,
    }));
    const own = ownLists.map((record): BuildListOption => ({
      kind: 'own',
      id: record.id,
      label: record.name,
      record,
    }));
    const shared = sharedLists.map((record): BuildListOption => ({
      kind: 'shared',
      id: record.id,
      label: buildSharedLabel(record),
      record,
    }));
    return [...recentLocal, ...own, ...shared];
  }, [ownLists, recentLocalLists, sharedLists]);

  const selected = useMemo(() => {
    return options.find((option) => optionKey(option) === selectedKey) ?? null;
  }, [options, selectedKey]);

  const handleLoad = useCallback(() => {
    if (!selected) return;
    onRestore(selected.record.encoded, selected.label);
  }, [onRestore, selected]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    const typeLabel = selected.kind === 'shared'
      ? 'this shared cached list'
      : selected.kind === 'history'
        ? 'this recent local build'
        : 'your saved list';
    if (!window.confirm(`Delete ${typeLabel} "${selected.label}" from this device?`)) return;

    try {
      if (selected.kind === 'own') {
        await deleteSave(selected.id);
      } else if (selected.kind === 'history') {
        await deleteHistoryEntry(Number(selected.id));
      } else {
        await deleteSharedLink(selected.id);
      }
      setSelectedKey('');
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Could not delete build list');
    }
  }, [refresh, selected]);

  const ownListCount = recentLocalLists.length + ownLists.length;
  const hasLists = ownListCount + sharedLists.length > 0;

  return (
    <div className="px-3 md:px-6 py-2">
      <div className="max-w-[1800px] mx-auto rounded-lg border border-pink-nebula-border bg-pink-nebula-panel/60 p-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="min-w-0 lg:w-52">
            <div className="text-sm font-semibold text-pink-nebula-text">Build list</div>
            <div className="text-xs text-pink-nebula-muted">Local lists only. Shared links are cached on this device.</div>
          </div>

          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            onFocus={refresh}
            disabled={!hasLists}
            className="flex-1 min-h-[42px] px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none text-sm disabled:opacity-50"
            aria-label="Select build list"
          >
            <option value="">{loading ? 'Loading build lists...' : hasLists ? 'Select a build list...' : 'No saved or shared lists yet'}</option>
            {ownListCount > 0 && (
              <optgroup label="Your lists">
                {recentLocalLists.map((list) => (
                  <option key={list.id} value={`history:${list.id}`}>
                    {buildRecentLocalLabel(list)}
                  </option>
                ))}
                {ownLists.map((list) => (
                  <option key={list.id} value={`own:${list.id}`}>
                    {list.name}
                  </option>
                ))}
              </optgroup>
            )}
            {sharedLists.length > 0 && (
              <optgroup label="Shared lists cached on this device">
                {sharedLists.map((list) => (
                  <option key={list.id} value={`shared:${list.id}`}>
                    {buildSharedLabel(list)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <div className="flex flex-wrap gap-2 lg:w-auto">
            <button
              onClick={handleLoad}
              disabled={!selected}
              className="flex-1 lg:flex-initial px-4 py-2 bg-pink-nebula-accent-primary/80 hover:bg-pink-nebula-accent-primary text-white rounded font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Load
            </button>
            <button
              onClick={handleDelete}
              disabled={!selected}
              className="flex-1 lg:flex-initial px-4 py-2 bg-red-900/40 hover:bg-red-700 text-red-200 hover:text-white rounded font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex-1 lg:flex-initial px-4 py-2 bg-slate-700 hover:bg-slate-600 text-pink-nebula-text rounded font-semibold text-sm disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
        </div>

        {selected && (
          <div className="mt-2 text-xs text-pink-nebula-muted">
            {selected.kind === 'shared'
              ? `Shared cached list: ${selected.record.name} by ${selected.record.author}; opened ${formatOpenedTimestamp(selected.record.openedAt)}`
              : selected.kind === 'history'
                ? `Your recent local build: ${selected.record.summary.planetNames || 'local build'}`
                : `Your saved list: ${selected.label}`}
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
      </div>
    </div>
  );
}

function optionKey(option: BuildListOption): string {
  return `${option.kind}:${option.id}`;
}

function buildRecentLocalLabel(record: HistoryRecord): string {
  const planets = record.summary.planetNames || 'local build';
  return `Recent local build - ${planets} (${new Date(record.savedAt).toLocaleString()})`;
}

function buildSharedLabel(record: SharedRecord): string {
  return `${record.name} by ${record.author} - opened ${formatOpenedTimestamp(record.openedAt)}`;
}
