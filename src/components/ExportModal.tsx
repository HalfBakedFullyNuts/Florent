"use client";

import React, { useState } from 'react';
import {
  Braces,
  ClipboardList,
  Download,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  X,
} from 'lucide-react';
import type { LaneView } from '../lib/game/selectors';
import type { LaneId } from '../lib/sim/engine/types';
import {
  formatAsText,
  formatAsDiscordMessages,
  formatAsBuildDataJson,
  formatMultiPlanetAsText,
  formatMultiPlanetAsDiscordMessages,
  formatMultiPlanetAsBuildDataJson,
  copyToClipboard,
  extractQueueItems,
} from '../lib/export/formatters';
import type { MultiPlanetExportData, QueueItem } from '../lib/export/formatters';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingLane: LaneView;
  shipLane: LaneView;
  colonistLane: LaneView;
  researchLane: LaneView;
  currentTurn: number;
  exportMode: 'full' | 'current'; // full = all items, current = queue actions up to current turn
  multiPlanetData?: MultiPlanetExportData;
}

/**
 * ExportModal - Export build queue in various formats
 *
 * TICKET-5: Queue Export Functionality
 * Supports four export types:
 * - Plain Text: Simple list format
 * - Discord: Formatted table with character limit check
 * - Image: PNG rendered via canvas with watermark
 * - Game JSON: Build-only payload for game import
 */
