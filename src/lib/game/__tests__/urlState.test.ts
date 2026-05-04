import { describe, test, expect, beforeEach } from 'vitest';
import {
  buildShareURL,
  decodeGameState,
  encodeGameState,
  getEncodedStateFromURL,
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
    const encoded = encodeGameState([homeworldConfig], commands);
    const url = buildShareURL(encoded);

    expect(url).toBe(`${window.location.origin}/planner/?view=queue#state=${encoded}`);
    expect(decodeGameState(new URL(url).hash.substring(7))?.cmds).toHaveLength(1);
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
