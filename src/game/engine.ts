import { CARD_TEMPLATES, CONSUMABLES, HANDS, MARKET_MODIFIERS, STARTING_DUPLICATES, TYCOONS } from './data';
import { pick, shuffle } from './rng';
import type {
  Card, CardTemplate, PlayerState, Difficulty, GameState, HandKey,
  MarketModifier, ScoreBreakdown, ScoreContext, ShopState, Tycoon,
} from './types';

const HAND_SIZE = 8;
export const MAX_HANDS = 4;
export const MAX_DISCARDS = 3;
export const MAX_ROUNDS = 8;
export const MAX_TYCOONS = 7;
export const MIN_DECK_SIZE = 32;
export const MARKET_TARGETS = [2800, 3900, 5400, 7400, 10200, 14000, 19300, 26700] as const;
export const MARKET_DIFFICULTY: Record<Difficulty, { label: string; description: string; targetFactor: number }> = {
  casual: { label: 'Street', description: '62% published targets', targetFactor: 0.62 },
  trader: { label: 'Market', description: 'Published targets', targetFactor: 1 },
  tycoon: { label: 'High Stakes', description: '250% published targets', targetFactor: 2.5 },
};

const MODIFIER_TARGET_FACTOR: Record<MarketModifier['id'], number> = {
  BANJIR: 0.25,
  MACET: 0.45,
  MATI_LAMPU: 0.35,
  GANJIL_GENAP: 0.25,
  SIDAK: 0.35,
  MUSIM_KAWIN: 0.55,
  REKLAMASI: 0.45,
};

/** A public disruptive market lowers its target so it is a puzzle, not a wall. */
export function marketTarget(round: number, difficulty: Difficulty = 'trader', modifier?: MarketModifier): number {
  const baseline = MARKET_TARGETS[Math.min(Math.max(round, 1), MAX_ROUNDS) - 1];
  const targetFactor = MARKET_DIFFICULTY[difficulty].targetFactor * (modifier ? MODIFIER_TARGET_FACTOR[modifier.id] : 1);
  return Math.round((baseline * targetFactor) / 10) * 10;
}

/** Deterministic and public: the player always sees this before committing. */
export function chooseMarketModifier(rngState: number): { modifier: MarketModifier; rngState: number } {
  const picked = pick(MARKET_MODIFIERS, rngState);
  // Ganjil-Genap alternates its permitted parity from the seeded cursor.
  const modifier = picked.item.id === 'GANJIL_GENAP'
    ? { ...picked.item, parity: picked.state % 2 === 0 ? 'even' as const : 'odd' as const,
      summary: `Cuma aset chip ${(picked.state % 2 === 0 ? 'genap' : 'ganjil')} yang ngehasilin.` }
    : picked.item;
  return { modifier, rngState: picked.state };
}

export interface DrawResult {
  side: PlayerState;
  rngState: number;
  /** True when the discard pile had to be recycled to keep dealing. */
  reshuffled: boolean;
}

export function makeCard(template: CardTemplate, suffix: string): Card {
  return { ...template, instanceId: `${template.id}-${suffix}`, bonus: 0 };
}

export function createStartingDeck(owner: string): Card[] {
  const templates = [
    ...CARD_TEMPLATES,
    ...STARTING_DUPLICATES.map((id) => CARD_TEMPLATES.find((card) => card.id === id) as CardTemplate),
  ];
  return templates.map((template, index) => makeCard(template, `${owner}-${index}`));
}

export function allCards(side: PlayerState): Card[] {
  return [...side.hand, ...side.drawPile, ...side.discardPile];
}

export function deckSize(side: PlayerState): number {
  return side.hand.length + side.drawPile.length + side.discardPile.length;
}

export function drawToHand(side: PlayerState, rngState: number, size = HAND_SIZE): DrawResult {
  let drawPile = [...side.drawPile];
  let discardPile = [...side.discardPile];
  const hand = [...side.hand];
  let cursor = rngState;
  let reshuffled = false;

  while (hand.length < size) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      const mixed = shuffle(discardPile, cursor);
      drawPile = mixed.items;
      cursor = mixed.state;
      discardPile = [];
      reshuffled = true;
    }
    const card = drawPile.pop();
    if (card) hand.push(card);
  }
  return { side: { ...side, hand, drawPile, discardPile }, rngState: cursor, reshuffled };
}

export function createPlayer(owner: string, rngState: number): DrawResult {
  const mixed = shuffle(createStartingDeck(owner), rngState);
  const base: PlayerState = {
    drawPile: mixed.items,
    discardPile: [],
    hand: [],
    score: 0,
    cash: 4,
    tycoons: [],
    consumables: [],
    handsLeft: MAX_HANDS,
    discardsLeft: MAX_DISCARDS,
  };
  return drawToHand(base, mixed.state);
}

