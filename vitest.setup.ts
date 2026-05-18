import '@testing-library/jest-dom';

// jsdom doesn't ship ResizeObserver — stub it so components that use it render without errors.
// The stub fires no callbacks; tests that depend on responsive behaviour should mock it directly.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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
