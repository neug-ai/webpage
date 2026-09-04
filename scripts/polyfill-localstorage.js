/**
 * Polyfill for localStorage in Node.js >= 22
 * 
 * Node.js 22+ introduces an experimental global localStorage object,
 * but it requires --localstorage-file to be configured with a valid path.
 * When not configured, localStorage.getItem/setItem throw errors.
 * 
 * Nextra's Tabs component calls localStorage.getItem during SSR,
 * which crashes the build. This polyfill provides a no-op in-memory
 * fallback so SSR compilation can proceed.
 */

if (typeof globalThis.localStorage !== 'undefined') {
  try {
    globalThis.localStorage.getItem('__test__');
  } catch {
    // localStorage exists but is broken — replace with in-memory stub
    const store = new Map();
    globalThis.localStorage = {
      getItem(key) { return store.get(key) ?? null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); },
      clear() { store.clear(); },
      get length() { return store.size; },
      key(index) { return [...store.keys()][index] ?? null; },
    };
  }
}