export function ExportModal({
  isOpen,
  onClose,
  buildingLane,
  shipLane,
  colonistLane,
  researchLane,
  currentTurn,
  exportMode,
  multiPlanetData,
}: ExportModalProps) {
  const [notification, setNotification] = useState<string | null>(null);
  const [discordMessages, setDiscordMessages] = useState<string[]>([]);
  const [nextDiscordMessageIndex, setNextDiscordMessageIndex] = useState(0);
  const [imageFallback, setImageFallback] = useState<{ blob: Blob; filename: string } | null>(null);
  const [jsonFallback, setJsonFallback] = useState<{ blob: Blob; filename: string } | null>(null);
  const [exportTarget, setExportTarget] = useState<'selected' | 'all'>('selected');

  const laneViews = [buildingLane, shipLane, colonistLane, researchLane];
  const hasMultiPlanetTarget = Boolean(multiPlanetData && multiPlanetData.planets.length > 1);
  const activeTarget = hasMultiPlanetTarget ? exportTarget : 'selected';

  // Determine maxTurn based on export mode
  const maxTurn = exportMode === 'current' ? currentTurn : undefined;
  const scopedItemCount = countExportItems(activeTarget, laneViews, multiPlanetData, maxTurn);
  const totalItemCount = countExportItems(activeTarget, laneViews, multiPlanetData);
  const displayedItemCount = scopedItemCount > 0 || exportMode === 'full' ? scopedItemCount : totalItemCount;
  const scopeLabel = exportMode === 'current' ? 'Current view' : 'Full queue';
  const targetLabel = activeTarget === 'all' ? 'All planets' : 'Selected planet';
  const fallbackHint = exportMode === 'current' && scopedItemCount === 0 && totalItemCount > 0
    ? 'No queue actions at or before the current turn. Export falls back to the full queue.'
    : null;

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const resolveExportScope = () => {
    const scopedItems = countExportItems(activeTarget, laneViews, multiPlanetData, maxTurn);
    if (scopedItems > 0 || maxTurn === undefined) {
      return { effectiveMaxTurn: maxTurn, usedFullFallback: false };
    }

    const fullItems = countExportItems(activeTarget, laneViews, multiPlanetData);
    if (fullItems > 0) {
      return { effectiveMaxTurn: undefined, usedFullFallback: true };
    }

    return { effectiveMaxTurn: maxTurn, usedFullFallback: false };
  };

  const handleExportText = async () => {
    clearDiscordCopyState();
    setImageFallback(null);
    setJsonFallback(null);
    const { effectiveMaxTurn, usedFullFallback } = resolveExportScope();
    const text = activeTarget === 'all' && multiPlanetData
      ? formatMultiPlanetAsText(multiPlanetData, effectiveMaxTurn)
      : formatAsText(laneViews, effectiveMaxTurn);

    if (!text) {
      showNotification('Queue is empty - nothing to export');
      return;
    }

    const success = await copyToClipboard(text);
    if (success) {
      showNotification(usedFullFallback
        ? 'Copied full queue because no queue actions are due by this turn.'
        : 'Copied to clipboard!');
    } else {
      showNotification('Failed to copy to clipboard');
    }
  };

  const handleExportDiscord = async () => {
    setImageFallback(null);
    setJsonFallback(null);
    const { effectiveMaxTurn, usedFullFallback } = resolveExportScope();
    const messages = activeTarget === 'all' && multiPlanetData
      ? formatMultiPlanetAsDiscordMessages(multiPlanetData, effectiveMaxTurn)
      : formatAsDiscordMessages(laneViews, effectiveMaxTurn);
    const firstMessage = messages[0] ?? '';

    if (countExportItems(activeTarget, laneViews, multiPlanetData, effectiveMaxTurn) === 0) {
      showNotification('Queue is empty - nothing to export');
      return;
    }

    const success = await copyToClipboard(firstMessage);
    if (success) {
      setDiscordMessages(messages);
      setNextDiscordMessageIndex(messages.length > 1 ? 1 : 0);
      if (messages.length > 1) {
        showNotification(`Copied Discord message 1 of ${messages.length}. Paste it, then copy the next one.`);
      } else {
        showNotification(usedFullFallback
          ? 'Copied full queue because no queue actions are due by this turn.'
          : 'Copied to clipboard!');
      }
    } else {
      showNotification('Failed to copy to clipboard');
    }
  };

  const handleCopyNextDiscordMessage = async () => {
    const message = discordMessages[nextDiscordMessageIndex];
    if (!message) return;

    const success = await copyToClipboard(message);
    if (success) {
      const copiedNumber = nextDiscordMessageIndex + 1;
      setNextDiscordMessageIndex(nextDiscordMessageIndex + 1);
      showNotification(`Copied Discord message ${copiedNumber} of ${discordMessages.length}`);
    } else {
      showNotification('Failed to copy to clipboard');
    }
  };

  const clearDiscordCopyState = () => {
    setDiscordMessages([]);
    setNextDiscordMessageIndex(0);
  };

  const handleExportGameJson = async () => {
    clearDiscordCopyState();
    setImageFallback(null);
    setJsonFallback(null);
    const { effectiveMaxTurn, usedFullFallback } = resolveExportScope();
    const jsonScope = usedFullFallback || effectiveMaxTurn === undefined ? 'full' : exportMode;
    const json = activeTarget === 'all' && multiPlanetData
      ? formatMultiPlanetAsBuildDataJson(multiPlanetData, effectiveMaxTurn, {
          scope: jsonScope,
          currentTurn,
        })
      : formatAsBuildDataJson(laneViews, effectiveMaxTurn, {
          scope: jsonScope,
          currentTurn,
        });

    if (!json) {
      showNotification('Queue is empty - nothing to export');
      return;
    }

    const filename = `florent-build-list-${activeTarget}-${jsonScope}-t${currentTurn}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    setJsonFallback({ blob, filename });

    const success = await copyToClipboard(json);
    if (success) {
      showNotification(usedFullFallback
        ? 'Copied full build JSON because no queue actions are due by this turn.'
        : 'Game JSON copied to clipboard!');
    } else {
      showNotification('Clipboard blocked JSON copy. Use Download JSON instead.');
    }
  };

  const handleExportImage = async () => {
    clearDiscordCopyState();
    setImageFallback(null);
    setJsonFallback(null);
    try {
      const { effectiveMaxTurn, usedFullFallback } = resolveExportScope();
      const items = activeTarget === 'all' && multiPlanetData
        ? extractMultiPlanetItems(multiPlanetData, effectiveMaxTurn)
        : extractQueueItems(laneViews, effectiveMaxTurn);

      if (items.length === 0) {
        showNotification('Queue is empty - nothing to export');
        return;
      }

      const canvas = activeTarget === 'all' && multiPlanetData
        ? createMultiPlanetBuildOrderImageCanvas(multiPlanetData, effectiveMaxTurn, {
            currentTurn,
            exportMode,
            usedFullFallback,
          })
        : createBuildOrderImageCanvas(items, {
            currentTurn,
            exportMode,
            usedFullFallback,
          });

      const blob = await canvasToPngBlob(canvas);
      if (!blob) {
        showNotification('Failed to generate image');
        return;
      }

      const filename = `build-order-${activeTarget}-turn-${currentTurn}.png`;
      const copied = await copyImageToClipboard(blob, canvas.toDataURL('image/png'));
      setImageFallback({ blob, filename });
      if (copied) {
        showNotification(usedFullFallback
          ? 'Copied full queue image because no queue actions are due by this turn.'
          : 'Image copied to clipboard!');
      } else {
        showNotification('Browser blocked image clipboard. Use Download image instead.');
      }
    } catch (error) {
      console.error('Image export error:', error);
      showNotification('Failed to export image');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-build-queue-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#24142d]/95 via-[#171024]/95 to-[#0d1b2f]/95 shadow-2xl shadow-black/60 ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">Export vault</div>
            <h2 id="export-build-queue-title" className="mt-1 text-2xl font-black text-pink-nebula-text">
              Export Build Queue
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-pink-nebula-muted">
              <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-cyan-50">
                {scopeLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {targetLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Current turn {currentTurn}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {displayedItemCount} item{displayedItemCount === 1 ? '' : 's'}
              </span>
            </div>
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

        <div className="space-y-4 px-5 py-5 md:px-6">
          {fallbackHint && (
            <div className="rounded-2xl border border-amber-200/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50/85">
              {fallbackHint}
            </div>
          )}

          {hasMultiPlanetTarget && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setExportTarget('selected')}
                  className={exportTargetButtonClass(activeTarget === 'selected')}
                >
                  Selected planet
                </button>
                <button
                  type="button"
                  onClick={() => setExportTarget('all')}
                  className={exportTargetButtonClass(activeTarget === 'all')}
                >
                  All planets
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <ExportActionCard
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title="Export as Plain Text"
              description="Simple queue-turn list copied to clipboard."
              onClick={handleExportText}
            />

            <ExportActionCard
              icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
              title="Export for Discord"
              description="Formatted table copied in 2,000-character chunks for non-Nitro users."
              onClick={handleExportDiscord}
            />

            <ExportActionCard
              icon={<Braces className="h-5 w-5" aria-hidden="true" />}
              title="Export game JSON"
              description="Raw item ids, turns, lanes, and quantities only. No Florent save metadata."
              onClick={handleExportGameJson}
              tone="purple"
            />

            {jsonFallback && (
              <ExportActionCard
                icon={<Download className="h-5 w-5" aria-hidden="true" />}
                title="Download game JSON"
                description="Use this file if the actual game imports build-list JSON from disk."
                onClick={() => downloadBlob(jsonFallback.blob, jsonFallback.filename)}
                tone="amber"
              />
            )}

            {discordMessages.length > 1 && nextDiscordMessageIndex < discordMessages.length && (
              <ExportActionCard
                icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
                title={`Copy Discord message ${nextDiscordMessageIndex + 1} of ${discordMessages.length}`}
                description="Paste the previous message in Discord first, then copy this next chunk."
                onClick={handleCopyNextDiscordMessage}
                tone="purple"
              />
            )}

            {discordMessages.length > 1 && nextDiscordMessageIndex >= discordMessages.length && (
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                All Discord chunks copied. Paste each copied message into Discord in order.
              </div>
            )}

            <ExportActionCard
              icon={<ImageIcon className="h-5 w-5" aria-hidden="true" />}
              title="Export as Image"
              description="PNG copied to clipboard when the browser supports image clipboard writes."
              onClick={handleExportImage}
            />

            {imageFallback && (
              <ExportActionCard
                icon={<Download className="h-5 w-5" aria-hidden="true" />}
                title="Download image instead"
                description="Optional fallback if Discord or the browser refuses clipboard images."
                onClick={() => downloadBlob(imageFallback.blob, imageFallback.filename)}
                tone="amber"
              />
            )}
          </div>

          {notification && (
            <div className="rounded-2xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-3 text-center text-sm font-semibold text-cyan-50 animate-fade-in">
              {notification}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-pink-nebula-muted transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportActionCard({
  icon,
  title,
  description,
  onClick,
  tone = 'cyan',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  tone?: 'cyan' | 'purple' | 'amber';
}) {
  const toneClass = tone === 'purple'
    ? 'border-violet-200/30 bg-violet-400/10 text-violet-50 hover:border-violet-100/55 hover:bg-violet-400/15'
    : tone === 'amber'
      ? 'border-amber-200/30 bg-amber-400/10 text-amber-50 hover:border-amber-100/55 hover:bg-amber-400/15'
      : 'border-cyan-200/25 bg-white/[0.055] text-cyan-50 hover:border-cyan-100/55 hover:bg-cyan-300/10';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-lg shadow-black/15 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-300/25 ${toneClass}`}
    >
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/35 shadow-inner shadow-black/20">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black text-pink-nebula-text">{title}</span>
        <span className="mt-1 block text-sm text-pink-nebula-muted">{description}</span>
      </span>
    </button>
  );
}

