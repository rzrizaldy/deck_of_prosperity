import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  get length() { return this.data.size; }
}

function installStorage(seed: Record<string, string> = {}) {
  const storage = new MemoryStorage();
  Object.entries(seed).forEach(([key, value]) => storage.setItem(key, value));
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return storage;
}

describe('audio settings', () => {
  beforeEach(() => { vi.resetModules(); });

  it('defaults to an audible level with music on', async () => {
    installStorage();
    const audio = await import('../src/game/audio');
    expect(audio.getVolume()).toBeGreaterThan(0);
    expect(audio.getVolume()).toBeLessThanOrEqual(1);
    expect(audio.isBgmEnabled()).toBe(true);
  });

  it('persists the volume level under its own key', async () => {
    installStorage();
    const audio = await import('../src/game/audio');
    audio.setVolume(0.35);
    expect(localStorage.getItem(audio.VOLUME_KEY)).toBe('0.35');
    expect(audio.getVolume()).toBe(0.35);
  });

  it('restores a persisted volume on reload', async () => {
    installStorage({ 'doc-volume': '0.2' });
    const audio = await import('../src/game/audio');
    expect(audio.getVolume()).toBe(0.2);
  });

  it('clamps out-of-range and non-numeric input', async () => {
    installStorage();
    const audio = await import('../src/game/audio');
    expect(audio.setVolume(4)).toBe(1);
    expect(audio.setVolume(-2)).toBe(0);
    expect(audio.setVolume(Number.NaN)).toBe(0);
  });

  it('ignores a corrupt stored volume', async () => {
    installStorage({ 'doc-volume': 'loud' });
    const audio = await import('../src/game/audio');
    expect(audio.getVolume()).toBeGreaterThan(0);
  });

  it('persists the music toggle separately from mute', async () => {
    installStorage({ 'doc-muted': 'true' });
    const audio = await import('../src/game/audio');
    expect(audio.isBgmEnabled()).toBe(true);
    audio.setBgmEnabled(false);
    expect(localStorage.getItem(audio.BGM_KEY)).toBe('false');
    expect(localStorage.getItem(audio.MUTED_KEY)).toBe('true');
  });

  it('never starts audio without a running context', async () => {
    installStorage();
    const audio = await import('../src/game/audio');
    // No AudioContext in the node test environment: these must be inert.
    expect(() => audio.playSound('score', false)).not.toThrow();
    expect(() => audio.startBgm(false)).not.toThrow();
    expect(audio.isBgmPlaying()).toBe(false);
  });

  it('uses a procedural companion cue without loading a legacy voice clip', async () => {
    installStorage();
    const play = vi.fn().mockResolvedValue(undefined);
    const cue = { currentTime: 2, volume: 0, play };
    vi.stubGlobal('Audio', vi.fn(() => cue));
    const audio = await import('../src/game/audio');
    audio.setVolume(0.8);
    expect(audio.playCompanionSfx('bima', false)).toBe(true);
    expect(cue.currentTime).toBe(2);
    expect(cue.volume).toBe(0);
    expect(play).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('uses the warm companion cue and respects mute', async () => {
    installStorage();
    const play = vi.fn().mockResolvedValue(undefined);
    const audioElement = { currentTime: 4, volume: 0, play };
    vi.stubGlobal('Audio', vi.fn(() => audioElement));
    const audio = await import('../src/game/audio');
    expect(audio.playCompanionSfx('bima', true)).toBe(false);
    expect(audio.playCompanionSfx('sari', false)).toBe(true);
    expect(audioElement.currentTime).toBe(4);
    expect(play).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('skips haptics when the pointer device cannot vibrate', async () => {
    installStorage();
    const audio = await import('../src/game/audio');
    expect(() => audio.pulseHaptic([10, 20])).not.toThrow();
  });
});
