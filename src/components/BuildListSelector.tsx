"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
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
  onRestore: (encoded: string, label: string, options?: { shared?: boolean }) => void;
  className?: string;
}

/**
 * Local build-list switcher. Named saves are user-owned; shared lists are only
 * cached locally after opening a shared link and are never synced.
 */
export function BuildListSelector({ onRestore, className }: BuildListSelectorProps) {
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
    onRestore(selected.record.encoded, selected.label, { shared: selected.kind === 'shared' });
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

  const triggerTitle = selected ? selected.label : loading ? 'Scanning local build cache…' : hasLists ? 'Choose a build list' : 'No saved or shared lists yet';
  const triggerMeta = selected ? buildSelectedDescription(selected) : hasLists ? listCountLabel : 'Create a queue or open a shared link to fill this list';

  return (
    <div className={`relative min-w-0 ${isMenuOpen ? 'z-40' : 'z-20'} ${className ?? ''}`}>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="eyebrow">Build list</span>
        <span className="truncate text-xs text-ink-3">Local plans & opened shares</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={handleToggleMenu}
            disabled={!hasLists}
            className="field flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Select build list"
            aria-haspopup="listbox"
            aria-expanded={isMenuOpen}
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-semibold text-ink">{triggerTitle}</span>
              <span className="hidden truncate text-xs text-ink-3 md:inline">{triggerMeta}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {loading && <span className="h-1.5 w-1.5 rounded-full bg-halpha" aria-hidden="true" />}
              {selected && <span className={badgeClassForOption(selected)}>{optionKindLabel(selected)}</span>}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 text-ink-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {isMenuOpen && hasLists && (
            <div
              role="listbox"
              aria-label="Build lists"
              className="scroll-nebula panel absolute left-0 right-0 top-full z-[90] mt-1 max-h-[420px] overflow-y-auto p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
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

        <button type="button" onClick={handleLoad} disabled={!selected} className="btn btn-secondary flex-1 sm:flex-none">
          Load
        </button>
        <button type="button" onClick={handleDelete} disabled={!selected} className="btn btn-danger flex-1 sm:flex-none">
          Delete
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="btn btn-ghost btn-icon"
          aria-label="Refresh build lists"
          title="Refresh build lists"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div role="alert" className="callout mt-2 border-l-danger text-xs text-danger">
          {error}
        </div>
      )}
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
      <div className="eyebrow flex items-center justify-between px-2 py-1.5">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="space-y-0.5">
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
              className={`w-full rounded-ctl px-3 py-2 text-left transition-colors ${
                isSelected ? 'bg-veil-hi shadow-[inset_2px_0_0_#5FD4C4]' : 'hover:bg-veil'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{option.label}</div>
                  <div className="mt-0.5 truncate text-xs text-ink-3">{buildOptionMeta(option)}</div>
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
  const base = 'chip h-5 px-1.5 text-[11px]';
  if (option.kind === 'shared') return `${base} text-oiii`;
  if (option.kind === 'history') return `${base} text-caution`;
  return `${base} text-halpha-soft`;
}

function formatCount(count: number, label: string): string {
  if (count <= 0) return '';
  return `${count} ${label}`;
}
