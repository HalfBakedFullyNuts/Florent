"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  listSaves,
  listHistory,
  saveSave,
  deleteSave,
  renameSave,
  type SaveRecord,
  type HistoryRecord,
  type SaveSummary,
} from '../lib/persistence/savesDb';
import {
  serialiseSaveFile,
  downloadSaveFile,
  parseSaveFile,
  buildDefaultFilename,
} from '../lib/persistence/saveFile';

type Tab = 'saves' | 'history' | 'import';

export interface SavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Returns the current encoded state + summary for "Save current as…" / Export. */
  getCurrentSnapshot: () => { encoded: string; summary: SaveSummary } | null;
  /** Restore an encoded payload into the live game state. */
  onRestore: (encoded: string, label: string) => void;
}

/**
 * Saves manager — three tabs: named saves, auto-save history, JSON import.
 * Reads/writes IndexedDB via savesDb; this component owns no game logic.
 */
export function SavesModal({ isOpen, onClose, getCurrentSnapshot, onRestore }: SavesModalProps) {
  const [tab, setTab] = useState<Tab>('saves');
  const [saves, setSaves] = useState<SaveRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSaveName, setNewSaveName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importText, setImportText] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, h] = await Promise.all([listSaves(), listHistory()]);
      setSaves(s);
      setHistory(h);
    } catch (e) {
      setError((e as Error).message || 'Failed to read saves');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const handleSaveCurrent = useCallback(async () => {
    const snap = getCurrentSnapshot();
    if (!snap) {
      setError('Nothing to save — start building a queue first.');
      return;
    }
    const name = newSaveName.trim() || `Save ${new Date().toLocaleString()}`;
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as Crypto).randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveSave({ id, name, encoded: snap.encoded, summary: snap.summary });
    setNewSaveName('');
    await refresh();
  }, [getCurrentSnapshot, newSaveName, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this save? This cannot be undone.')) return;
    await deleteSave(id);
    await refresh();
  }, [refresh]);

  const handleRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) return;
    await renameSave(renamingId, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
    await refresh();
  }, [renamingId, renameValue, refresh]);

  const handleExportCurrent = useCallback(() => {
    const snap = getCurrentSnapshot();
    if (!snap) {
      setError('Nothing to export — start building a queue first.');
      return;
    }
    const name = newSaveName.trim() || 'florent-save';
    const json = serialiseSaveFile({ name, encoded: snap.encoded, summary: snap.summary });
    downloadSaveFile(buildDefaultFilename(name), json);
  }, [getCurrentSnapshot, newSaveName]);

  const handleExportSave = useCallback((save: SaveRecord) => {
    const json = serialiseSaveFile({ name: save.name, encoded: save.encoded, summary: save.summary });
    downloadSaveFile(buildDefaultFilename(save.name), json);
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setImportText(text);
    };
    reader.readAsText(file);
    // Reset value so the same file can be re-picked.
    e.target.value = '';
  }, []);

  const handleImportRestore = useCallback(() => {
    const parsed = parseSaveFile(importText);
    if (!parsed.ok || !parsed.file) {
      setError(parsed.reason || 'Invalid file');
      return;
    }
    onRestore(parsed.file.encoded, parsed.file.name || 'Imported save');
    setImportText('');
    onClose();
  }, [importText, onRestore, onClose]);

  const handleImportSaveAs = useCallback(async () => {
    const parsed = parseSaveFile(importText);
    if (!parsed.ok || !parsed.file) {
      setError(parsed.reason || 'Invalid file');
      return;
    }
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as Crypto).randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveSave({
      id,
      name: parsed.file.name || 'Imported save',
      encoded: parsed.file.encoded,
      summary: parsed.file.metadata,
    });
    setImportText('');
    setTab('saves');
    await refresh();
  }, [importText, refresh]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-start sm:items-center justify-center z-50 p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-pink-nebula-panel border-2 border-pink-nebula-border rounded-lg p-4 md:p-6 w-full max-w-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-pink-nebula-accent-primary">Saves</h2>
          <button
            onClick={onClose}
            className="px-3 py-2 text-pink-nebula-text hover:bg-slate-700 rounded transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 p-1 bg-pink-nebula-bg/50 rounded border border-pink-nebula-border">
          <TabButton active={tab === 'saves'} onClick={() => setTab('saves')}>
            💾 Saves {saves.length > 0 && <span className="opacity-60">({saves.length})</span>}
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            🕓 History {history.length > 0 && <span className="opacity-60">({history.length})</span>}
          </TabButton>
          <TabButton active={tab === 'import'} onClick={() => setTab('import')}>
            📥 Import
          </TabButton>
        </div>

        {error && (
          <div className="mb-3 p-2 text-sm bg-red-900/30 border border-red-500/40 rounded text-red-300">
            {error}
          </div>
        )}

        {tab === 'saves' && (
          <div>
            {/* Save current as… */}
            <div className="mb-4 p-3 bg-pink-nebula-bg/50 rounded border border-pink-nebula-border">
              <label className="block text-xs text-pink-nebula-muted mb-2">Save current state as…</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newSaveName}
                  onChange={(e) => setNewSaveName(e.target.value)}
                  placeholder="Save name (e.g. Tech rush)"
                  className="flex-1 px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none text-sm"
                />
                <button
                  onClick={handleSaveCurrent}
                  className="px-4 py-2 bg-pink-nebula-accent-primary text-white font-semibold rounded hover:bg-pink-500 transition-colors text-sm whitespace-nowrap"
                >
                  💾 Save
                </button>
                <button
                  onClick={handleExportCurrent}
                  title="Download current state as a .json file"
                  className="px-4 py-2 bg-slate-700 text-pink-nebula-text rounded hover:bg-slate-600 transition-colors text-sm whitespace-nowrap"
                >
                  📤 Export
                </button>
              </div>
            </div>

            {loading && <p className="text-pink-nebula-muted text-sm">Loading…</p>}
            {!loading && saves.length === 0 && (
              <p className="text-pink-nebula-muted text-sm py-4 text-center">No named saves yet.</p>
            )}

            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {saves.map((s) => (
                <li
                  key={s.id}
                  className="p-3 bg-pink-nebula-bg/40 border border-pink-nebula-border rounded"
                >
                  {renamingId === s.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        className="flex-1 px-2 py-1 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-accent-primary text-sm"
                      />
                      <button onClick={handleRename} className="px-3 py-1 bg-pink-nebula-accent-primary text-white rounded text-sm">Save</button>
                      <button onClick={() => setRenamingId(null)} className="px-3 py-1 bg-slate-700 text-pink-nebula-text rounded text-sm">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="font-semibold text-pink-nebula-text break-all">{s.name}</div>
                        <div className="text-xs text-pink-nebula-muted whitespace-nowrap">
                          {new Date(s.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <SummaryLine summary={s.summary} />
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          onClick={() => { onRestore(s.encoded, s.name); onClose(); }}
                          className="px-3 py-1.5 bg-pink-nebula-accent-primary/80 hover:bg-pink-nebula-accent-primary text-white rounded text-xs font-semibold"
                        >
                          ↩ Load
                        </button>
                        <button
                          onClick={() => handleExportSave(s)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-pink-nebula-text rounded text-xs"
                        >
                          📤 Export
                        </button>
                        <button
                          onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-pink-nebula-text rounded text-xs"
                        >
                          ✎ Rename
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="px-3 py-1.5 bg-red-900/40 hover:bg-red-700 text-red-300 hover:text-white rounded text-xs"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'history' && (
          <div>
            <p className="text-xs text-pink-nebula-muted mb-3">
              The last {history.length > 0 ? history.length : 'few'} auto-saves. Newest first. Older entries roll off automatically.
            </p>
            {loading && <p className="text-pink-nebula-muted text-sm">Loading…</p>}
            {!loading && history.length === 0 && (
              <p className="text-pink-nebula-muted text-sm py-4 text-center">No auto-save history yet — make a queue change first.</p>
            )}
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="p-3 bg-pink-nebula-bg/40 border border-pink-nebula-border rounded flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-pink-nebula-text">
                      {new Date(h.savedAt).toLocaleString()}
                    </div>
                    <SummaryLine summary={h.summary} />
                  </div>
                  <button
                    onClick={() => { onRestore(h.encoded, `Auto-save ${new Date(h.savedAt).toLocaleTimeString()}`); onClose(); }}
                    className="px-3 py-1.5 bg-pink-nebula-accent-primary/80 hover:bg-pink-nebula-accent-primary text-white rounded text-xs font-semibold whitespace-nowrap"
                  >
                    ↩ Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'import' && (
          <div className="space-y-3">
            <p className="text-xs text-pink-nebula-muted">
              Import a .json file shared by another device, or paste its contents below.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="block w-full text-sm text-pink-nebula-text file:mr-3 file:px-4 file:py-2 file:rounded file:border-0 file:bg-slate-700 file:text-pink-nebula-text hover:file:bg-slate-600 file:cursor-pointer"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="…or paste the JSON contents here"
              className="w-full h-40 px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none font-mono text-xs"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleImportRestore}
                disabled={!importText.trim()}
                className="flex-1 px-4 py-2 bg-pink-nebula-accent-primary text-white font-semibold rounded hover:bg-pink-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                ↩ Load now (replaces current state)
              </button>
              <button
                onClick={handleImportSaveAs}
                disabled={!importText.trim()}
                className="flex-1 px-4 py-2 bg-slate-700 text-pink-nebula-text font-semibold rounded hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                💾 Save as new entry (don&apos;t load)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded font-semibold text-sm transition-colors ${
        active
          ? 'bg-pink-nebula-accent-primary text-white shadow'
          : 'text-pink-nebula-text hover:bg-pink-nebula-panel'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryLine({ summary }: { summary: SaveSummary }) {
  return (
    <div className="text-xs text-pink-nebula-muted">
      {summary.planetCount} planet{summary.planetCount === 1 ? '' : 's'} · {summary.commandCount} command{summary.commandCount === 1 ? '' : 's'}
      {summary.planetNames && <span className="block break-all">{summary.planetNames}</span>}
    </div>
  );
}
