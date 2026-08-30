/* ============================================================
 * Test setup — in-memory localStorage stub.
 *
 * The pure cognitive systems (AdaptiveDifficulty, PlayerModel,
 * LearningSignals, SkillGraph, ProgressStore) persist through
 * localStorage. Node has no localStorage, so we provide a tiny
 * spec-shaped stub. Tests call localStorage.clear() in beforeEach
 * for full isolation.
 * ============================================================ */

interface LS {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

function makeLocalStorage(): LS {
  let store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = String(value);
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      store = {};
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
    get length(): number {
      return Object.keys(store).length;
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: makeLocalStorage(),
  configurable: true,
  writable: true,
});
