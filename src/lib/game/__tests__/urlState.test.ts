import { describe, test, expect, beforeEach } from 'vitest';
import LZString from 'lz-string';
import {
  buildShareURL,
  decodeGameState,
  encodeGameState,
  getEncodedStateFromURL,
  getShareMetadataFromSnapshot,
  loadStateFromURL,
  saveEncodedStateToURL,
} from '../urlState';
import type { PlanetConfig } from '../gameState';

const homeworldConfig: PlanetConfig = {
  name: 'Homeworld',
  startTurn: 1,
  abundance: {
    metal: 1,
    mineral: 1,
    food: 1,
    energy: 1,
    research_points: 1,
  },
  space: {
    groundCap: 60,
    orbitalCap: 40,
  },
};

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

describe('URL state helpers', () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.history.replaceState(null, '', '/planner/?view=queue');
    window.localStorage.clear();
  });

  test('builds share URLs from the current app URL and encoded state', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [['q', 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands, {
      name: 'Orbital Rush',
      author: 'Ada',
      sharedAt: '2026-05-04T12:00:00.000Z',
    });
    const url = buildShareURL(encoded);
    const snapshot = decodeGameState(new URL(url).hash.substring(7));

    expect(url).toBe(`${window.location.origin}/planner/?view=queue#state=${encoded}`);
    expect(encoded.startsWith('b3.')).toBe(true);
    expect(snapshot?.cmds).toHaveLength(1);
    expect(snapshot ? getShareMetadataFromSnapshot(snapshot) : null).toEqual({
      name: 'Orbital Rush',
      author: 'Ada',
      sharedAt: '2026-05-04T12:00:00.000Z',
    });
  });

  test('binary v3 links are shorter than the equivalent compressed JSON link', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [
      ['q', 0, 11, 1],
      ['q', 0, 30, 1],
      ['q', 0, 33, 1],
      ['qr', 50],
      ['qw', 12],
    ];
    const metadata = {
      name: 'Orbital Rush',
      author: 'Ada',
      sharedAt: '2026-05-04T12:00:00.000Z',
    };
    const encoded = encodeGameState([homeworldConfig], commands, metadata);
    const legacyJson = JSON.stringify({
      v: 2,
      planets: [{ n: 'Homeworld' }],
      cmds: commands,
      share: { n: metadata.name, a: metadata.author, t: metadata.sharedAt },
    });
    const legacyEncoded = LZString.compressToEncodedURIComponent(legacyJson);

    expect(encoded.startsWith('b3.')).toBe(true);
    expect(encoded.length).toBeLessThan(legacyEncoded.length);
    expect(decodeGameState(encoded)?.cmds).toEqual(commands);
  });

  test('round-trips binary custom planets, research, resets, and share metadata', () => {
    const frontierConfig: PlanetConfig = {
      name: 'Frontier',
      startTurn: 17,
      abundance: {
        metal: 1.25,
        mineral: 0.9,
        food: 1.1,
        energy: 1.4,
        research_points: 1,
      },
      space: {
        groundCap: 75,
        orbitalCap: 55,
      },
      starting: {
        workersTotal: 24000,
        structures: {
          metal_mine: 2,
          mineral_extractor: 1,
          farm: 1,
          solar_generator: 3,
        },
      },
    };
    const commands: Parameters<typeof encodeGameState>[1] = [
      ['p', { n: 'Frontier', st: 17, a: [1.25, 0.9, 1.1, 1.4, 1], s: [75, 55], p: 24000, b: [2, 1, 1, 3] }],
      ['ep', 1, { n: 'Frontier Prime', st: 18, a: [1.3, 0.95, 1.1, 1.4, 1], s: [80, 60], p: 25000, b: [3, 1, 1, 3] }],
      ['q', 1, 11, 2],
      ['qr', 50],
      ['qw', 5],
      ['s', 1],
      ['xa'],
    ];

    const encoded = encodeGameState([homeworldConfig, frontierConfig], commands, {
      name: 'Binary Test',
      author: 'Ada',
      sharedAt: '2026-05-04T13:00:00.000Z',
    });
    const snapshot = decodeGameState(encoded);

    expect(encoded.startsWith('b3.')).toBe(true);
    expect(snapshot?.v).toBe(3);
    expect(snapshot?.planets).toEqual([
      { n: 'Homeworld' },
      { n: 'Frontier', st: 17, a: [1.25, 0.9, 1.1, 1.4, 1], s: [75, 55], p: 24000, b: [2, 1, 1, 3] },
    ]);
    expect(snapshot?.cmds).toEqual(commands);
    expect(snapshot ? getShareMetadataFromSnapshot(snapshot) : null).toEqual({
      name: 'Binary Test',
      author: 'Ada',
      sharedAt: '2026-05-04T13:00:00.000Z',
    });
  });

  test('still decodes legacy compressed JSON links', () => {
    const legacyEncoded = LZString.compressToEncodedURIComponent(JSON.stringify({
      v: 2,
      planets: [{ n: 'Homeworld' }],
      cmds: [['q', 0, 11, 1]],
    }));

    const snapshot = decodeGameState(legacyEncoded);

    expect(snapshot?.v).toBe(2);
    expect(snapshot?.cmds).toEqual([['q', 0, 11, 1]]);
  });

  test('persists encoded state without requiring a hash navigation event', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [['q', 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands);
    let hashChanges = 0;
    const countHashChange = () => {
      hashChanges += 1;
    };

    window.addEventListener('hashchange', countHashChange);
    saveEncodedStateToURL(encoded);
    window.removeEventListener('hashchange', countHashChange);

    expect(getEncodedStateFromURL()).toBe(encoded);
    expect(loadStateFromURL()?.cmds).toHaveLength(1);
    expect(window.localStorage.getItem('florent_save')).toBe(encoded);
    expect(hashChanges).toBe(0);
  });
});
