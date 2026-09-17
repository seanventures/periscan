import "@testing-library/jest-dom/vitest";

// Node 25+ localStorage is undefined without --localstorage-file and shadows jsdom.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(String(key)) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    }
  } as Storage;
}

const memoryStorage = createMemoryStorage();

for (const target of [globalThis, typeof window === "undefined" ? null : window]) {
  if (!target) {
    continue;
  }
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    enumerable: true,
    value: memoryStorage,
    writable: true
  });
}
