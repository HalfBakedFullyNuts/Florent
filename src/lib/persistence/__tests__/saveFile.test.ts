import { describe, it, expect } from 'vitest';
import { serialiseSaveFile, parseSaveFile, parsePortableSaveText, buildDefaultFilename } from '../saveFile';
import { encodeGameState } from '../../game/urlState';
import { buildSaveSummary } from '../saveSummary';

const validEncoded = encodeGameState(
  [{ name: 'Homeworld', startTurn: 1, abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 }, space: { groundCap: 60, orbitalCap: 40 } }],
  [['q', 0, 11, 1]],
);
const sharedEncoded = encodeGameState(
  [{ name: 'Homeworld', startTurn: 1, abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 }, space: { groundCap: 60, orbitalCap: 40 } }],
  [['q', 0, 11, 1]],
  { name: 'Shared Opener', author: 'Ada', sharedAt: '2026-05-04T12:00:00.000Z' },
);

describe('saveFile', () => {
  it('round-trips encoded payload through serialise/parse', () => {
    const summary = buildSaveSummary(validEncoded);
    const json = serialiseSaveFile({ name: 'My save', encoded: validEncoded, summary });

    const parsed = parseSaveFile(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.file?.encoded).toBe(validEncoded);
    expect(parsed.file?.name).toBe('My save');
    expect(parsed.file?.app).toBe('florent');
  });

  it('recomputes metadata from the encoded payload on import', () => {
    const json = JSON.stringify({
      app: 'florent',
      format: 1,
      name: 'Tampered save',
      exportedAt: '2026-05-04T12:00:00.000Z',
      encoded: validEncoded,
      metadata: {
        planetCount: 999,
        commandCount: 999,
        maxTurn: 999,
        planetNames: 'Fake Planet',
        shareName: 'Fake Share',
        shareAuthor: 'Fake Author',
      },
    });

    const parsed = parseSaveFile(json);

    expect(parsed.ok).toBe(true);
    expect(parsed.file?.metadata.planetCount).toBe(1);
    expect(parsed.file?.metadata.commandCount).toBe(1);
    expect(parsed.file?.metadata.planetNames).toBe('Homeworld');
    expect(parsed.file?.metadata.shareName).toBeUndefined();
    expect(parsed.file?.metadata.shareAuthor).toBeUndefined();
  });

  it('rejects non-JSON', () => {
    const parsed = parseSaveFile('not json {[');
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toMatch(/not valid json/i);
  });

  it('imports a pasted shared URL', () => {
    const parsed = parsePortableSaveText(`https://example.test/#state=${sharedEncoded}`);

    expect(parsed.ok).toBe(true);
    expect(parsed.file?.encoded).toBe(sharedEncoded);
    expect(parsed.file?.name).toBe('Shared Opener');
    expect(parsed.file?.metadata.shareAuthor).toBe('Ada');
  });

  it('imports a raw state fragment', () => {
    const parsed = parsePortableSaveText(`#state=${validEncoded}`);

    expect(parsed.ok).toBe(true);
    expect(parsed.file?.encoded).toBe(validEncoded);
  });

  it('rejects files that are not Florent saves', () => {
    const parsed = parseSaveFile(JSON.stringify({ app: 'other', encoded: 'x' }));
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toMatch(/not a florent save/i);
  });

  it('rejects files with un-decodable payload', () => {
    const parsed = parseSaveFile(JSON.stringify({ app: 'florent', encoded: 'definitely-not-valid' }));
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toMatch(/could not be decoded/i);
  });

  it('builds a sanitised default filename', () => {
    expect(buildDefaultFilename('Tech rush!')).toMatch(/^Tech_rush_/);
    expect(buildDefaultFilename(undefined)).toMatch(/^florent-save_/);
    expect(buildDefaultFilename('   ')).toMatch(/^florent-save_/);
    expect(buildDefaultFilename('a/b\\c')).toMatch(/^a_b_c_/);
  });
});

describe('saveSummary', () => {
  it('extracts planet name and counts from a valid encoded payload', () => {
    const summary = buildSaveSummary(validEncoded);
    expect(summary.planetCount).toBe(1);
    expect(summary.commandCount).toBe(1);
    expect(summary.planetNames).toBe('Homeworld');
  });

  it('extracts shared-link metadata from encoded payloads', () => {
    const summary = buildSaveSummary(sharedEncoded);
    expect(summary.shareName).toBe('Shared Opener');
    expect(summary.shareAuthor).toBe('Ada');
  });

  it('returns a zero summary for an unparseable payload', () => {
    const summary = buildSaveSummary('not-encoded');
    expect(summary.planetCount).toBe(0);
    expect(summary.commandCount).toBe(0);
    expect(summary.planetNames).toBe('');
  });
});
