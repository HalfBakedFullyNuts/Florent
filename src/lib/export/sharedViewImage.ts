/**
 * PNG export of the shared build-list view: header (name, author, planet), summary facts,
 * the four lanes side by side and a footer carrying the share link. Layout is computed by a
 * pure function (testable without a canvas); rendering draws that layout at 2× scale.
 */

import { EXPORT_IMAGE_COLORS as C, exportImageFont, type ExportImageFontRole } from './imageTheme';
import type { SharedViewLane, SharedViewRow } from './sharedViewModel';

export const IMAGE_WIDTH = 1200;
export const IMAGE_SCALE = 2;

const PAD = 32;
const LANE_GAP = 12;
const HEADER_HEIGHT = 104;
const FACT_HEIGHT = 52;
const FACT_GAP = 8;
const FACT_COLUMNS = 3;
const LANE_HEAD = 38;
const ROW_HEIGHT = 30;
const REASON_HEIGHT = 16;
const EMPTY_LANE = 40;
const URL_LINE = 15;
const FOOTER_TOP = 18;

export interface SharedViewImageInput {
  name: string;
  author?: string;
  /** e.g. "Homeworld · P1 of 3" — shown when the share has several planets. */
  planetLabel?: string;
  facts: Array<{ label: string; value: string }>;
  lanes: SharedViewLane[];
  shareUrl?: string;
}

export type MeasureText = (text: string, role: ExportImageFontRole) => number;

export interface SharedViewImageLayout {
  width: number;
  height: number;
  contentWidth: number;
  laneWidth: number;
  rowHeight: number;
  title: string;
  meta: string;
  factRows: number;
  factsTop: number;
  lanesTop: number;
  lanesHeight: number;
  footerTop: number;
  urlLines: string[];
}

export function layoutSharedViewImage(input: SharedViewImageInput, measure: MeasureText): SharedViewImageLayout {
  const contentWidth = IMAGE_WIDTH - PAD * 2;
  const laneWidth = (contentWidth - LANE_GAP * 3) / 4;
  const factRows = Math.ceil(input.facts.length / FACT_COLUMNS);
  const factsTop = PAD + HEADER_HEIGHT;
  const factsHeight = factRows > 0 ? factRows * FACT_HEIGHT + (factRows - 1) * FACT_GAP + 20 : 0;
  const lanesTop = factsTop + factsHeight;
  const lanesHeight = LANE_HEAD + Math.max(EMPTY_LANE, ...input.lanes.map(rowsHeight));
  const footerTop = lanesTop + lanesHeight + FOOTER_TOP;
  const urlLines = input.shareUrl ? wrapByCharacters(input.shareUrl, contentWidth, (text) => measure(text, 'small')) : [];
  const itemCount = input.lanes.reduce((sum, lane) => sum + lane.rows.length, 0);
  const author = input.author?.trim();

  return {
    width: IMAGE_WIDTH,
    height: footerTop + 18 + urlLines.length * URL_LINE + PAD,
    contentWidth,
    laneWidth,
    rowHeight: ROW_HEIGHT,
    title: input.name.trim() || 'Untitled build list',
    meta: [author ? `by ${author}` : '', `${itemCount} queued item${itemCount === 1 ? '' : 's'}`, input.planetLabel ?? '']
      .filter(Boolean)
      .join('  ·  '),
    factRows,
    factsTop,
    lanesTop,
    lanesHeight,
    footerTop,
    urlLines,
  };
}

function rowsHeight(lane: SharedViewLane): number {
  return lane.rows.reduce((sum, row) => sum + rowHeightOf(row), 0);
}

function rowHeightOf(row: SharedViewRow): number {
  return ROW_HEIGHT + (row.invalid && row.invalidReason ? REASON_HEIGHT : 0);
}

/** Splits text into lines no wider than maxWidth; links have no spaces, so break anywhere. */
function wrapByCharacters(text: string, maxWidth: number, width: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (line && width(line + char) > maxWidth) {
      lines.push(line);
      line = '';
    }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
}

export function truncateToWidth(text: string, maxWidth: number, width: (text: string) => number): string {
  if (width(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && width(`${text.slice(0, end)}…`) > maxWidth) end--;
  return `${text.slice(0, end)}…`;
}

export function renderSharedViewImage(input: SharedViewImageInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const measure: MeasureText = (text, role) => {
    ctx.font = exportImageFont(role);
    return ctx.measureText(text).width;
  };
  const layout = layoutSharedViewImage(input, measure);
  canvas.width = layout.width * IMAGE_SCALE;
  canvas.height = layout.height * IMAGE_SCALE;
  ctx.scale(IMAGE_SCALE, IMAGE_SCALE);
  ctx.textBaseline = 'top';

  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, layout.width, layout.height);
  drawHeader(ctx, layout);
  drawFacts(ctx, input, layout, measure);
  input.lanes.forEach((lane, index) => drawLane(ctx, lane, PAD + index * (layout.laneWidth + LANE_GAP), layout, measure));
  drawFooter(ctx, layout);
  return canvas;
}

