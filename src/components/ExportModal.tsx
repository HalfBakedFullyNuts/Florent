"use client";

import React, { useState } from 'react';
import {
  Braces,
  ClipboardList,
  Download,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Upload,
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
import { Modal } from './ui/Modal';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingLane: LaneView;
  shipLane: LaneView;
  colonistLane: LaneView;
  researchLane: LaneView;
  currentTurn: number;
  multiPlanetData?: MultiPlanetExportData;
  exportMode?: 'current' | 'full';
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
  multiPlanetData,
  exportMode,
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

  // Default end turn = last queued item across all lanes (so ships/colonists aren't cut off).
  const defaultEndTurn = computeDefaultEndTurn([buildingLane, shipLane, colonistLane, researchLane], multiPlanetData);
  const [exportStartTurn, setExportStartTurn] = useState(1);
  const [exportEndTurn, setExportEndTurn] = useState(defaultEndTurn);

  const rangeOpts = { minTurn: exportStartTurn, maxTurn: exportEndTurn };
  const rangeItemCount = countExportItems(activeTarget, laneViews, multiPlanetData, exportEndTurn, exportStartTurn);
  const targetLabel = activeTarget === 'all' ? 'All planets' : 'Selected planet';

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExportText = async () => {
    clearDiscordCopyState();
    setImageFallback(null);
    setJsonFallback(null);

    let text: string;
    let usedFullFallback = false;

    if (exportMode === 'current' && activeTarget !== 'all') {
      // Try current-turn only; if empty, fall back to full queue.
      text = formatAsText(laneViews, currentTurn, { minTurn: rangeOpts.minTurn });
      if (!text) {
        text = formatAsText(laneViews, rangeOpts.maxTurn, { minTurn: rangeOpts.minTurn });
        usedFullFallback = true;
      }
    } else {
      text = activeTarget === 'all' && multiPlanetData
        ? formatMultiPlanetAsText(multiPlanetData, rangeOpts.maxTurn, { minTurn: rangeOpts.minTurn })
        : formatAsText(laneViews, rangeOpts.maxTurn, { minTurn: rangeOpts.minTurn });
    }

    if (!text) {
      showNotification('Queue is empty - nothing to export');
      return;
    }

    const success = await copyToClipboard(text);
    if (success) {
      showNotification(usedFullFallback ? 'Copied full queue' : 'Copied to clipboard!');
    } else {
      showNotification('Failed to copy to clipboard');
    }
  };

  const handleExportDiscord = async () => {
    setImageFallback(null);
    setJsonFallback(null);
    const messages = activeTarget === 'all' && multiPlanetData
      ? formatMultiPlanetAsDiscordMessages(multiPlanetData, rangeOpts.maxTurn, { minTurn: rangeOpts.minTurn })
      : formatAsDiscordMessages(laneViews, rangeOpts.maxTurn, { minTurn: rangeOpts.minTurn });
    const firstMessage = messages[0] ?? '';

    if (rangeItemCount === 0) {
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
        showNotification('Copied to clipboard!');
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
    const json = activeTarget === 'all' && multiPlanetData
      ? formatMultiPlanetAsBuildDataJson(multiPlanetData, rangeOpts.maxTurn, {
          scope: 'full',
          currentTurn,
          minTurn: rangeOpts.minTurn,
        })
      : formatAsBuildDataJson(laneViews, rangeOpts.maxTurn, {
          scope: 'full',
          currentTurn,
          minTurn: rangeOpts.minTurn,
        });

    if (!json) {
      showNotification('Queue is empty - nothing to export');
      return;
    }

    const filename = `florent-build-list-${activeTarget}-t${exportStartTurn}-t${exportEndTurn}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    setJsonFallback({ blob, filename });

    const success = await copyToClipboard(json);
    showNotification(success ? 'Game JSON copied to clipboard!' : 'Clipboard blocked JSON copy. Use Download JSON instead.');
  };

  const handleExportImage = async () => {
    clearDiscordCopyState();
    setImageFallback(null);
    setJsonFallback(null);
    try {
      const items = activeTarget === 'all' && multiPlanetData
        ? extractMultiPlanetItems(multiPlanetData, rangeOpts.maxTurn, rangeOpts.minTurn)
        : extractQueueItems(laneViews, rangeOpts.maxTurn, { minTurn: rangeOpts.minTurn });

      if (items.length === 0) {
        showNotification('Queue is empty - nothing to export');
        return;
      }

      const imageOpts = { currentTurn, exportMode: 'full' as const, usedFullFallback: false };
      const canvas = activeTarget === 'all' && multiPlanetData
        ? createMultiPlanetBuildOrderImageCanvas(multiPlanetData, rangeOpts.maxTurn, imageOpts)
        : createBuildOrderImageCanvas(items, imageOpts);

      const blob = await canvasToPngBlob(canvas);
      if (!blob) {
        showNotification('Failed to generate image');
        return;
      }

      const filename = `build-order-${activeTarget}-t${exportStartTurn}-t${exportEndTurn}.png`;
      const copied = await copyImageToClipboard(blob, canvas.toDataURL('image/png'));
      setImageFallback({ blob, filename });
      showNotification(copied ? 'Image copied to clipboard!' : 'Browser blocked image clipboard. Use Download image instead.');
    } catch (error) {
      console.error('Image export error:', error);
      showNotification('Failed to export image');
    }
  };

  if (!isOpen) return null;

  const resetRange = () => {
    setExportStartTurn(1);
    setExportEndTurn(defaultEndTurn);
  };

  return (
    <Modal
      onClose={onClose}
      titleId="export-build-queue-title"
      widthClass="max-w-xl"
      icon={<Upload className="h-5 w-5" aria-hidden="true" />}
      eyebrow="Build list"
      title="Export build queue"
      description={
        <span className="mt-1 flex flex-wrap gap-2">
          <span className="chip">{targetLabel}</span>
          <span className="chip">{rangeItemCount} item{rangeItemCount === 1 ? '' : 's'}</span>
        </span>
      }
      footer={
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
      }
    >
      <div className="space-y-4">
        <ExportTurnRange
          startTurn={exportStartTurn}
          endTurn={exportEndTurn}
          onStartChange={(v) => {
            setExportStartTurn(v);
            if (v > exportEndTurn) setExportEndTurn(v);
          }}
          onEndChange={setExportEndTurn}
          onReset={resetRange}
        />

        {hasMultiPlanetTarget && (
          <ExportTargetSwitch active={activeTarget} onChange={setExportTarget} />
        )}

        <div className="grid gap-2">
          <ExportActionCard
            icon={<FileText aria-hidden="true" />}
            title="Export as plain text"
            description="Simple queue-turn list copied to clipboard."
            onClick={handleExportText}
          />

          <ExportActionCard
            icon={<MessageSquare aria-hidden="true" />}
            title="Export for Discord"
            description="Formatted table copied in 2,000-character chunks for non-Nitro users."
            onClick={handleExportDiscord}
          />

          {discordMessages.length > 1 && nextDiscordMessageIndex < discordMessages.length && (
            <ExportActionCard
              icon={<ClipboardList aria-hidden="true" />}
              title={`Copy Discord message ${nextDiscordMessageIndex + 1} of ${discordMessages.length}`}
              description="Paste the previous message in Discord first, then copy this next chunk."
              onClick={handleCopyNextDiscordMessage}
              followUp
            />
          )}

          {discordMessages.length > 1 && nextDiscordMessageIndex >= discordMessages.length && (
            <div className="callout border-l-res-food">
              All Discord chunks copied. Paste each copied message into Discord in order.
            </div>
          )}

          <ExportActionCard
            icon={<Braces aria-hidden="true" />}
            title="Export game JSON"
            description="Raw item ids, turns, lanes, and quantities only. No Florent save metadata."
            onClick={handleExportGameJson}
          />

          {jsonFallback && (
            <ExportActionCard
              icon={<Download aria-hidden="true" />}
              title="Download game JSON"
              description="Use this file if the actual game imports build-list JSON from disk."
              onClick={() => downloadBlob(jsonFallback.blob, jsonFallback.filename)}
              followUp
            />
          )}

          <ExportActionCard
            icon={<ImageIcon aria-hidden="true" />}
            title="Export as image"
            description="PNG copied to clipboard when the browser supports image clipboard writes."
            onClick={handleExportImage}
          />

          {imageFallback && (
            <ExportActionCard
              icon={<Download aria-hidden="true" />}
              title="Download image instead"
              description="Optional fallback if Discord or the browser refuses clipboard images."
              onClick={() => downloadBlob(imageFallback.blob, imageFallback.filename)}
              followUp
            />
          )}
        </div>

        {notification && (
          <div role="status" aria-live="polite" className="callout justify-center font-semibold">
            {notification}
          </div>
        )}
      </div>
    </Modal>
  );
}

interface ExportTurnRangeProps {
  startTurn: number;
  endTurn: number;
  onStartChange: (turn: number) => void;
  onEndChange: (turn: number) => void;
  onReset: () => void;
}

function ExportTurnRange({ startTurn, endTurn, onStartChange, onEndChange, onReset }: ExportTurnRangeProps) {
  return (
    <div className="well flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <span className="font-semibold text-ink-2">Turn range</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={endTurn}
          value={startTurn}
          aria-label="First turn"
          onChange={(e) => onStartChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="field field-sm w-20 text-center"
        />
        <span className="text-ink-3">to</span>
        <input
          type="number"
          min={startTurn}
          value={endTurn}
          aria-label="Last turn"
          onChange={(e) => onEndChange(Math.max(startTurn, parseInt(e.target.value) || startTurn))}
          className="field field-sm w-20 text-center"
        />
      </div>
      <button type="button" onClick={onReset} className="btn btn-ghost btn-sm ml-auto">
        Reset
      </button>
    </div>
  );
}

function ExportTargetSwitch({
  active,
  onChange,
}: {
  active: 'selected' | 'all';
  onChange: (target: 'selected' | 'all') => void;
}) {
  return (
    <div className="seg grid w-full grid-cols-2">
      <button type="button" aria-pressed={active === 'selected'} onClick={() => onChange('selected')} className="seg-item">
        Selected planet
      </button>
      <button type="button" aria-pressed={active === 'all'} onClick={() => onChange('all')} className="seg-item">
        All planets
      </button>
    </div>
  );
}

function ExportActionCard({
  icon,
  title,
  description,
  onClick,
  followUp = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  /** Secondary step that appears after an export (fallback download, next Discord chunk). */
  followUp?: boolean;
}) {
  const frame = followUp
    ? 'border-dashed border-edge bg-transparent hover:bg-veil'
    : 'border-filament bg-veil hover:border-edge hover:bg-veil-hi';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-panel border p-3 text-left transition-colors ${frame}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ctl border border-filament bg-dust text-ink-2 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-ink-2">{description}</span>
      </span>
    </button>
  );
}

function countExportItems(
  target: 'selected' | 'all',
  laneViews: LaneView[],
  multiPlanetData?: MultiPlanetExportData,
  maxTurn?: number,
  minTurn?: number,
): number {
  if (target === 'all' && multiPlanetData) {
    return extractMultiPlanetItems(multiPlanetData, maxTurn, minTurn).length;
  }
  return extractQueueItems(laneViews, maxTurn, { minTurn }).length;
}

function extractMultiPlanetItems(data: MultiPlanetExportData, maxTurn?: number, minTurn?: number): QueueItem[] {
  const planetItems = data.planets.flatMap((planet) => extractQueueItems(planet.lanes, maxTurn, { minTurn }));
  const researchItems = data.researchLane ? extractQueueItems([data.researchLane], maxTurn, { minTurn }) : [];
  return [...planetItems, ...researchItems].sort((a, b) => a.turn - b.turn);
}

function computeDefaultEndTurn(allLanes: LaneView[], multiPlanetData?: MultiPlanetExportData): number {
  const lanesToCheck: LaneView[] = multiPlanetData
    ? multiPlanetData.planets.flatMap(p => p.lanes)
    : allLanes;
  const items = extractQueueItems(lanesToCheck);
  const maxTurn = items.filter(i => !i.isWait).reduce((m, i) => Math.max(m, i.turn), 0);
  return maxTurn > 0 ? maxTurn : 1;
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
  exportMode: 'full' | 'current';
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

/** Emission palette for the exported PNG — mirrors the tokens in app/globals.css. */
const EXPORT_IMAGE_COLORS = {
  void: '#0E0A14',
  dust: '#18121F',
  dustAlt: '#1C1524',
  veil: '#221A2D',
  filament: '#342843',
  ink: '#EEE8F4',
  ink2: '#B8AEC8',
  ink3: '#9489A6',
  halpha: '#F2508C',
  halphaGlow: 'rgba(242, 80, 140, 0.16)',
  halphaLine: 'rgba(242, 80, 140, 0.35)',
} as const;

type ExportImageFontRole = 'title' | 'meta' | 'header' | 'body' | 'footer';

const EXPORT_IMAGE_FONT_SPECS: Record<ExportImageFontRole, string> = {
  title: '700 28px',
  meta: '500 14px',
  header: '700 13px',
  body: '600 15px',
  footer: 'italic 500 12px',
};

/** Canvas needs the concrete family name; next/font exposes it through the --font-sans variable. */
function exportImageFont(role: ExportImageFontRole): string {
  const family = typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  return `${EXPORT_IMAGE_FONT_SPECS[role]} ${family ? `${family}, ` : ''}system-ui, -apple-system, Segoe UI, sans-serif`;
}

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

  ctx.font = exportImageFont('body');
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

  ctx.font = exportImageFont('body');
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
    ctx.fillStyle = EXPORT_IMAGE_COLORS.ink;
    ctx.font = exportImageFont('header');
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
  ctx.font = exportImageFont('header');
  let widest = ctx.measureText(column.label.toUpperCase()).width;

  ctx.font = exportImageFont('body');
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
  ctx.font = exportImageFont('body');

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
  ctx.fillStyle = EXPORT_IMAGE_COLORS.void;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Same ambient H-alpha glow the app draws behind its header.
  const glowRadius = Math.max(canvasWidth, 420) * 0.6;
  const glow = ctx.createRadialGradient(canvasWidth * 0.08, 0, 0, canvasWidth * 0.08, 0, glowRadius);
  glow.addColorStop(0, EXPORT_IMAGE_COLORS.halphaGlow);
  glow.addColorStop(1, 'rgba(242, 80, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvasWidth, Math.min(canvasHeight, 420));

  ctx.fillStyle = EXPORT_IMAGE_COLORS.halpha;
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

  ctx.fillStyle = EXPORT_IMAGE_COLORS.ink;
  ctx.font = exportImageFont('title');
  ctx.textAlign = 'left';
  ctx.fillText(title, outerPadding, 30);

  ctx.fillStyle = EXPORT_IMAGE_COLORS.ink2;
  ctx.font = exportImageFont('meta');
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

  ctx.fillStyle = EXPORT_IMAGE_COLORS.dust;
  ctx.fillRect(metrics.x, metrics.y, metrics.width, metrics.height);

  ctx.fillStyle = EXPORT_IMAGE_COLORS.veil;
  ctx.fillRect(metrics.x, metrics.y, metrics.width, metrics.headerHeight);

  ctx.font = exportImageFont('header');
  ctx.fillStyle = EXPORT_IMAGE_COLORS.ink3;
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
    ctx.fillStyle = rowIndex % 2 === 0 ? EXPORT_IMAGE_COLORS.dust : EXPORT_IMAGE_COLORS.dustAlt;
    ctx.fillRect(metrics.x, rowY, metrics.width, rowLayout.height);

    ctx.fillStyle = EXPORT_IMAGE_COLORS.filament;
    ctx.fillRect(metrics.x, rowY, metrics.width, 1);

    ctx.font = exportImageFont('body');
    ctx.fillStyle = EXPORT_IMAGE_COLORS.ink;

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
        ctx.fillStyle = EXPORT_IMAGE_COLORS.filament;
        ctx.fillRect(cellX, rowY, 1, rowLayout.height);
        ctx.fillStyle = EXPORT_IMAGE_COLORS.ink;
      }

      cellX += columnWidth;
    });

    rowY += rowLayout.height;
  });

  ctx.restore();

  ctx.strokeStyle = EXPORT_IMAGE_COLORS.filament;
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

  ctx.fillStyle = EXPORT_IMAGE_COLORS.halphaLine;
  ctx.fillRect(outerPadding, footerY - 14, canvasWidth - outerPadding * 2, 1);

  ctx.fillStyle = EXPORT_IMAGE_COLORS.ink3;
  ctx.font = exportImageFont('footer');
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
