"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen]);

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

  const localOptions = useMemo(() => {
    return options.filter((option) => option.kind !== 'shared');
  }, [options]);

  const sharedOptions = useMemo(() => {
    return options.filter((option) => option.kind === 'shared');
  }, [options]);

  const ownListCount = recentLocalLists.length + ownLists.length;
  const hasLists = ownListCount + sharedLists.length > 0;
  const listCountLabel = [
    formatCount(ownListCount, 'local'),
    formatCount(sharedLists.length, 'shared'),
  ].filter(Boolean).join(' / ');

  const handleToggleMenu = useCallback(() => {
    if (!hasLists) return;
    setIsMenuOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) refresh();
      return nextOpen;
    });
  }, [hasLists, refresh]);

  const handleSelectOption = useCallback((option: BuildListOption) => {
    setSelectedKey(optionKey(option));
    setIsMenuOpen(false);
  }, []);

  const handleLoad = useCallback(() => {
    if (!selected) return;
    setIsMenuOpen(false);
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
      setIsMenuOpen(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Could not delete build list');
    }
  }, [refresh, selected]);

  return (
    <div className="px-3 md:px-6 py-3">
      <div className="max-w-[1800px] mx-auto overflow-visible rounded-2xl border border-white/10 bg-gradient-to-r from-pink-nebula-panel/90 via-slate-950/55 to-pink-nebula-panel/80 p-3 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="min-w-0 xl:w-72">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl border border-pink-nebula-accent-primary/40 bg-pink-nebula-accent-primary/15 shadow-lg shadow-pink-nebula-accent-primary/10" />
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-pink-nebula-text">Build lists</div>
                <div className="text-xs text-pink-nebula-muted">Local cache for your plans and opened shares</div>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-w-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={handleToggleMenu}
              disabled={!hasLists}
              className="group flex min-h-[58px] w-full items-center justify-between gap-3 rounded-2xl border border-pink-nebula-border/80 bg-slate-950/60 px-4 py-3 text-left shadow-inner shadow-black/30 outline-none transition-all duration-200 hover:border-pink-nebula-accent-primary/70 hover:bg-slate-900/80 focus:border-pink-nebula-accent-secondary focus:ring-2 focus:ring-pink-nebula-accent-primary/25 disabled:cursor-not-allowed disabled:opacity-55"
              aria-label="Select build list"
              aria-haspopup="listbox"
              aria-expanded={isMenuOpen}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-pink-nebula-text">
                  {selected ? selected.label : loading ? 'Scanning local build cache...' : hasLists ? 'Choose a build list' : 'No saved or shared lists yet'}
                </span>
                <span className="mt-1 block truncate text-xs text-pink-nebula-muted">
                  {selected ? buildSelectedDescription(selected) : hasLists ? listCountLabel : 'Create a queue or open a shared link to populate this shelf'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {loading && <span className="h-2 w-2 rounded-full bg-pink-nebula-accent-secondary shadow-[0_0_12px_rgba(255,64,129,0.9)]" />}
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-nebula-muted transition-colors group-hover:text-pink-nebula-text">
                  {isMenuOpen ? 'Close' : 'Open'}
                </span>
              </span>
            </button>

            {isMenuOpen && hasLists && (
              <div
                role="listbox"
                aria-label="Build lists"
                className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-pink-nebula-accent-primary/30 bg-[#160d20]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl"
              >
                <BuildListGroup
                  label="Your lists"
                  count={localOptions.length}
                  options={localOptions}
                  selectedKey={selectedKey}
                  onSelect={handleSelectOption}
                />
                <BuildListGroup
                  label="Shared lists"
                  count={sharedOptions.length}
                  options={sharedOptions}
                  selectedKey={selectedKey}
                  onSelect={handleSelectOption}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 xl:w-auto">
            <button
              onClick={handleLoad}
              disabled={!selected}
              className="min-h-[46px] rounded-xl border border-pink-nebula-accent-secondary/40 bg-gradient-to-r from-pink-nebula-accent-primary to-pink-nebula-accent-secondary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-pink-nebula-accent-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pink-nebula-accent-primary/35 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-none disabled:bg-white/5 disabled:text-pink-nebula-muted disabled:shadow-none"
            >
              Load
            </button>
            <button
              onClick={handleDelete}
              disabled={!selected}
              className="min-h-[46px] rounded-xl border border-red-400/25 bg-red-950/35 px-4 py-2 text-sm font-semibold text-red-200 transition-all duration-200 hover:border-red-300/60 hover:bg-red-700/70 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-pink-nebula-muted"
            >
              Delete
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="min-h-[46px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-pink-nebula-text transition-all duration-200 hover:border-pink-nebula-accent-primary/50 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {selected && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-pink-nebula-muted">
            <span className={badgeClassForOption(selected)}>{optionKindLabel(selected)}</span>
            <span>{buildSelectedDescription(selected)}</span>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

interface BuildListGroupProps {
  label: string;
  count: number;
  options: BuildListOption[];
  selectedKey: string;
  onSelect: (option: BuildListOption) => void;
}

function BuildListGroup({ label, count, options, selectedKey, onSelect }: BuildListGroupProps) {
  if (options.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between px-2 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-pink-nebula-muted">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="space-y-1">
        {options.map((option) => {
          const key = optionKey(option);
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(option)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-pink-nebula-accent-secondary/70 bg-pink-nebula-accent-primary/20 shadow-lg shadow-pink-nebula-accent-primary/10'
                  : 'border-white/5 bg-white/[0.03] hover:border-pink-nebula-accent-primary/40 hover:bg-white/[0.07]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-pink-nebula-text">{option.label}</div>
                  <div className="mt-1 truncate text-xs text-pink-nebula-muted">{buildOptionMeta(option)}</div>
                </div>
                <span className={badgeClassForOption(option)}>{optionKindLabel(option)}</span>
              </div>
            </button>
          );
        })}
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

function buildSelectedDescription(option: BuildListOption): string {
  if (option.kind === 'shared') {
    return `Shared by ${option.record.author}; opened ${formatOpenedTimestamp(option.record.openedAt)}`;
  }
  if (option.kind === 'history') {
    return `Recent local auto-save from ${new Date(option.record.savedAt).toLocaleString()}`;
  }
  return `Saved locally; updated ${new Date(option.record.updatedAt).toLocaleString()}`;
}

function buildOptionMeta(option: BuildListOption): string {
  const summary = option.record.summary;
  const planetText = summary.planetNames || `${summary.planetCount} planet${summary.planetCount === 1 ? '' : 's'}`;
  const commandText = `${summary.commandCount} command${summary.commandCount === 1 ? '' : 's'}`;
  if (option.kind === 'shared') {
    return `${planetText} - ${commandText} - by ${option.record.author}`;
  }
  if (option.kind === 'history') {
    return `${planetText} - ${commandText} - auto-saved ${new Date(option.record.savedAt).toLocaleString()}`;
  }
  return `${planetText} - ${commandText} - updated ${new Date(option.record.updatedAt).toLocaleString()}`;
}

function optionKindLabel(option: BuildListOption): string {
  if (option.kind === 'shared') return 'Shared';
  if (option.kind === 'history') return 'Recent';
  return 'Mine';
}

function badgeClassForOption(option: BuildListOption): string {
  const base = 'shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide';
  if (option.kind === 'shared') return `${base} border-blue-300/30 bg-blue-400/10 text-blue-100`;
  if (option.kind === 'history') return `${base} border-amber-300/30 bg-amber-400/10 text-amber-100`;
  return `${base} border-pink-nebula-accent-secondary/35 bg-pink-nebula-accent-primary/15 text-pink-100`;
}

function formatCount(count: number, label: string): string {
  if (count <= 0) return '';
  return `${count} ${label}`;
}
