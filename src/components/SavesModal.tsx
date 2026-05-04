"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  FileUp,
  FolderOpen,
  History,
  Pencil,
  Save,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  listSaves,
  listHistory,
  listShared,
  saveSave,
  deleteSave,
  deleteSharedLink,
  renameSave,
  type SaveRecord,
  type HistoryRecord,
  type SharedRecord,
  type SaveSummary,
} from '../lib/persistence/savesDb';
import {
  serialiseSaveFile,
  downloadSaveFile,
  parsePortableSaveText,
  buildDefaultFilename,
} from '../lib/persistence/saveFile';
import { formatOpenedTimestamp } from '../lib/persistence/saveLabels';
import { stripShareMetadataFromEncodedState } from '../lib/game/urlState';

type Tab = 'saves' | 'shared' | 'history' | 'import';
type ActionTone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'quiet';

export interface SavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Returns the current encoded state + summary for "Save current as..." / Export. */
  getCurrentSnapshot: () => { encoded: string; summary: SaveSummary } | null;
  /** Restore an encoded payload into the live game state. */
  onRestore: (encoded: string, label: string, options?: { shared?: boolean }) => void;
}

/**
 * Saves manager: named saves, cached shared links, auto-save history, and imports.
 * Reads/writes IndexedDB via savesDb; this component owns no game simulation logic.
 */
