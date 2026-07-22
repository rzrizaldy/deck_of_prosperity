import { beforeEach, describe, expect, it } from 'vitest';
import { clearSave, LEGACY_SAVE_KEY, loadSave, migrateLegacySave, saveGame, SAVE_KEY } from '../src/game/persistence';
import { createRun } from '../src/game/reducer';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  get length() { return this.data.size; }
}

describe('versioned local persistence', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }); });

  it('round-trips a v2 run', () => {
    const run = createRun('tycoon', 8080);
    saveGame(run);
    expect(localStorage.getItem(SAVE_KEY)).toContain('"version":2');
    expect(loadSave()).toEqual(run);
    clearSave();
    expect(loadSave()).toBeNull();
  });

  it('retires an incompatible prototype save', () => {
    localStorage.setItem(LEGACY_SAVE_KEY, '{}');
    expect(migrateLegacySave()).toBe(true);
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });
});
