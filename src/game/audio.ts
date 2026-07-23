import type { CompanionId } from './types';

export type SoundName =
  | 'draw' | 'select' | 'deselect' | 'discard' | 'shuffle' | 'play'
  | 'chips' | 'multiplier' | 'score' | 'purchase' | 'victory' | 'defeat';

export const VOLUME_KEY = 'doc-volume';
export const MUTED_KEY = 'doc-muted';
export const BGM_KEY = 'doc-bgm';

interface Voice {
  notes: number[];
  wave: OscillatorType;
  /** Seconds between successive notes. */
  step: number;
  /** Seconds each note rings for. */
  hold: number;
  gain: number;
}

/**
 * Harvest Moon / cozy-farming palette: soft sines, longer decays, major
 * pentatonic steps. Deliberately calmer than the dystopian capitalist twin.
 */
const VOICES: Record<SoundName, Voice> = {
  draw: { notes: [262, 330], wave: 'sine', step: 0.1, hold: 0.26, gain: 0.032 },
  select: { notes: [392], wave: 'sine', step: 0.08, hold: 0.18, gain: 0.028 },
  deselect: { notes: [294], wave: 'sine', step: 0.08, hold: 0.14, gain: 0.02 },
  discard: { notes: [247, 196], wave: 'triangle', step: 0.09, hold: 0.2, gain: 0.024 },
  shuffle: { notes: [220, 247, 262, 294], wave: 'sine', step: 0.06, hold: 0.12, gain: 0.022 },
  // Soft ascending kalimba when a hand hits the table.
  play: { notes: [330, 392, 523], wave: 'sine', step: 0.11, hold: 0.34, gain: 0.038 },
  chips: { notes: [349, 440], wave: 'sine', step: 0.1, hold: 0.26, gain: 0.032 },
  multiplier: { notes: [392, 494], wave: 'triangle', step: 0.11, hold: 0.28, gain: 0.03 },
  score: { notes: [330, 392, 523, 659], wave: 'sine', step: 0.12, hold: 0.36, gain: 0.04 },
  purchase: { notes: [349, 440, 523], wave: 'sine', step: 0.1, hold: 0.28, gain: 0.034 },
  victory: { notes: [262, 330, 392, 523, 659], wave: 'sine', step: 0.15, hold: 0.42, gain: 0.042 },
  defeat: { notes: [294, 262, 220], wave: 'sine', step: 0.17, hold: 0.4, gain: 0.028 },
};

/** Unhurried morning loop: C–D–E–G–A pentatonic, soft plucks over a warm bass. */
const BGM_METAL = [261.63, 293.66, 329.63, 392, 440, 523.25];
const BGM_MELODY = [0, 2, 4, 2, 3, 4, 2, 0, 1, 2, 4, 5, 4, 2, 1, 0];
const BGM_BASS = [65.41, 73.42, 82.41, 98];
const BGM_BEAT = 0.58;

function readNumber(key: string, fallback: number): number {
  if (typeof localStorage === 'undefined') return fallback;
  const stored = localStorage.getItem(key);
  if (stored === null) return fallback;
  const raw = Number(stored);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : fallback;
}

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === 'true';
}

let volume = readNumber(VOLUME_KEY, 0.7);
let bgmEnabled = readFlag(BGM_KEY, true);

/**
 * Companion callouts use the same warm procedural palette as the game. There
 * are no inherited dystopian voice clips in the published prosperity edition.
 */

/* ---------------------------------------------------------------- context */

let context: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function ensureContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
  }
  return context;
}

/**
 * Browsers refuse to start an AudioContext outside a user gesture. Call this
 * from any click/keydown handler; it is cheap and idempotent.
 */
export function unlockAudio(): void {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  unlocked = true;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

/* -------------------------------------------------------------- settings */

export function getVolume(): number {
  return volume;
}

export function setVolume(next: number): number {
  volume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0));
  if (typeof localStorage !== 'undefined') localStorage.setItem(VOLUME_KEY, String(volume));
  if (master) master.gain.value = volume;
  if (volume <= 0) stopBgm();
  return volume;
}

export function isBgmEnabled(): boolean {
  return bgmEnabled;
}

export function setBgmEnabled(next: boolean): boolean {
  bgmEnabled = next;
  if (typeof localStorage !== 'undefined') localStorage.setItem(BGM_KEY, String(next));
  if (!next) stopBgm();
  return bgmEnabled;
}

/* ----------------------------------------------------------------- sounds */

