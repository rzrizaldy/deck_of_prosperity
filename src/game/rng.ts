export interface RandomResult { value: number; state: number }

export function random(state: number): RandomResult {
  const next = (state + 0x6d2b79f5) | 0;
  let value = next;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, state: next >>> 0 };
}

export function shuffle<T>(items: T[], state: number): { items: T[]; state: number } {
  const result = [...items];
  let cursor = state;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const roll = random(cursor);
    cursor = roll.state;
    const swap = Math.floor(roll.value * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return { items: result, state: cursor };
}

export function pick<T>(items: T[], state: number): { item: T; state: number } {
  const roll = random(state);
  return { item: items[Math.floor(roll.value * items.length)], state: roll.state };
}