export function SavesModal({ isOpen, onClose, getCurrentSnapshot, onRestore }: SavesModalProps) {
  const [tab, setTab] = useState<Tab>('saves');
  const [saves, setSaves] = useState<SaveRecord[]>([]);
  const [shared, setShared] = useState<SharedRecord[]>([]);
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
      const [s, sharedLinks, h] = await Promise.all([listSaves(), listShared(), listHistory()]);
      setSaves(s);
      setShared([...sharedLinks].sort((a, b) => b.openedAt - a.openedAt));
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
      setError('Nothing to save. Start building a queue first.');
      return;
    }
    const name = newSaveName.trim() || `Save ${new Date().toLocaleString()}`;
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as Crypto).randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveSave({
      id,
      name,
      encoded: asOwnedEncoded(snap.encoded),
      summary: asOwnedSummary(snap.summary),
    });
    setNewSaveName('');
    await refresh();
  }, [getCurrentSnapshot, newSaveName, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this save? This cannot be undone.')) return;
    await deleteSave(id);
    await refresh();
  }, [refresh]);

  const handleDeleteShared = useCallback(async (id: string) => {
    if (!confirm('Remove this shared list from this device?')) return;
    await deleteSharedLink(id);
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
      setError('Nothing to export. Start building a queue first.');
      return;
    }
    const name = newSaveName.trim() || 'florent-save';
    const json = serialiseSaveFile({ name, encoded: snap.encoded, summary: snap.summary });
    downloadSaveFile(buildDefaultFilename(name), json);
  }, [getCurrentSnapshot, newSaveName]);

  const handleExportSave = useCallback((save: SaveRecord) => {
    const owned = !isSharedSummary(save.summary);
    const json = serialiseSaveFile({
      name: save.name,
      encoded: owned ? asOwnedEncoded(save.encoded) : save.encoded,
      summary: owned ? asOwnedSummary(save.summary) : save.summary,
    });
    downloadSaveFile(buildDefaultFilename(save.name), json);
  }, []);

  const handleSaveSharedAsMine = useCallback(async (sharedList: SharedRecord) => {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as Crypto).randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await saveSave({
      id,
      name: `${sharedList.name} (copy)`,
      encoded: asOwnedEncoded(sharedList.encoded),
      summary: asOwnedSummary(sharedList.summary),
    });
    setTab('saves');
    await refresh();
  }, [refresh]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setImportText(text);
    };
    reader.onerror = () => {
      setError('Could not read that file.');
    };
    reader.readAsText(file);
    // Reset value so the same file can be re-picked.
    e.target.value = '';
  }, []);

  const handleImportRestore = useCallback(() => {
    const parsed = parsePortableSaveText(importText);
    if (!parsed.ok || !parsed.file) {
      setError(parsed.reason || 'Invalid file');
      return;
    }
    onRestore(parsed.file.encoded, parsed.file.name || 'Imported save', {
      shared: isSharedSummary(parsed.file.metadata),
    });
    setImportText('');
    onClose();
  }, [importText, onRestore, onClose]);

  const handleImportSaveAs = useCallback(async () => {
    const parsed = parsePortableSaveText(importText);
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
      encoded: asOwnedEncoded(parsed.file.encoded),
      summary: asOwnedSummary(parsed.file.metadata),
    });
    setImportText('');
    setTab('saves');
    await refresh();
  }, [importText, refresh]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#24142d]/95 via-[#171024]/95 to-[#0d1b2f]/95 shadow-2xl shadow-black/60 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 md:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">Local save vault</div>
            <h2 className="mt-1 text-2xl font-black text-pink-nebula-text">Saves</h2>
            <p className="mt-1 max-w-xl text-sm text-pink-nebula-muted">
              Named saves, shared links, history, and pasted files all live on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-nebula-muted transition-all hover:border-cyan-200/40 hover:bg-white/10 hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="border-b border-white/10 px-4 py-3 md:px-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-1 sm:grid-cols-4">
            <TabButton active={tab === 'saves'} onClick={() => setTab('saves')}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Saves {saves.length > 0 && <span className="opacity-70">({saves.length})</span>}
            </TabButton>
            <TabButton active={tab === 'shared'} onClick={() => setTab('shared')}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Shared {shared.length > 0 && <span className="opacity-70">({shared.length})</span>}
            </TabButton>
            <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
              <History className="h-4 w-4" aria-hidden="true" />
              History {history.length > 0 && <span className="opacity-70">({history.length})</span>}
            </TabButton>
            <TabButton active={tab === 'import'} onClick={() => setTab('import')}>
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Import
            </TabButton>
          </div>
        </div>

        <div className="scroll-nebula overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-300/35 bg-red-950/35 px-4 py-3 text-sm font-semibold text-red-100">
              {error}
            </div>
          )}

          {tab === 'saves' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/35 p-4 shadow-inner shadow-black/25">
                <label htmlFor="save-name" className="block text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                  Save current state as
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    id="save-name"
                    type="text"
                    value={newSaveName}
                    onChange={(e) => setNewSaveName(e.target.value)}
                    placeholder="Save name, e.g. Tech rush"
                    className="min-h-[44px] rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-pink-nebula-text outline-none transition-all placeholder:text-pink-nebula-muted/60 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/20"
                  />
                  <ActionButton tone="success" onClick={handleSaveCurrent}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save
                  </ActionButton>
                  <ActionButton tone="warning" onClick={handleExportCurrent} title="Download current state as a JSON file">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export file
                  </ActionButton>
                </div>
              </div>

              {loading && <LoadingLine />}
              {!loading && saves.length === 0 && (
                <EmptyState>No named saves yet. Save the current queue when you want a stable local checkpoint.</EmptyState>
              )}

              <ul className="scroll-nebula max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                {saves.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/15 transition-colors hover:border-cyan-200/25 hover:bg-white/[0.065]"
                  >
                    {renamingId === s.id ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          className="min-h-[42px] rounded-xl border border-cyan-200/50 bg-slate-950/75 px-3 py-2 text-sm text-pink-nebula-text outline-none focus:ring-2 focus:ring-cyan-300/20"
                        />
                        <ActionButton tone="success" onClick={handleRename}>
                          Save name
                        </ActionButton>
                        <ActionButton tone="quiet" onClick={() => setRenamingId(null)}>
                          Cancel
                        </ActionButton>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="break-words text-base font-black text-pink-nebula-text">{s.name}</div>
                            <SummaryLine summary={s.summary} />
                          </div>
                          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-pink-nebula-muted">
                            Updated {new Date(s.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionButton
                            tone="primary"
                            onClick={() => { onRestore(s.encoded, s.name, { shared: false }); onClose(); }}
                          >
                            <FolderOpen className="h-4 w-4" aria-hidden="true" />
                            Load mine
                          </ActionButton>
                          <ActionButton tone="warning" onClick={() => handleExportSave(s)}>
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Export file
                          </ActionButton>
                          <ActionButton
                            tone="secondary"
                            onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Rename
                          </ActionButton>
                          <ActionButton tone="danger" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Delete save
                          </ActionButton>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'shared' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-sky-200/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100/85">
                Shared lists are cached from opened links only. Saving one as mine creates a separate owned copy on this device.
              </div>
              {loading && <LoadingLine />}
              {!loading && shared.length === 0 && (
                <EmptyState>No shared lists opened yet. Open or paste a shared link and it will appear here.</EmptyState>
              )}
              <ul className="scroll-nebula max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                {shared.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-sky-300/25 bg-sky-950/20 p-4 shadow-lg shadow-black/15 transition-colors hover:border-sky-200/45 hover:bg-sky-900/25"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="break-words text-base font-black text-pink-nebula-text">{s.name}</div>
                        <div className="mt-1 text-xs font-semibold text-sky-100/80">Shared by {s.author}</div>
                        <SummaryLine summary={s.summary} />
                      </div>
                      <div className="shrink-0 rounded-full border border-sky-200/20 bg-sky-300/10 px-3 py-1 text-xs text-sky-100/75">
                        Opened {formatOpenedTimestamp(s.openedAt)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        tone="primary"
                        onClick={() => { onRestore(s.encoded, s.name, { shared: true }); onClose(); }}
                      >
                        <FolderOpen className="h-4 w-4" aria-hidden="true" />
                        Open shared
                      </ActionButton>
                      <ActionButton tone="success" onClick={() => handleSaveSharedAsMine(s)}>
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Save as mine
                      </ActionButton>
                      <ActionButton tone="danger" onClick={() => handleDeleteShared(s.id)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove shared
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'history' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50/85">
                Auto-save history is newest first and rolls off automatically after the recent entries.
              </div>
              {loading && <LoadingLine />}
              {!loading && history.length === 0 && (
                <EmptyState>No auto-save history yet. Make a queue change and the safety net starts filling in.</EmptyState>
              )}
              <ul className="scroll-nebula max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/15 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-pink-nebula-text">{new Date(h.savedAt).toLocaleString()}</div>
                      <SummaryLine summary={h.summary} />
                    </div>
                    <ActionButton
                      tone="primary"
                      className="sm:shrink-0"
                      onClick={() => {
                        onRestore(h.encoded, `Auto-save ${new Date(h.savedAt).toLocaleTimeString()}`, { shared: isSharedSummary(h.summary) });
                        onClose();
                      }}
                    >
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                      Restore
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'import' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/35 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-100/75">Open a file or pasted link</h3>
                <p className="mt-2 text-sm text-pink-nebula-muted">
                  Import a JSON save file, paste a shared URL, paste a #state fragment, or paste the raw encoded payload.
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-200/30 bg-cyan-300/10 px-4 py-5 text-sm font-bold text-cyan-50 transition-all hover:border-cyan-100/60 hover:bg-cyan-300/15">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                  Choose a Florent JSON file
                  <input
                    type="file"
                    accept=".florent.json,.json,application/json"
                    onChange={handleFileSelected}
                    className="sr-only"
                  />
                </label>
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                aria-label="Paste save or shared link"
                placeholder="Paste a Florent JSON save, shared URL, #state=..., or encoded payload here"
                className="h-44 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-xs text-pink-nebula-text outline-none transition-all placeholder:text-pink-nebula-muted/55 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/20"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionButton
                  tone="primary"
                  onClick={handleImportRestore}
                  disabled={!importText.trim()}
                  className="min-h-[46px]"
                >
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  Load now
                </ActionButton>
                <ActionButton
                  tone="success"
                  onClick={handleImportSaveAs}
                  disabled={!importText.trim()}
                  className="min-h-[46px]"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save as mine
                </ActionButton>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function asOwnedEncoded(encoded: string): string {
  return stripShareMetadataFromEncodedState(encoded);
}

function asOwnedSummary(summary: SaveSummary): SaveSummary {
  const owned = { ...summary };
  delete owned.shareName;
  delete owned.shareAuthor;
  return owned;
}

function isSharedSummary(summary: SaveSummary): boolean {
  return Boolean(summary.shareName || summary.shareAuthor);
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/25 ${
        active
          ? 'border-cyan-100/50 bg-cyan-300/20 text-cyan-50 shadow-lg shadow-cyan-500/15'
          : 'border-transparent text-pink-nebula-muted hover:border-white/10 hover:bg-white/[0.07] hover:text-pink-nebula-text'
      }`}
    >
      {children}
    </button>
  );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ActionTone;
}

function ActionButton({ tone = 'secondary', className = '', children, type = 'button', ...props }: ActionButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45 ${ACTION_TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

const ACTION_TONES: Record<ActionTone, string> = {
  primary: 'border-cyan-100/45 bg-cyan-300/20 text-cyan-50 shadow-lg shadow-cyan-500/10 hover:bg-cyan-300/30 focus:ring-cyan-300/30',
  secondary: 'border-white/10 bg-white/[0.07] text-pink-nebula-text hover:border-cyan-200/30 hover:bg-white/[0.11] focus:ring-cyan-300/20',
  success: 'border-emerald-200/35 bg-emerald-400/15 text-emerald-50 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400/25 focus:ring-emerald-300/25',
  warning: 'border-amber-200/35 bg-amber-400/15 text-amber-50 shadow-lg shadow-amber-500/10 hover:bg-amber-400/25 focus:ring-amber-300/25',
  danger: 'border-red-300/30 bg-red-500/15 text-red-100 hover:border-red-200/50 hover:bg-red-500/25 focus:ring-red-300/25',
  quiet: 'border-white/10 bg-white/[0.04] text-pink-nebula-muted hover:border-white/20 hover:bg-white/[0.08] hover:text-pink-nebula-text focus:ring-cyan-300/20',
};

function LoadingLine() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-pink-nebula-muted">
      Loading saves...
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] px-4 py-8 text-center text-sm text-pink-nebula-muted">
      {children}
    </div>
  );
}

function SummaryLine({ summary }: { summary: SaveSummary }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-pink-nebula-muted">
      <span>{summary.planetCount} planet{summary.planetCount === 1 ? '' : 's'}</span>
      <span>{summary.commandCount} command{summary.commandCount === 1 ? '' : 's'}</span>
      {summary.maxTurn > 0 && <span>Max T{summary.maxTurn}</span>}
      {summary.planetNames && <span className="break-all">{summary.planetNames}</span>}
      {summary.shareName && (
        <span className="basis-full text-sky-100/80">
          Shared list: {summary.shareName}{summary.shareAuthor ? ` by ${summary.shareAuthor}` : ''}
        </span>
      )}
    </div>
  );
}
