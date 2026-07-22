import { describe, expect, it } from 'vitest';
import { chooseBotDecision, rankLegalPlays } from '../src/game/bot';
import { createCompetitor } from '../src/game/engine';
import type { Difficulty } from '../src/game/types';

describe('fair deterministic rival', () => {
  it('returns the same legal decision for the same visible state and seed', () => {
    const { side } = createCompetitor('bot-test', 12345);
    const first = chooseBotDecision(side, 'trader', 999);
    const second = chooseBotDecision(side, 'trader', 999);
    expect(second).toEqual(first);
    expect(first.decision.cardIds.length).toBeGreaterThanOrEqual(1);
    expect(first.decision.cardIds.length).toBeLessThanOrEqual(5);
    first.decision.cardIds.forEach((cardId) => expect(side.hand.some((card) => card.instanceId === cardId)).toBe(true));
  });

  it('difficulty precision is monotonic across seeded immediate plays', () => {
    const totals: Record<Difficulty, number> = { casual: 0, trader: 0, tycoon: 0 };
    for (let seed = 1; seed <= 120; seed += 1) {
      const { side } = createCompetitor(`bot-${seed}`, seed);
      const noDiscard = { ...side, discardsLeft: 0 };
      (Object.keys(totals) as Difficulty[]).forEach((difficulty) => {
        totals[difficulty] += chooseBotDecision(noDiscard, difficulty, seed * 77).decision.expectedScore;
      });
    }
    expect(totals.tycoon).toBeGreaterThanOrEqual(totals.trader);
    expect(totals.trader).toBeGreaterThanOrEqual(totals.casual);
  });

  it('enumerates only legal one-to-five-card plays', () => {
    const { side } = createCompetitor('enumeration', 88);
    const plays = rankLegalPlays(side);
    expect(plays).toHaveLength(218);
    expect(plays.every((play) => play.cards.length >= 1 && play.cards.length <= 5)).toBe(true);
  });
});
