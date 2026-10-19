import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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

if (typeof globalThis.ResizeObserver !== 'function') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

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

if (typeof globalThis.Element !== 'undefined'
  && typeof globalThis.Element.prototype.scrollIntoView !== 'function') {
  globalThis.Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

if (typeof globalThis.Element !== 'undefined'
  && typeof globalThis.Element.prototype.hasPointerCapture !== 'function') {
  globalThis.Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false;
  };
  globalThis.Element.prototype.setPointerCapture = function setPointerCapture(): void {};
  globalThis.Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
