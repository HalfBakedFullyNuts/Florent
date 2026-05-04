import '@testing-library/jest-dom';

type VitestGlobal = typeof globalThis & {
  jsdom?: {
    window?: Window;
  };
};

const testWindow = (globalThis as VitestGlobal).jsdom?.window;

// Vitest aliases `window` to the Node global; use jsdom storage instead of Node 25's experimental storage.
if (testWindow?.localStorage && typeof testWindow.localStorage.getItem === 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: testWindow.localStorage,
  });
}
