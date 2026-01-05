import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatické čištění po každém testu
afterEach(() => {
  cleanup();
});

// Mock pro localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock pro sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock pro matchMedia (používané pro responsive design)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock pro IntersectionObserver (používané pro lazy loading)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock pro ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock pro window.navigator.onLine
Object.defineProperty(window.navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock pro IndexedDB (bude nahrazeno fake-indexeddb v jednotlivých testech podle potřeby)
// Pro globální setup necháme základní mock
if (typeof window !== 'undefined' && !window.indexedDB) {
  (window as any).indexedDB = {
    open: vi.fn(),
    deleteDatabase: vi.fn(),
    cmp: vi.fn(),
  };
}

// Mock pro Blob (pro testy s file uploady)
if (typeof global.Blob === 'undefined') {
  (global as any).Blob = class Blob {
    constructor(parts?: any[], options?: any) {}
  };
}

// Mock pro File
if (typeof global.File === 'undefined') {
  (global as any).File = class File extends Blob {
    name: string;
    lastModified: number;

    constructor(parts: any[], filename: string, options?: any) {
      super(parts, options);
      this.name = filename;
      this.lastModified = Date.now();
    }
  };
}

// Mock pro URL.createObjectURL a revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  (URL as any).createObjectURL = vi.fn(() => 'mock-object-url');
  (URL as any).revokeObjectURL = vi.fn();
}

// Suppress console errors during tests (můžete odkomentovat pro čistší output)
// global.console.error = vi.fn();
// global.console.warn = vi.fn();

console.log('✅ Test environment setup complete');
