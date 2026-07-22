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

const VOICES: Record<SoundName, Voice> = {
  draw: { notes: [300, 420], wave: 'triangle', step: 0.06, hold: 0.12, gain: 0.05 },
  select: { notes: [520], wave: 'triangle', step: 0.07, hold: 0.1, gain: 0.05 },
  deselect: { notes: [400], wave: 'triangle', step: 0.07, hold: 0.08, gain: 0.035 },
  discard: { notes: [250, 180], wave: 'square', step: 0.06, hold: 0.11, gain: 0.045 },
  shuffle: { notes: [220, 300, 260, 340], wave: 'triangle', step: 0.045, hold: 0.07, gain: 0.04 },
  play: { notes: [340], wave: 'triangle', step: 0.07, hold: 0.13, gain: 0.055 },
  chips: { notes: [390, 470], wave: 'triangle', step: 0.07, hold: 0.12, gain: 0.055 },
  multiplier: { notes: [560, 690], wave: 'triangle', step: 0.07, hold: 0.12, gain: 0.055 },
  score: { notes: [440, 660, 880], wave: 'triangle', step: 0.075, hold: 0.14, gain: 0.06 },
  purchase: { notes: [520, 780], wave: 'triangle', step: 0.07, hold: 0.13, gain: 0.055 },
  victory: { notes: [440, 554, 660, 880], wave: 'triangle', step: 0.1, hold: 0.24, gain: 0.06 },
  defeat: { notes: [330, 277, 220], wave: 'sawtooth', step: 0.13, hold: 0.28, gain: 0.055 },
};

/**
 * A light gamelan/disco-pop loop: metallic pelog-like tones over a syncopated
 * bass and hand-drum pulse. It is deliberately sparse so score sounds keep
 * their Balatro-style punch.
 */
const BGM_METAL = [293.66, 329.63, 369.99, 440, 493.88, 554.37];
const BGM_MELODY = [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 5, 3, 1, 2, 4];
const BGM_BASS = [73.42, 73.42, 82.41, 98];
const BGM_BEAT = 0.34;

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
 * Companion voice lines are deliberately separate from the procedural score
 * sounds. They are fired only when a hand is actually committed, never when
 * selecting cards, so the table still has a clean Balatro-like rhythm.
 */
const COMPANION_SFX: Partial<Record<CompanionId, string>> = {
  gemoy: '/assets/sfx/antekasync-play.mp3',
  soloman: '/assets/sfx/soloman-play.mp3',
};

const companionPlayers: Partial<Record<CompanionId, HTMLAudioElement>> = {};

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

export function playSound(name: SoundName, muted: boolean): void {
  if (muted || volume <= 0) return;
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'running' || !master) return;
  const bus = master;
  const voice = VOICES[name];
  const now = ctx.currentTime;
  voice.notes.forEach((frequency, index) => {
    const at = now + index * voice.step;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = voice.wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(voice.gain, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + voice.hold);
    oscillator.connect(gain).connect(bus);
    oscillator.start(at);
    oscillator.stop(at + voice.hold + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}

/** Play the selected Konco's short callout when the player commits a hand. */
export function playCompanionSfx(companion: CompanionId, muted: boolean): boolean {
  if (muted || volume <= 0 || typeof Audio === 'undefined') return false;
  const source = COMPANION_SFX[companion];
  if (!source) return false;
  const player = companionPlayers[companion] ?? new Audio(source);
  companionPlayers[companion] = player;
  player.currentTime = 0;
  player.volume = Math.min(1, volume * 0.9);
  void player.play().catch(() => undefined);
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
  gain.gain.exponentialRampToValueAtTime(level, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(bus);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.03);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function scheduleBgmStep(): void {
  const ctx = context;
  const bus = bgmGain;
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const step = bgmStep % 16;
  const metal = BGM_METAL[BGM_MELODY[step]];
  // Metallophone: doubled triangle/sine partials give the bright, struck tone.
  scheduleTone(ctx, bus, metal, now, BGM_BEAT * 1.55, 'triangle', step % 4 === 0 ? 0.2 : 0.14);
  scheduleTone(ctx, bus, metal * 2.01, now + 0.005, BGM_BEAT * 0.9, 'sine', 0.045);
  // Four-on-the-floor bass with an offbeat answer reads as disco, not ambience.
  if (step % 4 === 0 || step === 6 || step === 14) {
    scheduleTone(ctx, bus, BGM_BASS[Math.floor(step / 4) % BGM_BASS.length], now, BGM_BEAT * 1.65, 'sine', 0.21);
  }
  // A very short high pulse is the browser-friendly kendang accent.
  if (step % 4 === 2 || step === 7 || step === 15) {
    scheduleTone(ctx, bus, step % 4 === 2 ? 180 : 235, now, 0.06, 'square', 0.018);
  }
  bgmStep += 1;
}

/** Starts the ambient loop. No-op until audio has been unlocked by a gesture. */
export function startBgm(muted: boolean): void {
  if (muted || !bgmEnabled || volume <= 0 || bgmTimer !== null) return;
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'running' || !master) return;
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.11;
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
  if (context) node.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);
  window.setTimeout(() => node.disconnect(), 600);
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
