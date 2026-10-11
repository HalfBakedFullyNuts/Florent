import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  IMAGE_SCALE,
  IMAGE_WIDTH,
  layoutSharedViewImage,
  renderSharedViewImage,
  truncateToWidth,
  type SharedViewImageInput,
} from '../sharedViewImage';
import type { SharedViewRow } from '../sharedViewModel';

// 7 px per character keeps the layout maths predictable.
const measure = (text: string) => text.length * 7;

function row(id: string, name: string, extra: Partial<SharedViewRow> = {}): SharedViewRow {
  return { id, span: 'T1 – T4', name, quantity: 1, duration: 4, status: 'pending', invalid: false, ...extra };
}

function input(overrides: Partial<SharedViewImageInput> = {}): SharedViewImageInput {
  return {
    name: 'Wolfpack',
    author: 'Ada',
    facts: [{ label: 'First outpost ship', value: 'T42' }],
    lanes: [
      { laneId: 'building', title: 'Structures', rows: [row('a', 'Farm'), row('b', 'Metal Mine')] },
      { laneId: 'ship', title: 'Ships', rows: [] },
      { laneId: 'colonist', title: 'Colonists', rows: [row('c', 'Scientist', { quantity: 100 })] },
      { laneId: 'research', title: 'Research', rows: [] },
    ],
    shareUrl: 'https://florent.example/#q=' + 'A'.repeat(300),
    ...overrides,
  };
}

describe('layoutSharedViewImage', () => {
  it('is 1200 px wide and grows with the longest lane', () => {
    const short = layoutSharedViewImage(input(), measure);
    const longLane = input();
    longLane.lanes[0].rows = Array.from({ length: 60 }, (_, i) => row(`r${i}`, `Entry ${i}`));
    const long = layoutSharedViewImage(longLane, measure);

    expect(short.width).toBe(IMAGE_WIDTH);
    expect(long.height - short.height).toBe(58 * long.rowHeight);
  });

  it('gives rows with a problem reason room for the reason line', () => {
    const plain = layoutSharedViewImage(input(), measure);
    const flagged = input();
    flagged.lanes[0].rows[1] = row('b', 'Metal Mine', { invalid: true, invalidReason: 'never starts: no free ground space' });
    expect(layoutSharedViewImage(flagged, measure).height).toBeGreaterThan(plain.height);
  });

  it('names an untitled list and leaves out empty author and facts', () => {
    const layout = layoutSharedViewImage(input({ name: '  ', author: undefined, facts: [] }), measure);
    expect(layout.title).toBe('Untitled build list');
    expect(layout.meta).not.toContain('by');
    expect(layout.factRows).toBe(0);
  });

  it('wraps the share link over full-width lines so none is cut off', () => {
    const layout = layoutSharedViewImage(input(), measure);
    expect(layout.urlLines.join('')).toBe(input().shareUrl);
    for (const line of layout.urlLines) expect(measure(line)).toBeLessThanOrEqual(layout.contentWidth);
  });
});

describe('truncateToWidth', () => {
  it('keeps text that fits and ends cut text with an ellipsis within the width', () => {
    expect(truncateToWidth('Farm', 100, measure)).toBe('Farm');
    const cut = truncateToWidth('Strip Mineral Extractor Research', 70, measure);
    expect(cut.endsWith('…')).toBe(true);
    expect(measure(cut)).toBeLessThanOrEqual(70);
  });
});

describe('renderSharedViewImage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws title, lanes, entries and the link at 2× scale', () => {
    const drawn: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(target, prop: string) {
        if (prop === 'fillText') return (text: string) => drawn.push(text);
        if (prop === 'measureText') return (text: string) => ({ width: text.length * 7 });
        if (!(prop in target)) target[prop] = () => undefined;
        return target[prop];
      },
      set(target, prop: string, value) {
        target[prop] = value;
        return true;
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

    const canvas = renderSharedViewImage(input());

    expect(canvas.width).toBe(IMAGE_WIDTH * IMAGE_SCALE);
    expect(drawn).toEqual(expect.arrayContaining(['Wolfpack', 'Structures', 'Farm', 'Scientist', '×100', 'No ships queued.']));
    expect(drawn.join('')).toContain('A'.repeat(100));
  });
});
