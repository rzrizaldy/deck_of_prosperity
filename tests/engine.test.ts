import { describe, expect, it } from 'vitest';
import { TYCOONS } from '../src/game/data';
import { createStartingDeck, drawToHand, identifyHand, scoreHand } from '../src/game/engine';
import type { Card, CompetitorState, GroupKey } from '../src/game/types';

let id = 0;
const card = (group: GroupKey, templateId = `${group.toLowerCase()}-${id}`): Card => ({
  id: templateId, instanceId: `test-${id++}`, name: templateId, group, chips: 10, bonus: 0,
});

describe('authoritative scoring engine', () => {
  it('creates the specified 40-card starting deck', () => {
    const deck = createStartingDeck('test');
    expect(deck).toHaveLength(40);
    expect(new Set(deck.map((item) => item.instanceId)).size).toBe(40);
  });

  it.each([
    [[card('BROWN')], 'LIQUIDATION'],
    [[card('SKY'), card('SKY')], 'DEVELOPMENT'],
    [[card('SKY'), card('SKY'), card('RED'), card('RED')], 'JOINT_VENTURE'],
    [[card('RED'), card('RED'), card('RED')], 'MONOPOLY'],
    [[card('RED'), card('RED'), card('RED'), card('GREEN'), card('GREEN')], 'CONGLOMERATE'],
    [[card('BROWN'), card('SKY'), card('PINK'), card('ORANGE'), card('RED')], 'DIVERSIFIED'],
    [[card('RAILROAD', 'r1'), card('RAILROAD', 'r2'), card('RAILROAD', 'r3'), card('RAILROAD', 'r4')], 'TRANSPORT'],
  ] as const)('recognizes a portfolio as %s', (cards, hand) => {
    expect(identifyHand([...cards])).toBe(hand);
  });

  it('requires distinct railroads for a Transport Network', () => {
    const cards = [card('RAILROAD', 'same'), card('RAILROAD', 'same'), card('RAILROAD', 'r2'), card('RAILROAD', 'r3')];
    expect(identifyHand(cards)).toBe('MONOPOLY');
  });

  it('applies chip, additive multiplier, then multiplicative effects', () => {
    const cards = [card('RED'), card('RED'), card('RED')];
    const red = TYCOONS.find((item) => item.id === 'red-baron')!;
    const lone = TYCOONS.find((item) => item.id === 'lone-wolf')!;
    const base = scoreHand(cards, [red, lone]);
    expect(base.cardChips).toBe(30);
    expect(base.bonusChips).toBe(45);
    expect(base.baseMultiplier).toBe(5);
    expect(base.total).toBe(375);
    const solo = scoreHand([card('BLUE')], [lone]);
    expect(solo.total).toBe(20);
    expect(solo.multiplicative).toBe(2);
  });

  it('reshuffles the discard pile when the draw pile is empty', () => {
    const side: CompetitorState = {
      hand: [], drawPile: [], discardPile: [card('BROWN'), card('SKY')],
      score: 0, cash: 4, tycoons: [], handsLeft: 4, discardsLeft: 3,
    };
    const result = drawToHand(side, 42, 2);
    expect(result.side.hand).toHaveLength(2);
    expect(result.side.discardPile).toHaveLength(0);
  });
});