function exportTargetButtonClass(active: boolean): string {
  const base = 'min-h-[40px] rounded-xl px-3 py-2 text-sm font-black transition-all focus:outline-none focus:ring-2 focus:ring-cyan-300/25';
  if (active) {
    return `${base} border border-cyan-200/45 bg-cyan-300/18 text-cyan-50 shadow-lg shadow-cyan-500/10`;
  }
  return `${base} text-pink-nebula-muted hover:bg-white/[0.06] hover:text-pink-nebula-text`;
}

function countExportItems(
  target: 'selected' | 'all',
  laneViews: LaneView[],
  multiPlanetData?: MultiPlanetExportData,
  maxTurn?: number,
): number {
  if (target === 'all' && multiPlanetData) {
    return extractMultiPlanetItems(multiPlanetData, maxTurn).length;
  }
  return extractQueueItems(laneViews, maxTurn).length;
}

function extractMultiPlanetItems(data: MultiPlanetExportData, maxTurn?: number): QueueItem[] {
  const planetItems = data.planets.flatMap((planet) => extractQueueItems(planet.lanes, maxTurn));
  const researchItems = data.researchLane ? extractQueueItems([data.researchLane], maxTurn) : [];
  return [...planetItems, ...researchItems].sort((a, b) => a.turn - b.turn);
}

