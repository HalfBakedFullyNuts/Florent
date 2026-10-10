import { describe, test, expect, beforeEach } from 'vitest';
import LZString from 'lz-string';
import {
  buildCompactShareURL,
  buildShareURL,
  CommandHistory,
  decodeGameState,
  encodeCompactShareState,
  encodeGameState,
  getEncodedStateFromURL,
  getShareMetadataFromSnapshot,
  loadStateFromURL,
  saveEncodedStateToURL,
  clearStateFromURL,
  replayCommands,
  type ReplayDrop,
} from '../urlState';
import { createInitialGameState, type PlanetConfig } from '../gameState';
import { getLaneView } from '../selectors';

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

  test('builds canonical root share URLs with encoded state', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [['q', 0, 11, 1]];
    const encoded = encodeGameState([homeworldConfig], commands, {
      name: 'Orbital Rush',
      author: 'Ada',
      sharedAt: '2026-05-04T12:00:00.000Z',
    });
    const url = buildShareURL(encoded);
    const snapshot = decodeGameState(new URL(url).hash.substring(7));

    expect(url).toBe(`${window.location.origin}/#state=${encoded}`);
    expect(encoded.startsWith('b3.')).toBe(true);
    expect(snapshot?.cmds).toHaveLength(1);
    expect(snapshot ? getShareMetadataFromSnapshot(snapshot) : null).toEqual({
      name: 'Orbital Rush',
      author: 'Ada',
      sharedAt: '2026-05-04T12:00:00.000Z',
    });
  });

  test('clears shared state back to the app root', () => {
    window.history.replaceState(null, '', '/unexpected/path/?old=1#state=abc');
    window.localStorage.setItem('florent_save', 'abc');

    clearStateFromURL();

    expect(window.location.href).toBe(`${window.location.origin}/`);
    expect(window.localStorage.getItem('florent_save')).toBeNull();
  });

  test('binary v3 links are shorter than the equivalent compressed JSON link', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [
      ['q', 0, 11, 1],
      ['q', 0, 30, 1],
      ['w', 0, 'b', 4],
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

  test('encodes compact q4 share links from the canonical plan', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [
      ['q', 0, 11, 1],
      ['w', 0, 'b', 3],
      ['q', 0, 30, 2],
      ['qr', 50],
      ['qw', 5],
    ];
    const gameState = replayCommands(createInitialGameState(), commands);
    const encoded = encodeCompactShareState(gameState, {
      name: 'Compact Rush',
      author: 'Ada',
      sharedAt: '2026-05-04T13:00:00.000Z',
    });
    const url = buildCompactShareURL(encoded);
    const snapshot = decodeGameState(encoded);
    const canonicalCommands: Parameters<typeof encodeGameState>[1] = [
      ['qr', 50],
      ['qw', 5],
      ['q', 0, 11, 1],
      ['w', 0, 'b', 3],
      ['q', 0, 30, 2],
    ];

    expect(encoded.startsWith('q4.')).toBe(true);
    expect(url).toBe(`${window.location.origin}/#q=${encoded.slice(3)}`);
    expect(snapshot?.v).toBe(4);
    expect(snapshot?.cmds).toEqual(canonicalCommands);
    expect(snapshot ? getShareMetadataFromSnapshot(snapshot) : null).toMatchObject({
      name: 'Compact Rush',
      author: 'Ada',
    });
  });

  test('loads compact q4 share payloads from query params for localhost summary testing', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [['q', 0, 11, 1]];
    const gameState = replayCommands(createInitialGameState(), commands);
    const encoded = encodeCompactShareState(gameState, {
      name: 'Query Share',
      author: 'Ada',
      sharedAt: '2026-05-04T13:00:00.000Z',
    });

    window.history.replaceState(null, '', `/?q=${encoded.slice(3)}`);

    expect(getEncodedStateFromURL()).toBe(encoded);
    expect(loadStateFromURL()?.cmds).toEqual(commands);
  });

  test('compact q4 preserves player-added one-turn waits as lane entries', () => {
    const commands: Parameters<typeof encodeGameState>[1] = [
      ['w', 0, 'b', 1],
      ['q', 0, 11, 1],
    ];
    const gameState = replayCommands(createInitialGameState(), commands);
    const encoded = encodeCompactShareState(gameState, {
      name: 'Wait Share',
      author: 'Ada',
      sharedAt: '2026-05-04T13:00:00.000Z',
    });
    const snapshot = decodeGameState(encoded);
    const restored = replayCommands(createInitialGameState(), snapshot?.cmds ?? []);
    const restoredHome = Array.from(restored.planets.values())[0];
    const finalState = restoredHome.timeline?.getStateAtTurn(200) ?? restoredHome;
    const buildingEntries = getLaneView(finalState, 'building').entries;

    expect(snapshot?.cmds).toEqual(commands);
    expect(buildingEntries.map((entry) => entry.itemId)).toEqual(['__wait__', 'farm']);
    expect(buildingEntries[0]).toMatchObject({
      itemId: '__wait__',
      isWait: true,
    });
  });

  test('compact q4 rejects malformed payloads cleanly', () => {
    expect(decodeGameState('q4.not-valid')).toBeNull();
    expect(decodeGameState('q4.')).toBeNull();
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
      ['w', 1, 'b', 6],
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

  test('round-trips expansion travel metadata in planet configs and add commands', () => {
    const expansionConfig: PlanetConfig = {
      name: 'Expansion',
      startTurn: 36,
      abundance: { metal: 1, mineral: 1, food: 1, energy: 1, research_points: 1 },
      space: { groundCap: 60, orbitalCap: 40 },
      expansion: {
        travelChoice: 'galaxy_to_galaxy',
        sourcePlanetIndex: 0,
        departureTurn: 10,
      },
    };
    const commandHistory = new CommandHistory();
    commandHistory.recordAddPlanet(expansionConfig);

    const encoded = encodeGameState(
      [homeworldConfig, expansionConfig],
      commandHistory.getCommands()
    );
    const snapshot = decodeGameState(encoded);
    const compactExpansion = {
      n: 'Expansion',
      st: 36,
      tc: 2,
      o: 0,
      d: 10,
    };

    expect(snapshot?.planets[1]).toEqual(compactExpansion);
    expect(snapshot?.cmds).toEqual([['p', compactExpansion]]);
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

describe('replayCommands drop reporting', () => {
  // v2 item codes: 11 = farm, 30 = metal_mine, 38 = research_lab
  test('reports a queued step that the current rules reject', () => {
    const drops: ReplayDrop[] = [];
    // Old plans queued a lab on the homeworld; it now starts with one (max 1 per planet)
    replayCommands(createInitialGameState(), [['q', 0, 38, 1]], (drop) => drops.push(drop));

    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ planetIndex: 0, itemId: 'research_lab', quantity: 1 });
    expect(drops[0].reason).toBeTruthy();
  });

  test('keeps replaying the remaining steps after a drop', () => {
    const drops: ReplayDrop[] = [];
    const replayed = replayCommands(
      createInitialGameState(),
      [['q', 0, 38, 1], ['q', 0, 30, 1]],
      (drop) => drops.push(drop),
    );
    const homeworld = replayed.planets.get('planet-1')!;
    const building = getLaneView(homeworld.timeline!.getStateAtTurn(1)!, 'building');

    expect(drops.map((drop) => drop.itemId)).toEqual(['research_lab']);
    expect(building.entries.map((entry) => entry.itemId)).toEqual(['metal_mine']);
  });

  test('reports nothing when every step applies', () => {
    const drops: ReplayDrop[] = [];
    replayCommands(createInitialGameState(), [['q', 0, 11, 1], ['q', 0, 30, 1]], (drop) => drops.push(drop));

    expect(drops).toEqual([]);
  });
});

describe('accepted resource shortfalls survive saving and sharing', () => {
  // Living Quarters (code 28) flagged to start without enough stock.
  const commands: Parameters<typeof encodeGameState>[1] = [
    ['q', 0, 11, 1],
    ['q', 0, 28, 1],
    ['sf', 0, 'b', 2],
  ];

  function buildingEntries(gameState: ReturnType<typeof createInitialGameState>) {
    const home = Array.from(gameState.planets.values())[0];
    return getLaneView(home.timeline!.getStateAtTurn(1)!, 'building').entries;
  }

  test('replaying an sf command marks that entry', () => {
    const entries = buildingEntries(replayCommands(createInitialGameState(), commands));
    expect(entries.map((entry) => [entry.itemId, entry.allowShortfall ?? false])).toEqual([
      ['farm', false],
      ['living_quarters', true],
    ]);
  });

  test('command history records the mark and the binary link keeps it', () => {
    const history = new CommandHistory();
    history.recordQueue(0, 'farm', 1, 'farm-entry');
    history.recordQueue(0, 'living_quarters', 1, 'lq-entry');
    history.recordAllowShortfall(0, 'building', 'lq-entry');

    expect(history.getCommands()).toEqual(commands);
    expect(decodeGameState(encodeGameState([homeworldConfig], history.getCommands()))?.cmds).toEqual(commands);
  });

  test('compact q4 links keep the mark, and plans without one encode as before', () => {
    const flagged = encodeCompactShareState(replayCommands(createInitialGameState(), commands));
    expect(decodeGameState(flagged)?.cmds).toEqual(commands);

    const plain = encodeCompactShareState(replayCommands(createInitialGameState(), commands.slice(0, 2)));
    expect(decodeGameState(plain)?.cmds).toEqual(commands.slice(0, 2));
    expect(plain.length).toBe(flagged.length); // the mark rides in the existing per-entry flag byte
  });
});
