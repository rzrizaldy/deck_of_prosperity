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

  it('migrates the published placeholder companions to Abah and Azah', () => {
    const run = createRun('trader', 42);
    const oldSave = { version: 2, savedAt: 1, state: { ...run, companion: 'sari' } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldSave));
    expect(loadSave()?.companion).toBe('abah');
    oldSave.state.companion = 'bima';
    localStorage.setItem(SAVE_KEY, JSON.stringify(oldSave));
    expect(loadSave()?.companion).toBe('azah');
  });

  it('refreshes saved cards to the current asset ladder without losing renovations', () => {
    const run = createRun('trader', 42);
    const savedCard = run.player.drawPile[0];
    savedCard.name = 'Outdated asset';
    savedCard.artId = 'outdated-art';
    savedCard.chips = 999;
    savedCard.bonus = 15;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, savedAt: 1, state: run }));
    const loaded = loadSave()!;
    const refreshed = loaded.player.drawPile.find((card) => card.instanceId === savedCard.instanceId)!;
    expect(refreshed.name).not.toBe('Outdated asset');
    expect(refreshed.artId).not.toBe('outdated-art');
    expect(refreshed.chips).not.toBe(999);
    expect(refreshed.bonus).toBe(15);
  });

  it('retires an incompatible prototype save', () => {
    localStorage.setItem(LEGACY_SAVE_KEY, '{}');
    expect(migrateLegacySave()).toBe(true);
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });
});
