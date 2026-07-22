export type SoundName = 'draw' | 'select' | 'discard' | 'play' | 'chips' | 'multiplier' | 'score' | 'purchase' | 'victory' | 'defeat';

const NOTES: Record<SoundName, number[]> = {
  draw: [300, 420], select: [520], discard: [250, 180], play: [340], chips: [390, 470], multiplier: [560, 690], score: [440, 660, 880],
  purchase: [520, 780], victory: [440, 554, 660, 880], defeat: [330, 277, 220],
};

export function playSound(name: SoundName, muted: boolean): void {
  if (muted || typeof AudioContext === 'undefined') return;
  const context = new AudioContext();
  const now = context.currentTime;
  NOTES[name].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = name === 'defeat' ? 'sawtooth' : name === 'discard' ? 'square' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * 0.075);
    gain.gain.exponentialRampToValueAtTime(0.055, now + index * 0.075 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.075 + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + index * 0.075);
    oscillator.stop(now + index * 0.075 + 0.13);
  });
  window.setTimeout(() => void context.close(), 800);
}

export function pulseHaptic(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}