type ExportImageColumnKey = 'turn' | LaneId;

interface ExportImageColumn {
  key: ExportImageColumnKey;
  label: string;
  minWidth: number;
  maxWidth: number;
  align?: CanvasTextAlign;
}

interface ExportImageRow {
  turn: number;
  cells: Record<LaneId, string>;
}

interface ExportImageOptions {
  currentTurn: number;
  exportMode: ExportModalProps['exportMode'];
  usedFullFallback: boolean;
}

interface ExportImageRowLayout {
  row: ExportImageRow;
  lines: Record<ExportImageColumnKey, string[]>;
  height: number;
}

const EXPORT_IMAGE_COLUMNS: ExportImageColumn[] = [
  { key: 'turn', label: 'Start', minWidth: 78, maxWidth: 92, align: 'center' },
  { key: 'building', label: 'Structure', minWidth: 190, maxWidth: 320 },
  { key: 'ship', label: 'Ship', minWidth: 150, maxWidth: 260 },
  { key: 'colonist', label: 'Colonist', minWidth: 150, maxWidth: 260 },
  { key: 'research', label: 'Research', minWidth: 190, maxWidth: 320 },
];

const EXPORT_IMAGE_TITLE_FONT = '700 28px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const EXPORT_IMAGE_META_FONT = '500 14px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const EXPORT_IMAGE_HEADER_FONT = '700 13px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const EXPORT_IMAGE_BODY_FONT = '500 15px Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const EXPORT_IMAGE_FOOTER_FONT = 'italic 12px Inter, system-ui, -apple-system, Segoe UI, sans-serif';

