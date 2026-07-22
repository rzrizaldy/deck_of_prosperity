import { GROUPS } from './data';
import { allCards, combinations, discardCards, playCards, priceFor, scoreHand } from './engine';
import { random, shuffle } from './rng';
import type { BotDecision, Card, CompetitorState, Difficulty, ScoreBreakdown, ShopState, Tycoon } from './types';

interface RankedPlay { cards: Card[]; score: ScoreBreakdown }

export function rankLegalPlays(side: Pick<CompetitorState, 'hand' | 'tycoons'>): RankedPlay[] {
  return combinations(side.hand, 5)
    .map((cards) => ({ cards, score: scoreHand(cards, side.tycoons) }))
    .sort((a, b) => b.score.total - a.score.total || b.cards.length - a.cards.length);
}

function discardCandidates(side: CompetitorState, best: RankedPlay): Card[][] {
  const groupCounts = new Map<string, number>();
  side.hand.forEach((card) => groupCounts.set(card.group, (groupCounts.get(card.group) ?? 0) + 1));
  const sorted = [...side.hand].sort((a, b) => {
    const aPotential = (groupCounts.get(a.group) ?? 0) / GROUPS[a.group].setSize;
    const bPotential = (groupCounts.get(b.group) ?? 0) / GROUPS[b.group].setSize;
    return aPotential - bPotential || (a.chips + a.bonus) - (b.chips + b.bonus);
  });
  const outsideBest = side.hand.filter((card) => !best.cards.some((picked) => picked.instanceId === card.instanceId)).slice(0, 5);
  const candidates = [outsideBest, ...Array.from({ length: 5 }, (_, index) => sorted.slice(0, index + 1))]
    .filter((cards) => cards.length > 0);
  const seen = new Set<string>();
  return candidates.filter((cards) => {
    const key = cards.map((card) => card.instanceId).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function expectedAfterDiscard(side: CompetitorState, discarded: Card[], samples: number, rngState: number): { expected: number; rngState: number } {
  const kept = side.hand.filter((card) => !discarded.some((item) => item.instanceId === card.instanceId));
  const available = [...side.drawPile, ...side.discardPile];
  let total = 0;
  let cursor = rngState;
  for (let sample = 0; sample < samples; sample += 1) {
    const mixed = shuffle(available, cursor);
    cursor = mixed.state;
    const testHand = [...kept, ...mixed.items.slice(0, discarded.length)];
    total += rankLegalPlays({ hand: testHand, tycoons: side.tycoons })[0]?.score.total ?? 0;
  }
  return { expected: total / samples, rngState: cursor };
}

export function chooseBotDecision(side: CompetitorState, difficulty: Difficulty, rngState: number): { decision: BotDecision; rngState: number } {
  const plays = rankLegalPlays(side);
  const best = plays[0];
  const samples = difficulty === 'casual' ? 8 : difficulty === 'trader' ? 20 : 40;
  let cursor = rngState;
  let bestDiscard: { cards: Card[]; expected: number } | null = null;

  if (side.discardsLeft > 0 && side.drawPile.length + side.discardPile.length > 0) {
    for (const candidate of discardCandidates(side, best)) {
      const estimate = expectedAfterDiscard(side, candidate, samples, cursor);
      cursor = estimate.rngState;
      if (!bestDiscard || estimate.expected > bestDiscard.expected) bestDiscard = { cards: candidate, expected: estimate.expected };
    }
  }

  const improvementGate = difficulty === 'casual' ? 1.22 : difficulty === 'trader' ? 1.14 : 1.08;
  if (bestDiscard && bestDiscard.expected > best.score.total * improvementGate) {
    return {
      decision: {
        kind: 'discard', cardIds: bestDiscard.cards.map((card) => card.instanceId),
        expectedScore: Math.round(bestDiscard.expected), rationale: 'Improves expected portfolio value.',
      },
      rngState: cursor,
    };
  }

  const choiceWindow = difficulty === 'casual' ? Math.min(5, plays.length) : difficulty === 'trader' ? Math.min(2, plays.length) : 1;
  const roll = random(cursor);
  const selected = plays[Math.floor(roll.value * choiceWindow)] ?? best;
  return {
    decision: {
      kind: 'play', cardIds: selected.cards.map((card) => card.instanceId),
      expectedScore: selected.score.total, rationale: `${selected.score.handName} is the strongest available commitment.`,
    },
    rngState: roll.state,
  };
}

export function resolveBotBout(side: CompetitorState, difficulty: Difficulty, rngState: number): {
  side: CompetitorState; rngState: number; score: ScoreBreakdown; discarded: number;
} {
  let current = side;
  let cursor = rngState;
  let discarded = 0;
  while (current.discardsLeft > 0) {
    const chosen = chooseBotDecision(current, difficulty, cursor);
    cursor = chosen.rngState;
    if (chosen.decision.kind === 'play') {
      const played = playCards(current, chosen.decision.cardIds, cursor);
      return { ...played, discarded };
    }
    const result = discardCards(current, chosen.decision.cardIds, cursor);
    current = result.side;
    cursor = result.rngState;
    discarded += chosen.decision.cardIds.length;
  }
  const chosen = chooseBotDecision(current, difficulty, cursor);
  const played = playCards(current, chosen.decision.cardIds, chosen.rngState);
  return { ...played, discarded };
}

export function tycoonDeckValue(tycoon: Tycoon, side: CompetitorState): number {
  const deck = allCards(side);
  const effect = tycoon.effect;
  if (effect.kind === 'chips_per_group') return deck.filter((card) => card.group === effect.group).length * effect.amount;
  if (effect.kind === 'mult_per_group') return deck.filter((card) => card.group === effect.group).length * effect.amount * 18;
  if (effect.kind === 'xmult_per_group') return deck.filter((card) => card.group === effect.group).length * (effect.amount - 1) * 180;
  if (effect.kind === 'chips_for_hand') return effect.amount * 0.8;
  if (effect.kind === 'xmult_hand_size') return effect.amount * 35;
  if (effect.kind === 'interest_cap') return side.cash >= 25 ? effect.amount * 8 : 5;
  return 30;
}

export function botShop(side: CompetitorState, shop: ShopState, rngState: number): { side: CompetitorState; rngState: number; message: string } {
  let current = side;
  const affordable = shop.tycoons
    .filter((tycoon) => current.tycoons.length < 5 && current.cash >= priceFor(current, tycoon.cost))
    .sort((a, b) => tycoonDeckValue(b, current) - tycoonDeckValue(a, current));
  const best = affordable[0];
  const messages: string[] = [];
  if (best) {
    const price = priceFor(current, best.cost);
    current = { ...current, cash: current.cash - price, tycoons: [...current.tycoons, best] };
    messages.push(`hired ${best.name}`);
  }
  const acquirePrice = priceFor(current, 4 + Math.floor(shop.acquisition.chips / 15));
  if (current.cash >= acquirePrice && shop.acquisition.chips >= 20) {
    const card: Card = { ...shop.acquisition, instanceId: `${shop.acquisition.id}-bot-market-${rngState}`, bonus: 0 };
    current = { ...current, cash: current.cash - acquirePrice, discardPile: [...current.discardPile, card] };
    messages.push(`acquired ${card.name}`);
  }
  return { side: current, rngState, message: messages.length ? `The rival ${messages.join(' and ')}.` : 'The rival held cash.' };
}
