import { CARD_TEMPLATES, GROUPS, HANDS, STARTING_DUPLICATES, TYCOONS } from './data';
import { pick, shuffle } from './rng';
import type {
  Card, CardTemplate, CompetitorState, GameState, GroupKey, HandKey,
  ScoreBreakdown, ShopState, Tycoon,
} from './types';

const HAND_SIZE = 8;
export const MAX_HANDS = 4;
export const MAX_DISCARDS = 3;
export const MAX_ROUNDS = 8;
export const MIN_DECK_SIZE = 32;

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

export function allCards(side: CompetitorState): Card[] {
  return [...side.hand, ...side.drawPile, ...side.discardPile];
}

export function deckSize(side: CompetitorState): number {
  return side.hand.length + side.drawPile.length + side.discardPile.length;
}

export function drawToHand(side: CompetitorState, rngState: number, size = HAND_SIZE): { side: CompetitorState; rngState: number } {
  let drawPile = [...side.drawPile];
  let discardPile = [...side.discardPile];
  const hand = [...side.hand];
  let cursor = rngState;

  while (hand.length < size) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      const mixed = shuffle(discardPile, cursor);
      drawPile = mixed.items;
      cursor = mixed.state;
      discardPile = [];
    }
    const card = drawPile.pop();
    if (card) hand.push(card);
  }
  return { side: { ...side, hand, drawPile, discardPile }, rngState: cursor };
}

export function createCompetitor(owner: string, rngState: number): { side: CompetitorState; rngState: number } {
  const mixed = shuffle(createStartingDeck(owner), rngState);
  const base: CompetitorState = {
    drawPile: mixed.items,
    discardPile: [],
    hand: [],
    score: 0,
    cash: 4,
    tycoons: [],
    handsLeft: MAX_HANDS,
    discardsLeft: MAX_DISCARDS,
  };
  return drawToHand(base, mixed.state);
}

export function identifyHand(cards: Card[]): HandKey {
  const counts = new Map<GroupKey, number>();
  cards.forEach((card) => counts.set(card.group, (counts.get(card.group) ?? 0) + 1));
  const entries = [...counts.entries()];
  const distinctRails = new Set(cards.filter((card) => card.group === 'RAILROAD').map((card) => card.id)).size;
  if (distinctRails >= 4) return 'TRANSPORT';
  if (cards.length === 5 && counts.size === 5) return 'DIVERSIFIED';

  const completed = entries.filter(([group, count]) => count >= GROUPS[group].setSize);
  const hasSeparatePair = completed.some(([completeGroup]) =>
    entries.some(([group, count]) => group !== completeGroup && count >= 2));
  if (completed.length > 0 && hasSeparatePair) return 'CONGLOMERATE';
  if (completed.length > 0) return 'MONOPOLY';
  const pairs = entries.filter(([, count]) => count >= 2).length;
  if (pairs >= 2) return 'JOINT_VENTURE';
  if (pairs === 1) return 'DEVELOPMENT';
  return 'LIQUIDATION';
}

export function scoreHand(cards: Card[], tycoons: Tycoon[]): ScoreBreakdown {
  if (cards.length === 0) {
    return {
      hand: 'LIQUIDATION', handName: 'Empty', cardChips: 0, bonusChips: 0,
      baseMultiplier: 0, bonusMultiplier: 0, multiplicative: 1, total: 0, notes: [],
    };
  }
  const hand = identifyHand(cards);
  const cardChips = cards.reduce((sum, card) => sum + card.chips + card.bonus, 0);
  let bonusChips = 0;
  let bonusMultiplier = 0;
  let multiplicative = 1;
  const notes: string[] = [];

  tycoons.forEach((tycoon) => {
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
    } else if (effect.kind === 'chips_for_hand' && hand === effect.hand) {
      bonusChips += effect.amount;
      notes.push(`${tycoon.name} +${effect.amount} chips`);
    }
  });

  const baseMultiplier = HANDS[hand].multiplier;
  const total = Math.floor((cardChips + bonusChips) * (baseMultiplier + bonusMultiplier) * multiplicative);
  return {
    hand, handName: HANDS[hand].name, cardChips, bonusChips, baseMultiplier,
    bonusMultiplier, multiplicative, total, notes,
  };
}