export function createBuildOrderImageCanvas(items: QueueItem[], options: ExportImageOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas rendering is not available');
  }

  const rows = buildExportImageRows(items);
  const outerPadding = 32;
  const tableCellPaddingX = 14;
  const tableCellPaddingY = 12;
  const tableHeaderHeight = 40;
  const bodyLineHeight = 19;
  const footerHeight = 42;

  ctx.font = EXPORT_IMAGE_BODY_FONT;
  const columnWidths = EXPORT_IMAGE_COLUMNS.map((column) => measureExportImageColumn(
    ctx,
    column,
    rows,
    tableCellPaddingX,
  ));
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);
  const canvasWidth = tableWidth + outerPadding * 2;

  const rowLayouts = rows.map((row) => layoutExportImageRow(
    ctx,
    row,
    columnWidths,
    tableCellPaddingX,
    tableCellPaddingY,
    bodyLineHeight,
  ));
  const tableHeight = tableHeaderHeight + rowLayouts.reduce((total, row) => total + row.height, 0);
  const tableY = 104;
  const canvasHeight = tableY + tableHeight + footerHeight;
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  canvas.width = Math.ceil(canvasWidth * pixelRatio);
  canvas.height = Math.ceil(canvasHeight * pixelRatio);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  ctx.scale(pixelRatio, pixelRatio);
  ctx.textBaseline = 'top';

  renderExportImageBackground(ctx, canvasWidth, canvasHeight);
  renderExportImageHeader(ctx, options, items.length, outerPadding);
  renderExportImageTable(ctx, rowLayouts, columnWidths, {
    x: outerPadding,
    y: tableY,
    width: tableWidth,
    height: tableHeight,
    headerHeight: tableHeaderHeight,
    cellPaddingX: tableCellPaddingX,
    cellPaddingY: tableCellPaddingY,
    bodyLineHeight,
  });
  renderExportImageFooter(ctx, canvasWidth, canvasHeight, outerPadding);

  return canvas;
}

export function createMultiPlanetBuildOrderImageCanvas(
  data: MultiPlanetExportData,
  maxTurn: number | undefined,
  options: ExportImageOptions,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas rendering is not available');
  }

  const sections = [
    ...data.planets.map((planet) => ({
      title: `${planet.name} (starts T${planet.startTurn})`,
      items: extractQueueItems(planet.lanes, maxTurn),
    })),
    {
      title: 'Global Research',
      items: data.researchLane ? extractQueueItems([data.researchLane], maxTurn) : [],
    },
  ].filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return createBuildOrderImageCanvas([], options);
  }

  const outerPadding = 32;
  const tableCellPaddingX = 14;
  const tableCellPaddingY = 12;
  const tableHeaderHeight = 40;
  const bodyLineHeight = 19;
  const sectionTitleHeight = 34;
  const sectionGap = 24;
  const footerHeight = 42;
  const tableY = 104;

  ctx.font = EXPORT_IMAGE_BODY_FONT;
  const allRows = sections.flatMap((section) => buildExportImageRows(section.items));
  const columnWidths = EXPORT_IMAGE_COLUMNS.map((column) => measureExportImageColumn(
    ctx,
    column,
    allRows,
    tableCellPaddingX,
  ));
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);
  const canvasWidth = tableWidth + outerPadding * 2;

  const sectionLayouts = sections.map((section) => {
    const rows = buildExportImageRows(section.items);
    const rowLayouts = rows.map((row) => layoutExportImageRow(
      ctx,
      row,
      columnWidths,
      tableCellPaddingX,
      tableCellPaddingY,
      bodyLineHeight,
    ));
    const tableHeight = tableHeaderHeight + rowLayouts.reduce((total, row) => total + row.height, 0);
    return { ...section, rowLayouts, tableHeight };
  });

  const contentHeight = sectionLayouts.reduce((total, section, index) => (
    total + sectionTitleHeight + section.tableHeight + (index < sectionLayouts.length - 1 ? sectionGap : 0)
  ), 0);
  const canvasHeight = tableY + contentHeight + footerHeight;
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  canvas.width = Math.ceil(canvasWidth * pixelRatio);
  canvas.height = Math.ceil(canvasHeight * pixelRatio);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  ctx.scale(pixelRatio, pixelRatio);
  ctx.textBaseline = 'top';

  renderExportImageBackground(ctx, canvasWidth, canvasHeight);
  renderExportImageHeader(ctx, options, extractMultiPlanetItems(data, maxTurn).length, outerPadding, 'Multi-Planet Build Order');

  let y = tableY;
  sectionLayouts.forEach((section, index) => {
    ctx.fillStyle = '#f0e7ff';
    ctx.font = EXPORT_IMAGE_HEADER_FONT;
    ctx.textAlign = 'left';
    ctx.fillText(section.title, outerPadding, y);
    y += sectionTitleHeight;

    renderExportImageTable(ctx, section.rowLayouts, columnWidths, {
      x: outerPadding,
      y,
      width: tableWidth,
      height: section.tableHeight,
      headerHeight: tableHeaderHeight,
      cellPaddingX: tableCellPaddingX,
      cellPaddingY: tableCellPaddingY,
      bodyLineHeight,
    });

    y += section.tableHeight + (index < sectionLayouts.length - 1 ? sectionGap : 0);
  });

  renderExportImageFooter(ctx, canvasWidth, canvasHeight, outerPadding);

  return canvas;
}

