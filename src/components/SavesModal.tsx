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
import { Modal } from './ui/Modal';

type Tab = 'saves' | 'shared' | 'history' | 'import';
type ActionTone = 'primary' | 'secondary' | 'ghost' | 'danger';

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
    <Modal
      onClose={onClose}
      widthClass="max-w-3xl"
      icon={<Save className="h-5 w-5" aria-hidden="true" />}
      eyebrow="Build list"
      title="Saves"
      description="Named saves, shared links, history, and pasted files all live on this device."
    >
      <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 border-b border-filament bg-dust px-5 pb-4 pt-5">
        <div className="seg grid w-full grid-cols-2 sm:grid-cols-4">
          <TabButton active={tab === 'saves'} onClick={() => setTab('saves')} count={saves.length}>
            <Save aria-hidden="true" />
            Saves
          </TabButton>
          <TabButton active={tab === 'shared'} onClick={() => setTab('shared')} count={shared.length}>
            <Share2 aria-hidden="true" />
            Shared
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} count={history.length}>
            <History aria-hidden="true" />
            History
          </TabButton>
          <TabButton active={tab === 'import'} onClick={() => setTab('import')}>
            <FileUp aria-hidden="true" />
            Import
          </TabButton>
        </div>
      </div>

      {error && (
        <div role="alert" className="callout mb-4 border-l-danger">
          {error}
        </div>
      )}

      {tab === 'saves' && (
        <section className="space-y-4">
          <div className="well p-4">
            <label htmlFor="save-name" className="eyebrow block">
              Save current state as
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                id="save-name"
                type="text"
                value={newSaveName}
                onChange={(e) => setNewSaveName(e.target.value)}
                placeholder="Save name, e.g. Tech rush"
                className="field"
              />
              <ActionButton tone="primary" onClick={handleSaveCurrent}>
                <Save aria-hidden="true" />
                Save
              </ActionButton>
              <ActionButton onClick={handleExportCurrent} title="Download current state as a JSON file">
                <Download aria-hidden="true" />
                Export file
              </ActionButton>
            </div>
          </div>

          {loading && <LoadingLine />}
          {!loading && saves.length === 0 && (
            <EmptyState>No named saves yet. Save the current queue when you want a stable local checkpoint.</EmptyState>
          )}

          <ul className="space-y-2">
            {saves.map((s) => (
              <li key={s.id} className={ROW_CARD}>
                {renamingId === s.id ? (
                  <RenameRow
                    value={renameValue}
                    onChange={setRenameValue}
                    onSubmit={handleRename}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <SaveRow
                    save={s}
                    onLoad={() => { onRestore(s.encoded, s.name, { shared: false }); onClose(); }}
                    onExport={() => handleExportSave(s)}
                    onRename={() => { setRenamingId(s.id); setRenameValue(s.name); }}
                    onDelete={() => handleDelete(s.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'shared' && (
        <section className="space-y-4">
          <p className="text-sm text-ink-2">
            Shared lists are cached from opened links only. Saving one as mine creates a separate owned copy on this device.
          </p>
          {loading && <LoadingLine />}
          {!loading && shared.length === 0 && (
            <EmptyState>No shared lists opened yet. Open or paste a shared link and it will appear here.</EmptyState>
          )}
          <ul className="space-y-2">
            {shared.map((s) => (
              <li key={s.id} className={ROW_CARD}>
                <SharedRow
                  sharedList={s}
                  onOpen={() => { onRestore(s.encoded, s.name, { shared: true }); onClose(); }}
                  onSaveAsMine={() => handleSaveSharedAsMine(s)}
                  onRemove={() => handleDeleteShared(s.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'history' && (
        <section className="space-y-4">
          <p className="text-sm text-ink-2">
            Auto-save history is newest first and rolls off automatically after the recent entries.
          </p>
          {loading && <LoadingLine />}
          {!loading && history.length === 0 && (
            <EmptyState>No auto-save history yet. Make a queue change and the safety net starts filling in.</EmptyState>
          )}
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className={`${ROW_CARD} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">{new Date(h.savedAt).toLocaleString()}</div>
                  <SummaryLine summary={h.summary} />
                </div>
                <ActionButton
                  size="sm"
                  className="sm:shrink-0"
                  onClick={() => {
                    onRestore(h.encoded, `Auto-save ${new Date(h.savedAt).toLocaleTimeString()}`, { shared: isSharedSummary(h.summary) });
                    onClose();
                  }}
                >
                  <FolderOpen aria-hidden="true" />
                  Restore
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'import' && (
        <section className="space-y-4">
          <div className="well p-4">
            <h3 className="eyebrow">Open a file or pasted link</h3>
            <p className="mt-1 text-sm text-ink-2">
              Import a JSON save file, paste a shared URL, paste a #state fragment, or paste the raw encoded payload.
            </p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-panel border border-dashed border-edge px-4 py-5 text-sm font-semibold text-ink transition-colors hover:bg-veil focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-oiii">
              <Upload className="h-4 w-4 text-ink-2" aria-hidden="true" />
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
            className="field h-44 py-3 font-mono text-xs leading-5"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton tone="primary" onClick={handleImportRestore} disabled={!importText.trim()}>
              <FolderOpen aria-hidden="true" />
              Load now
            </ActionButton>
            <ActionButton onClick={handleImportSaveAs} disabled={!importText.trim()}>
              <Save aria-hidden="true" />
              Save as mine
            </ActionButton>
          </div>
        </section>
      )}
    </Modal>
  );
}

const ROW_CARD = 'rounded-panel border border-filament bg-veil p-4';

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

interface SaveRowProps {
  save: SaveRecord;
  onLoad: () => void;
  onExport: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function SaveRow({ save, onLoad, onExport, onRename, onDelete }: SaveRowProps) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="break-words text-[15px] font-semibold text-ink">{save.name}</div>
          <SummaryLine summary={save.summary} />
        </div>
        <span className="chip shrink-0 self-start">Updated {new Date(save.updatedAt).toLocaleString()}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton size="sm" onClick={onLoad}>
          <FolderOpen aria-hidden="true" />
          Load mine
        </ActionButton>
        <ActionButton size="sm" tone="ghost" onClick={onExport}>
          <Download aria-hidden="true" />
          Export file
        </ActionButton>
        <ActionButton size="sm" tone="ghost" onClick={onRename}>
          <Pencil aria-hidden="true" />
          Rename
        </ActionButton>
        <ActionButton size="sm" tone="danger" className="sm:ml-auto" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete save
        </ActionButton>
      </div>
    </>
  );
}

interface RenameRowProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function RenameRow({ value, onChange, onSubmit, onCancel }: RenameRowProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Save name"
        autoFocus
        className="field"
      />
      <ActionButton tone="primary" onClick={onSubmit}>
        Save name
      </ActionButton>
      <ActionButton tone="ghost" onClick={onCancel}>
        Cancel
      </ActionButton>
    </div>
  );
}

interface SharedRowProps {
  sharedList: SharedRecord;
  onOpen: () => void;
  onSaveAsMine: () => void;
  onRemove: () => void;
}

function SharedRow({ sharedList, onOpen, onSaveAsMine, onRemove }: SharedRowProps) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="break-words text-[15px] font-semibold text-ink">{sharedList.name}</div>
          <div className="mt-0.5 text-xs font-semibold text-ink-2">Shared by {sharedList.author}</div>
          <SummaryLine summary={sharedList.summary} />
        </div>
        <span className="chip shrink-0 self-start">Opened {formatOpenedTimestamp(sharedList.openedAt)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton size="sm" onClick={onOpen}>
          <FolderOpen aria-hidden="true" />
          Open shared
        </ActionButton>
        <ActionButton size="sm" tone="ghost" onClick={onSaveAsMine}>
          <Save aria-hidden="true" />
          Save as mine
        </ActionButton>
        <ActionButton size="sm" tone="danger" className="sm:ml-auto" onClick={onRemove}>
          <Trash2 aria-hidden="true" />
          Remove shared
        </ActionButton>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="seg-item">
      {children}
      {count !== undefined && count > 0 && <span className="text-ink-3">{count}</span>}
    </button>
  );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ActionTone;
  size?: 'md' | 'sm';
}

function ActionButton({ tone = 'secondary', size = 'md', className = '', children, type = 'button', ...props }: ActionButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={`btn ${ACTION_TONES[tone]} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

const ACTION_TONES: Record<ActionTone, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

function LoadingLine() {
  return (
    <div role="status" className="text-sm text-ink-2">
      Loading saves...
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-filament px-4 py-8 text-center text-sm text-ink-2">
      {children}
    </div>
  );
}

function SummaryLine({ summary }: { summary: SaveSummary }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
      <span>{summary.planetCount} planet{summary.planetCount === 1 ? '' : 's'}</span>
      <span>{summary.commandCount} command{summary.commandCount === 1 ? '' : 's'}</span>
      {summary.maxTurn > 0 && <span>Max T{summary.maxTurn}</span>}
      {summary.planetNames && <span className="break-all">{summary.planetNames}</span>}
      {summary.shareName && (
        <span className="basis-full text-ink-2">
          Shared list: {summary.shareName}{summary.shareAuthor ? ` by ${summary.shareAuthor}` : ''}
        </span>
      )}
    </div>
  );
}