export function combinations<T>(items: T[], maxSize = 5): T[][] {
  const output: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length > 0) output.push([...current]);
    if (current.length === maxSize) return;
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      walk(index + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return output;
}

export function playCards(side: CompetitorState, cardIds: string[], rngState: number): { side: CompetitorState; rngState: number; score: ScoreBreakdown } {
  const chosen = side.hand.filter((card) => cardIds.includes(card.instanceId));
  if (chosen.length < 1 || chosen.length > 5 || side.handsLeft < 1) throw new Error('Illegal play');
  const score = scoreHand(chosen, side.tycoons);
  const next: CompetitorState = {
    ...side,
    hand: side.hand.filter((card) => !cardIds.includes(card.instanceId)),
    discardPile: [...side.discardPile, ...chosen],
    score: side.score + score.total,
    handsLeft: side.handsLeft - 1,
  };
  const drawn = drawToHand(next, rngState);
  return { ...drawn, score };
}

export function discardCards(side: CompetitorState, cardIds: string[], rngState: number): { side: CompetitorState; rngState: number } {
  const chosen = side.hand.filter((card) => cardIds.includes(card.instanceId));
  if (chosen.length < 1 || chosen.length > 5 || side.discardsLeft < 1) throw new Error('Illegal discard');
  const next: CompetitorState = {
    ...side,
    hand: side.hand.filter((card) => !cardIds.includes(card.instanceId)),
    discardPile: [...side.discardPile, ...chosen],
    discardsLeft: side.discardsLeft - 1,
  };
  return drawToHand(next, rngState);
}

export function interestFor(side: CompetitorState): number {
  const cap = side.tycoons.reduce((current, tycoon) =>
    tycoon.effect.kind === 'interest_cap' ? Math.max(current, tycoon.effect.amount) : current, 5);
  return Math.min(Math.floor(side.cash / 5), cap);
}

export function priceFor(side: CompetitorState, basePrice: number): number {
  const factor = side.tycoons.reduce((current, tycoon) =>
    tycoon.effect.kind === 'shop_discount' ? current * tycoon.effect.amount : current, 1);
  return Math.max(1, Math.ceil(basePrice * factor));
}

export function awardRound(side: CompetitorState): CompetitorState {
  return { ...side, cash: side.cash + 5 + interestFor(side) };
}

export function generateShop(owned: Tycoon[], rngState: number): { shop: ShopState; rngState: number } {
  const pool = TYCOONS.filter((tycoon) => !owned.some((item) => item.id === tycoon.id));
  const mixed = shuffle(pool.length >= 3 ? pool : TYCOONS, rngState);
  const acquired = pick(CARD_TEMPLATES, mixed.state);
  return {
    shop: {
      tycoons: mixed.items.slice(0, 3), acquisition: acquired.item,
      rerollCost: 2, renovated: false, liquidated: false,
    },
    rngState: acquired.state,
  };
}

export function replaceCard(side: CompetitorState, cardId: string, transform: (card: Card) => Card | null): CompetitorState {
  const apply = (cards: Card[]) => cards.flatMap((card) => {
    if (card.instanceId !== cardId) return [card];
    const changed = transform(card);
    return changed ? [changed] : [];
  });
  return { ...side, hand: apply(side.hand), drawPile: apply(side.drawPile), discardPile: apply(side.discardPile) };
}

export function resetForRound(side: CompetitorState, rngState: number): { side: CompetitorState; rngState: number } {
  const mixed = shuffle(allCards(side), rngState);
  const reset: CompetitorState = {
    ...side, hand: [], discardPile: [], drawPile: mixed.items,
    score: 0, handsLeft: MAX_HANDS, discardsLeft: MAX_DISCARDS,
  };
  return drawToHand(reset, mixed.state);
}

export function emptyState(muted = false): GameState {
  const empty: CompetitorState = { drawPile: [], discardPile: [], hand: [], score: 0, cash: 4, tycoons: [], handsLeft: 4, discardsLeft: 3 };
  return {
    version: 2, phase: 'menu', difficulty: 'trader', round: 1, seed: 1, rngState: 1,
    player: empty, bot: { ...empty }, selectedIds: [], shop: null, events: [],
    lastPlayerScore: null, lastBotScore: null, muted, runScore: 0,
  };
}