type Ctx = CanvasRenderingContext2D;

function text(ctx: Ctx, value: string, x: number, y: number, role: ExportImageFontRole, color: string, align: CanvasTextAlign = 'left'): void {
  ctx.font = exportImageFont(role);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function drawHeader(ctx: Ctx, layout: SharedViewImageLayout): void {
  text(ctx, 'SHARED BUILD LIST', PAD, PAD, 'label', C.halpha);
  text(ctx, layout.title, PAD, PAD + 20, 'title', C.ink);
  text(ctx, layout.meta, PAD, PAD + 60, 'meta', C.ink2);
  ctx.fillStyle = C.filament;
  ctx.fillRect(PAD, PAD + HEADER_HEIGHT - 16, layout.contentWidth, 1);
}

function drawFacts(ctx: Ctx, input: SharedViewImageInput, layout: SharedViewImageLayout, measure: MeasureText): void {
  const factWidth = (layout.contentWidth - FACT_GAP * (FACT_COLUMNS - 1)) / FACT_COLUMNS;
  input.facts.forEach((fact, index) => {
    const x = PAD + (index % FACT_COLUMNS) * (factWidth + FACT_GAP);
    const y = layout.factsTop + Math.floor(index / FACT_COLUMNS) * (FACT_HEIGHT + FACT_GAP);
    ctx.fillStyle = C.dust;
    ctx.fillRect(x, y, factWidth, FACT_HEIGHT);
    const fit = (value: string, role: ExportImageFontRole) => truncateToWidth(value, factWidth - 24, (t) => measure(t, role));
    text(ctx, fit(fact.label.toUpperCase(), 'label'), x + 12, y + 9, 'label', C.ink3);
    text(ctx, fit(fact.value, 'header'), x + 12, y + 27, 'header', C.ink);
  });
}

function drawLane(ctx: Ctx, lane: SharedViewLane, x: number, layout: SharedViewImageLayout, measure: MeasureText): void {
  const top = layout.lanesTop;
  ctx.fillStyle = C.dust;
  ctx.fillRect(x, top, layout.laneWidth, layout.lanesHeight);
  ctx.fillStyle = C.filament;
  ctx.fillRect(x, top + LANE_HEAD - 1, layout.laneWidth, 1);
  text(ctx, lane.title, x + 12, top + 12, 'header', C.ink);
  text(ctx, `${lane.rows.length} item${lane.rows.length === 1 ? '' : 's'}`, x + layout.laneWidth - 12, top + 13, 'small', C.ink3, 'right');

  if (lane.rows.length === 0) {
    text(ctx, `No ${lane.title.toLowerCase()} queued.`, x + layout.laneWidth / 2, top + LANE_HEAD + 13, 'small', C.ink2, 'center');
    return;
  }
  let y = top + LANE_HEAD;
  for (const row of lane.rows) {
    drawRow(ctx, row, x, y, layout.laneWidth, measure);
    y += rowHeightOf(row);
  }
}

function drawRow(ctx: Ctx, row: SharedViewRow, x: number, y: number, width: number, measure: MeasureText): void {
  if (row.status === 'active' || row.invalid) {
    ctx.fillStyle = row.invalid ? C.danger : C.halpha;
    ctx.fillRect(x, y, 2, rowHeightOf(row));
  }
  const right = [row.quantity > 1 ? `×${row.quantity}` : '', row.duration !== null ? `${row.duration}T` : ''].filter(Boolean);
  let rightX = x + width - 10;
  for (const part of [...right].reverse()) {
    text(ctx, part, rightX, y + 9, 'small', C.ink2, 'right');
    rightX -= measure(part, 'small') + 8;
  }
  text(ctx, row.span, x + 10, y + 9, 'small', C.ink3);
  const nameX = x + 78;
  const nameColor = row.invalid ? C.danger : row.status === 'completed' ? C.ink2 : C.ink;
  text(ctx, truncateToWidth(row.name, rightX - nameX - 4, (t) => measure(t, 'header')), nameX, y + 8, 'header', nameColor);
  if (row.invalid && row.invalidReason) {
    text(ctx, truncateToWidth(row.invalidReason, width - 20, (t) => measure(t, 'small')), x + 10, y + ROW_HEIGHT - 4, 'small', C.danger);
  }
  ctx.fillStyle = C.filament;
  ctx.fillRect(x, y + rowHeightOf(row) - 1, width, 1);
}

function drawFooter(ctx: Ctx, layout: SharedViewImageLayout): void {
  text(ctx, 'Infinite Conflict Build Planner', PAD, layout.footerTop, 'footer', C.ink3);
  layout.urlLines.forEach((line, index) => text(ctx, line, PAD, layout.footerTop + 18 + index * URL_LINE, 'small', C.ink2));
}