function buildExportImageRows(items: QueueItem[]): ExportImageRow[] {
  const rowByTurn = new Map<number, ExportImageRow>();

  items.forEach((item) => {
    const existing = rowByTurn.get(item.turn);
    const row = existing ?? {
      turn: item.turn,
      cells: createEmptyExportImageCells(),
    };
    row.cells[item.lane] = appendExportImageCell(row.cells[item.lane], formatExportImageItem(item));
    rowByTurn.set(item.turn, row);
  });

  return Array.from(rowByTurn.values()).sort((a, b) => a.turn - b.turn);
}

function createEmptyExportImageCells(): Record<LaneId, string> {
  return {
    building: '',
    ship: '',
    colonist: '',
    research: '',
  };
}

function appendExportImageCell(current: string, value: string): string {
  return current ? `${current}, ${value}` : value;
}

function formatExportImageItem(item: QueueItem): string {
  if (item.isWait || item.itemId === '__wait__') {
    return `Wait ${item.waitTurns ?? '?'}T`;
  }

  if (item.lane === 'building' || item.lane === 'research') {
    return item.name;
  }

  return `${item.quantity}x ${item.name}`;
}

function measureExportImageColumn(
  ctx: CanvasRenderingContext2D,
  column: ExportImageColumn,
  rows: ExportImageRow[],
  cellPaddingX: number,
): number {
  ctx.font = EXPORT_IMAGE_HEADER_FONT;
  let widest = ctx.measureText(column.label.toUpperCase()).width;

  ctx.font = EXPORT_IMAGE_BODY_FONT;
  rows.forEach((row) => {
    widest = Math.max(widest, ctx.measureText(getExportImageCellText(row, column.key)).width);
  });

  return clamp(Math.ceil(widest + cellPaddingX * 2), column.minWidth, column.maxWidth);
}

function layoutExportImageRow(
  ctx: CanvasRenderingContext2D,
  row: ExportImageRow,
  columnWidths: number[],
  cellPaddingX: number,
  cellPaddingY: number,
  bodyLineHeight: number,
): ExportImageRowLayout {
  ctx.font = EXPORT_IMAGE_BODY_FONT;

  const lines = {} as Record<ExportImageColumnKey, string[]>;
  let maxLines = 1;

  EXPORT_IMAGE_COLUMNS.forEach((column, index) => {
    const text = getExportImageCellText(row, column.key);
    const wrappedLines = wrapCanvasText(ctx, text, columnWidths[index] - cellPaddingX * 2);
    lines[column.key] = wrappedLines;
    maxLines = Math.max(maxLines, wrappedLines.length);
  });

  return {
    row,
    lines,
    height: Math.max(44, maxLines * bodyLineHeight + cellPaddingY * 2),
  };
}