function pluck(ctx: AudioContext, bus: GainNode, frequency: number, at: number, hold: number, wave: OscillatorType, level: number): void {
  const oscillator = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const gain = ctx.createGain();
  const overtoneGain = ctx.createGain();
  oscillator.type = wave;
  oscillator.frequency.value = frequency;
  overtone.type = 'sine';
  overtone.frequency.value = frequency * 2;
  // Soft attack + long decay reads as kalimba / wood-chime, not arcade beep.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + hold);
  overtoneGain.gain.setValueAtTime(0.0001, at);
  overtoneGain.gain.exponentialRampToValueAtTime(level * 0.22, at + 0.012);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, at + hold * 0.72);
  oscillator.connect(gain).connect(bus);
  overtone.connect(overtoneGain).connect(bus);
  oscillator.start(at);
  overtone.start(at);
  oscillator.stop(at + hold + 0.04);
  overtone.stop(at + hold * 0.72 + 0.04);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  overtone.onended = () => { overtone.disconnect(); overtoneGain.disconnect(); };
}

export function playSound(name: SoundName, muted: boolean): void {
  if (muted || volume <= 0) return;
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'running' || !master) return;
  const bus = master;
  const voice = VOICES[name];
  const now = ctx.currentTime;
  voice.notes.forEach((frequency, index) => {
    pluck(ctx, bus, frequency, now + index * voice.step, voice.hold, voice.wave, voice.gain);
  });
}

/** Play the selected Konco's short callout when the player commits a hand. */
export function playCompanionSfx(companion: CompanionId, muted: boolean): boolean {
  if (muted || volume <= 0) return false;
  playSound(companion === 'abah' ? 'multiplier' : 'chips', muted);
  return true;
}

/* -------------------------------------------------------------------- bgm */

let bgmGain: GainNode | null = null;
let bgmTimer: number | null = null;
let bgmStep = 0;

function scheduleTone(ctx: AudioContext, bus: GainNode, frequency: number, at: number, duration: number, wave: OscillatorType, level: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = wave;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(bus);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.04);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function scheduleBgmStep(): void {
  const ctx = context;
  const bus = bgmGain;
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const step = bgmStep % 16;
  const metal = BGM_METAL[BGM_MELODY[step]];
  // Soft sine pluck + quiet octave = pastoral morning guitar/kecapi feel.
  scheduleTone(ctx, bus, metal, now, BGM_BEAT * 1.55, 'sine', step % 4 === 0 ? 0.12 : 0.08);
  scheduleTone(ctx, bus, metal * 2, now + 0.012, BGM_BEAT * 0.9, 'sine', 0.018);
  // Warm bass under every bar, never punchy.
  if (step % 4 === 0 || step === 8) {
    scheduleTone(ctx, bus, BGM_BASS[Math.floor(step / 4) % BGM_BASS.length], now, BGM_BEAT * 2.1, 'sine', 0.14);
  }
  // Barely-there high pulse keeps time without sounding like a drum kit.
  if (step === 4 || step === 12) {
    scheduleTone(ctx, bus, 523.25, now, 0.08, 'sine', 0.01);
  }
  bgmStep += 1;
}

/** Starts the ambient loop. No-op until audio has been unlocked by a gesture. */
export function startBgm(muted: boolean): void {
  if (muted || !bgmEnabled || volume <= 0 || bgmTimer !== null) return;
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'running' || !master) return;
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.1;
  bgmGain.connect(master);
  bgmStep = 0;
  scheduleBgmStep();
  bgmTimer = window.setInterval(scheduleBgmStep, BGM_BEAT * 1000);
}

export function stopBgm(): void {
  if (bgmTimer !== null) { window.clearInterval(bgmTimer); bgmTimer = null; }
  const node = bgmGain;
  bgmGain = null;
  if (!node) return;
  if (context) node.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
  window.setTimeout(() => node.disconnect(), 700);
}

export function isBgmPlaying(): boolean {
  return bgmTimer !== null;
}

/* ---------------------------------------------------------------- haptics */

let reducedMotion: MediaQueryList | null = null;

export function prefersReducedMotion(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  if (!reducedMotion) reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  return reducedMotion.matches;
}

/**
 * Haptics are motion, so honour prefers-reduced-motion. Audio keeps its own
 * mute/volume control and is deliberately not gated on it.
 */
export function pulseHaptic(pattern: number | number[]): void {
  if (prefersReducedMotion()) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}
