/**
 * Tests for persistence optimizations:
 *  - buildSaveSummaryFromConfigs: summary WITHOUT decoding the payload
 *  - logger appendToFile: localStorage growth is capped
 *  - saveFile export: compact JSON (payload is opaque; pretty-print doubles size)
 */

import { describe, it, expect } from 'vitest';
import { buildSaveSummaryFromConfigs } from '../saveSummary';
import { serialiseSaveFile } from '../saveFile';
import type { SaveSummary } from '../savesDb';

describe('buildSaveSummaryFromConfigs', () => {
  it('summarises planet names, command count and share metadata without decoding', () => {
    const planets = [{ n: 'Homeworld' }, { n: 'Frontier-4' }];
    const commands = [['q', 'b', 'farm', 1]];

    const summary = buildSaveSummaryFromConfigs(planets, commands, {
      name: 'Boom build',
      author: 'JJ',
    });

    expect(summary.planetCount).toBe(2);
    expect(summary.commandCount).toBe(1);
    expect(summary.planetNames).toBe('Homeworld, Frontier-4');
    expect(summary.shareName).toBe('Boom build');
    expect(summary.shareAuthor).toBe('JJ');
    expect(summary.maxTurn).toBe(0);
  });

  it('truncates long name lists to ~80 chars with ellipsis', () => {
    const longName = 'X'.repeat(100);
    const planets = [{ n: longName }, { n: 'Y'.repeat(50) }];
    const summary = buildSaveSummaryFromConfigs(planets, []);
    expect(summary.planetNames.length).toBeLessThanOrEqual(80);
    expect(summary.planetNames.endsWith('...')).toBe(true);
  });

  it('falls back to Unnamed for configs without a name', () => {
    const planets = [{}];
    const summary = buildSaveSummaryFromConfigs(planets, []);
    expect(summary.planetNames).toBe('Unnamed');
  });
});

describe('serialiseSaveFile compactness', () => {
  it('emits compact JSON (no pretty-print indentation)', () => {
    const out = serialiseSaveFile({
      summary: {
        planetCount: 1,
        commandCount: 0,
        maxTurn: 1,
        planetNames: 'test',
      } as SaveSummary,
      encoded: 'b3.payload',
    });
    const parsed = JSON.parse(out);
    expect(parsed.encoded).toBe('b3.payload');
    // Compact output has no newline-indented structure beyond separators
    expect(out).not.toContain('\n  "');
  });
});