function getExportImageCellText(row: ExportImageRow, key: ExportImageColumnKey): string {
  return key === 'turn' ? String(row.turn) : row.cells[key];
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (ctx.measureText(word).width <= maxWidth) {
      currentLine = word;
      return;
    }

    const brokenWord = breakCanvasWord(ctx, word, maxWidth);
    lines.push(...brokenWord.slice(0, -1));
    currentLine = brokenWord[brokenWord.length - 1] ?? '';
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function breakCanvasWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';

  Array.from(word).forEach((character) => {
    const candidate = `${currentLine}${character}`;
    if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = character;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function renderExportImageBackground(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const background = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  background.addColorStop(0, '#120c18');
  background.addColorStop(0.52, '#171321');
  background.addColorStop(1, '#102031');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = 'rgba(125, 211, 252, 0.7)';
  ctx.fillRect(0, 0, canvasWidth, 3);
}

function renderExportImageHeader(
  ctx: CanvasRenderingContext2D,
  options: ExportImageOptions,
  itemCount: number,
  outerPadding: number,
  title = 'Build Order',
): void {
  const scope = options.usedFullFallback
    ? 'Full queue fallback'
    : options.exportMode === 'current'
      ? 'Current view'
      : 'Full queue';
  const entryLabel = itemCount === 1 ? 'entry' : 'entries';

  ctx.fillStyle = '#f0e7ff';
  ctx.font = EXPORT_IMAGE_TITLE_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(title, outerPadding, 30);

  ctx.fillStyle = '#b7c7da';
  ctx.font = EXPORT_IMAGE_META_FONT;
  ctx.fillText(`${scope} | Current turn ${options.currentTurn} | ${itemCount} ${entryLabel}`, outerPadding, 68);
}

interface ExportImageTableMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  headerHeight: number;
  cellPaddingX: number;
  cellPaddingY: number;
  bodyLineHeight: number;
}

function renderExportImageTable(
  ctx: CanvasRenderingContext2D,
  rowLayouts: ExportImageRowLayout[],
  columnWidths: number[],
  metrics: ExportImageTableMetrics,
): void {
  const tableRadius = 8;

  ctx.save();
  createRoundedRectPath(ctx, metrics.x, metrics.y, metrics.width, metrics.height, tableRadius);
  ctx.clip();

  ctx.fillStyle = '#17111f';
  ctx.fillRect(metrics.x, metrics.y, metrics.width, metrics.height);

  ctx.fillStyle = '#261d35';
  ctx.fillRect(metrics.x, metrics.y, metrics.width, metrics.headerHeight);

  ctx.font = EXPORT_IMAGE_HEADER_FONT;
  ctx.fillStyle = '#8fe4ff';
  ctx.textAlign = 'left';

  let x = metrics.x;
  EXPORT_IMAGE_COLUMNS.forEach((column, index) => {
    const columnWidth = columnWidths[index];
    const labelX = column.align === 'center'
      ? x + columnWidth / 2
      : x + metrics.cellPaddingX;

    ctx.textAlign = column.align ?? 'left';
    ctx.fillText(column.label.toUpperCase(), labelX, metrics.y + 13);
    x += columnWidth;
  });

  let rowY = metrics.y + metrics.headerHeight;
  rowLayouts.forEach((rowLayout, rowIndex) => {
    ctx.fillStyle = rowIndex % 2 === 0 ? '#17111f' : '#1d1728';
    ctx.fillRect(metrics.x, rowY, metrics.width, rowLayout.height);

    ctx.fillStyle = '#403451';
    ctx.fillRect(metrics.x, rowY, metrics.width, 1);

    ctx.font = EXPORT_IMAGE_BODY_FONT;
    ctx.fillStyle = '#e8ddff';

    let cellX = metrics.x;
    EXPORT_IMAGE_COLUMNS.forEach((column, columnIndex) => {
      const columnWidth = columnWidths[columnIndex];
      const lines = rowLayout.lines[column.key];
      const textX = column.align === 'center'
        ? cellX + columnWidth / 2
        : cellX + metrics.cellPaddingX;

      ctx.textAlign = column.align ?? 'left';
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, textX, rowY + metrics.cellPaddingY + lineIndex * metrics.bodyLineHeight);
      });

      if (columnIndex > 0) {
        ctx.fillStyle = '#332941';
        ctx.fillRect(cellX, rowY, 1, rowLayout.height);
        ctx.fillStyle = '#e8ddff';
      }

      cellX += columnWidth;
    });

    rowY += rowLayout.height;
  });

  ctx.restore();

  ctx.strokeStyle = '#4c3b62';
  ctx.lineWidth = 1;
  createRoundedRectPath(ctx, metrics.x, metrics.y, metrics.width, metrics.height, tableRadius);
  ctx.stroke();
}

function renderExportImageFooter(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  outerPadding: number,
): void {
  const footerY = canvasHeight - 28;

  ctx.fillStyle = 'rgba(143, 228, 255, 0.28)';
  ctx.fillRect(outerPadding, footerY - 14, canvasWidth - outerPadding * 2, 1);

  ctx.fillStyle = '#9d8ec2';
  ctx.font = EXPORT_IMAGE_FOOTER_FONT;
  ctx.textAlign = 'left';
  ctx.fillText('Infinite Conflict Build Planner', outerPadding, footerY);
}

function createRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function copyImageToClipboard(blob: Blob, dataUrl?: string): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false;
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch (firstError) {
    if (!dataUrl) {
      console.warn('Failed to copy image to clipboard:', firstError);
      return false;
    }
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
        'text/html': new Blob([`<img src="${dataUrl}" alt="Infinite Conflict build order">`], { type: 'text/html' }),
      }),
    ]);
    return true;
  } catch (error) {
    console.warn('Failed to copy rich image clipboard payload:', error);
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
