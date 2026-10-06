import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom belum punya matchMedia; ThemeProvider memakainya untuk mode sistem.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom belum punya ResizeObserver; komponen yang mengukur tinggi elemen
// (mis. header bertingkat crosstab) butuh stub agar tidak crash.
if (typeof globalThis.ResizeObserver !== 'function') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom belum mengimplementasikan Range#selectNodeContents/getClientRects; kode
// pengukur tinggi header ExcelTable memakainya untuk menghitung jumlah baris.
const adaGetClientRects = typeof Range !== 'undefined'
  && typeof Range.prototype.getClientRects === 'function';

if (typeof globalThis.document !== 'undefined' && !adaGetClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return { length: 1, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
  };
}

// Bersihkan DOM + localStorage antar test agar prefersisten tidak bocor.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