export function identifyHand(cards: Card[]): HandKey {
  const ranks = new Map<number, number>();
  cards.forEach((card) => ranks.set(card.rank, (ranks.get(card.rank) ?? 0) + 1));
  const multiplicities = [...ranks.values()].sort((a, b) => b - a);
  const flush = cards.length === 5 && new Set(cards.map((card) => card.group)).size === 1;
  const values = [...ranks.keys()].sort((a, b) => a - b);
  const straight = cards.length === 5 && values.length === 5 && values.every((rank, index) => index === 0 || rank === values[index - 1] + 1);
  if (straight && flush) return 'STRAIGHT_FLUSH';
  if (multiplicities[0] === 4) return 'FOUR_KIND';
  if (multiplicities[0] === 3 && multiplicities[1] === 2) return 'FULL_HOUSE';
  if (flush) return 'FLUSH';
  if (straight) return 'STRAIGHT';
  if (multiplicities[0] === 3) return 'THREE_KIND';
  if (multiplicities[0] === 2 && multiplicities[1] === 2) return 'TWO_PAIRS';
  if (multiplicities[0] === 2) return 'PAIR';
  return 'HIGH_ASSET';
}

function chipsForMarket(card: Card, modifier?: MarketModifier): number {
  const chips = card.chips + card.bonus;
  if (!modifier) return chips;
  if (modifier.id === 'BANJIR' && card.group === 'RESIDENTIAL') return 0;
  if (modifier.id === 'MACET' && card.group === 'INFRASTRUCTURE') return Math.floor(chips / 2);
  if (modifier.id === 'MATI_LAMPU' && card.group === 'INFRASTRUCTURE') return 0;
  if (modifier.id === 'GANJIL_GENAP' && chips % 2 !== (modifier.parity === 'odd' ? 1 : 0)) return 0;
  if (modifier.id === 'MUSIM_KAWIN') return card.group === 'COMMERCIAL' ? chips * 2 : Math.floor(chips * 0.8);
  return chips;
}

export function scoreHand(cards: Card[], tycoons: Tycoon[], context: ScoreContext = {}): ScoreBreakdown {
  if (cards.length === 0) {
    return {
      hand: 'HIGH_ASSET', handName: HANDS.HIGH_ASSET.name, cardChips: 0, bonusChips: 0,
      baseMultiplier: 0, bonusMultiplier: 0, multiplicative: 1, total: 0, notes: [],
    };
  }
  const hand = identifyHand(cards);
  const modifier = context.modifier;
  const cardChips = cards.reduce((sum, card) => sum + chipsForMarket(card, modifier), 0);
  let bonusChips = 0;
  let bonusMultiplier = 0;
  let multiplicative = 1;
  const notes: string[] = [];

  if (modifier && cardChips !== cards.reduce((sum, card) => sum + card.chips + card.bonus, 0)) {
    notes.push(`${modifier.name} changes this play's deed chips`);
  }
  if (modifier?.id === 'SIDAK') notes.push('Sidak disables all Tycoon effects');
  (modifier?.id === 'SIDAK' ? [] : tycoons).forEach((tycoon) => {
    const effect = tycoon.effect;
    if (effect.kind === 'chips_per_group') {
      const count = cards.filter((card) => card.group === effect.group).length;
      if (count) { bonusChips += count * effect.amount; notes.push(`${tycoon.name} +${count * effect.amount} chips`); }
    } else if (effect.kind === 'mult_per_group') {
      const count = cards.filter((card) => card.group === effect.group).length;
      if (count) { bonusMultiplier += count * effect.amount; notes.push(`${tycoon.name} +${count * effect.amount} mult`); }
    } else if (effect.kind === 'xmult_per_group') {
      const count = cards.filter((card) => card.group === effect.group).length;
      if (count) { multiplicative *= effect.amount ** count; notes.push(`${tycoon.name} ×${(effect.amount ** count).toFixed(2)}`); }
    } else if (effect.kind === 'xmult_hand_size' && cards.length === effect.size) {
      multiplicative *= effect.amount;
      notes.push(`${tycoon.name} ×${effect.amount}`);
    } else if (effect.kind === 'xmult_flat') {
      multiplicative *= effect.amount;
      notes.push(`${tycoon.name} ×${effect.amount}`);
    } else if (effect.kind === 'xmult_per_hand' && hand === effect.hand) {
      multiplicative *= effect.amount;
      notes.push(`${tycoon.name} ×${effect.amount}`);
    } else if (effect.kind === 'chips_for_hand' && hand === effect.hand) {
      bonusChips += effect.amount;
      notes.push(`${tycoon.name} +${effect.amount} chips`);
    }
    if (tycoon.xmult) {
      multiplicative *= tycoon.xmult;
      notes.push(`${tycoon.name} core ×${tycoon.xmult}`);
    }
  });

  const baseMultiplier = HANDS[hand].multiplier;
  const total = Math.floor((cardChips + bonusChips) * (baseMultiplier + bonusMultiplier) * multiplicative);
  return {
    hand, handName: HANDS[hand].name, cardChips, bonusChips, baseMultiplier,
    bonusMultiplier, multiplicative, total, notes,
  };
}

export function playCards(side: PlayerState, cardIds: string[], rngState: number, context: ScoreContext = {}): DrawResult & { score: ScoreBreakdown } {
  const chosen = side.hand.filter((card) => cardIds.includes(card.instanceId));
  if (chosen.length < 1 || chosen.length > 5 || side.handsLeft < 1) throw new Error('Illegal play');
  const score = scoreHand(chosen, side.tycoons, context);
  const next: PlayerState = {
    ...side,
    hand: side.hand.filter((card) => !cardIds.includes(card.instanceId)),
    discardPile: [...side.discardPile, ...chosen],
    score: side.score + score.total,
    handsLeft: side.handsLeft - 1,
  };
  const drawn = drawToHand(next, rngState);
  return { ...drawn, score };
}

export function discardCards(side: PlayerState, cardIds: string[], rngState: number): DrawResult {
  const chosen = side.hand.filter((card) => cardIds.includes(card.instanceId));
  if (chosen.length < 1 || chosen.length > 5 || side.discardsLeft < 1) throw new Error('Illegal discard');
  const next: PlayerState = {
    ...side,
    hand: side.hand.filter((card) => !cardIds.includes(card.instanceId)),
    discardPile: [...side.discardPile, ...chosen],
    discardsLeft: side.discardsLeft - 1,
  };
  return drawToHand(next, rngState);
}

export function interestFor(side: PlayerState): number {
  const cap = side.tycoons.reduce((current, tycoon) =>
    tycoon.effect.kind === 'interest_cap' ? Math.max(current, tycoon.effect.amount) : current, 5);
  return Math.min(Math.floor(side.cash / 5), cap);
}

export function priceFor(side: PlayerState, basePrice: number): number {
  const factor = side.tycoons.reduce((current, tycoon) =>
    tycoon.effect.kind === 'shop_discount' ? current * tycoon.effect.amount : current, 1);
  return Math.max(1, Math.ceil(basePrice * factor));
}

export function awardRound(side: PlayerState): PlayerState {
  return { ...side, cash: side.cash + 5 + interestFor(side) };
}

export function generateShop(owned: Tycoon[], rngState: number): { shop: ShopState; rngState: number } {
  const pool = TYCOONS.filter((tycoon) => !owned.some((item) => item.id === tycoon.id));
  const mixed = shuffle(pool.length >= 3 ? pool : TYCOONS, rngState);
  const acquired = pick(CARD_TEMPLATES, mixed.state);
  // Shop supplies get their own deterministic stream: adding an offer must not
  // silently change future public market events or invalidate seeded runs.
  const supplies = shuffle(CONSUMABLES, acquired.state ^ 0x9e3779b9);
  return {
    shop: {
      tycoons: mixed.items.slice(0, 3), acquisition: acquired.item,
      consumables: supplies.items.slice(0, 2), rerollCost: 2, renovations: 0, liquidated: false,
    },
    rngState: acquired.state,
  };
}

export function replaceCard(side: PlayerState, cardId: string, transform: (card: Card) => Card | null): PlayerState {
  const apply = (cards: Card[]) => cards.flatMap((card) => {
    if (card.instanceId !== cardId) return [card];
    const changed = transform(card);
    return changed ? [changed] : [];
  });
  return { ...side, hand: apply(side.hand), drawPile: apply(side.drawPile), discardPile: apply(side.discardPile) };
}

export function resetForRound(side: PlayerState, rngState: number): DrawResult {
  const mixed = shuffle(allCards(side), rngState);
  const reset: PlayerState = {
    ...side, hand: [], discardPile: [], drawPile: mixed.items,
    score: 0, handsLeft: MAX_HANDS, discardsLeft: MAX_DISCARDS,
  };
  return drawToHand(reset, mixed.state);
}

/** Restores last market's exiles, then applies the next public market event. */
export function prepareMarket(side: PlayerState, rngState: number, modifier: MarketModifier, restore: Card[] = []): DrawResult & { exiled: Card[] } {
  const mixed = shuffle([...allCards(side), ...restore], rngState);
  const exiled = modifier.id === 'REKLAMASI' ? mixed.items.slice(0, 3) : [];
  const reset: PlayerState = {
    ...side,
    hand: [], discardPile: [], drawPile: modifier.id === 'REKLAMASI' ? mixed.items.slice(3) : mixed.items,
    score: 0, handsLeft: MAX_HANDS, discardsLeft: MAX_DISCARDS,
  };
  const drawn = drawToHand(reset, mixed.state);
  return { ...drawn, exiled };
}

export function emptyState(muted = false): GameState {
  const empty: PlayerState = { drawPile: [], discardPile: [], hand: [], score: 0, cash: 4, tycoons: [], consumables: [], handsLeft: 4, discardsLeft: 3 };
  return {
    version: 2, phase: 'menu', difficulty: 'trader', companion: 'abah', round: 1,
    modifier: MARKET_MODIFIERS[0], marketExile: [], seed: 1, rngState: 1,
    player: empty, selectedIds: [], shop: null, events: [],
    lastPlayerScore: null, lastPlayedCards: [], muted, runScore: 0, reshuffles: 0,
  };
}
