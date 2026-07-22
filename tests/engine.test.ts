import { describe, expect, it } from 'vitest';
import { CARD_TEMPLATES, MARKET_MODIFIERS, TYCOONS } from '../src/game/data';
import { createStartingDeck, drawToHand, identifyHand, marketTarget, prepareMarket, scoreHand } from '../src/game/engine';
import type { Card, PlayerState, GroupKey } from '../src/game/types';

let id = 0;
const card = (group: GroupKey, templateId = `${group.toLowerCase()}-${id}`): Card => ({
  id: templateId, instanceId: `test-${id++}`, name: templateId, group, chips: 10, bonus: 0,
});

describe('authoritative scoring engine', () => {
  it('scales published market targets by difficulty only', () => {
    expect(marketTarget(1, 'casual')).toBe(2100);
    expect(marketTarget(1, 'trader')).toBe(2800);
    expect(marketTarget(1, 'tycoon')).toBe(7000);
    expect(marketTarget(8, 'casual')).toBeLessThan(marketTarget(8, 'trader'));
    expect(marketTarget(8, 'trader')).toBeLessThan(marketTarget(8, 'tycoon'));
  });

  it('creates the specified 40-card starting deck', () => {
    const deck = createStartingDeck('test');
    expect(deck).toHaveLength(40);
    expect(new Set(deck.map((item) => item.instanceId)).size).toBe(40);
  });

  it('classifies Batam Port as a Transit asset, not a Java property', () => {
    expect(CARD_TEMPLATES.find((item) => item.id === 'batam')?.group).toBe('RAILROAD');
  });

  it.each([
    [[card('BROWN')], 'LIQUIDATION'],
    [[card('SKY'), card('SKY')], 'DEVELOPMENT'],
    [[card('SKY'), card('SKY'), card('RED'), card('RED')], 'JOINT_VENTURE'],
    [[card('RED'), card('RED'), card('RED')], 'TAKEOVER'],
    [[card('RED'), card('RED'), card('RED'), card('GREEN'), card('GREEN')], 'CONGLOMERATE'],
    [[card('BROWN'), card('SKY'), card('PINK'), card('ORANGE'), card('RED')], 'DIVERSIFIED'],
    [[card('RAILROAD', 'r1'), card('RAILROAD', 'r2'), card('RAILROAD', 'r3'), card('RAILROAD', 'r4')], 'TRANSPORT'],
  ] as const)('recognizes a portfolio as %s', (cards, hand) => {
    expect(identifyHand([...cards])).toBe(hand);
  });

  it('requires distinct railroads for a Transport Network', () => {
    const cards = [card('RAILROAD', 'same'), card('RAILROAD', 'same'), card('RAILROAD', 'r2'), card('RAILROAD', 'r3')];
    expect(identifyHand(cards)).toBe('TAKEOVER');
  });

  it('applies chip, additive multiplier, then multiplicative effects', () => {
    const cards = [card('RED'), card('RED'), card('RED')];
    const project = TYCOONS.find((item) => item.id === 'bos-proyek')!;
    const flat = TYCOONS.find((item) => item.id === 'pak-notaris')!;
    const base = scoreHand(cards, [project, flat]);
    expect(base.cardChips).toBe(30);
    expect(base.bonusChips).toBe(75);
    expect(base.baseMultiplier).toBe(5);
    expect(base.total).toBe(1521);
    const diversified = scoreHand([card('BLUE'), card('RED'), card('SKY'), card('PINK'), card('ORANGE')], [TYCOONS.find((item) => item.id === 'investor-bodong')!]);
    expect(diversified.multiplicative).toBeCloseTo(3.1275);
  });

  it('applies a public market modifier before Tycoon scoring', () => {
    const flood = MARKET_MODIFIERS.find((modifier) => modifier.id === 'BANJIR')!;
    const sidak = MARKET_MODIFIERS.find((modifier) => modifier.id === 'SIDAK')!;
    const regional = [card('BROWN'), card('BROWN')];
    expect(scoreHand(regional, [], { modifier: flood }).cardChips).toBe(0);
    const notaris = TYCOONS.find((tycoon) => tycoon.id === 'pak-notaris')!;
    const withTycoon = scoreHand([card('BLUE')], [notaris]);
    const inspected = scoreHand([card('BLUE')], [notaris], { modifier: sidak });
    expect(inspected.multiplicative).toBe(1);
    expect(inspected.total).toBeLessThan(withTycoon.total);
  });

  it('exiles exactly three cards for Reklamasi and restores prior exiles before the next market', () => {
    const reclamation = MARKET_MODIFIERS.find((modifier) => modifier.id === 'REKLAMASI')!;
    const normal = MARKET_MODIFIERS.find((modifier) => modifier.id === 'MACET')!;
    const side: PlayerState = {
      hand: [], drawPile: createStartingDeck('reclaim'), discardPile: [],
      score: 0, cash: 4, tycoons: [], consumables: [], handsLeft: 4, discardsLeft: 3,
    };
    const reclaimed = prepareMarket(side, 42, reclamation);
    expect(reclaimed.exiled).toHaveLength(3);
    expect(reclaimed.side.hand.length + reclaimed.side.drawPile.length + reclaimed.exiled.length).toBe(40);
    const restored = prepareMarket(reclaimed.side, reclaimed.rngState, normal, reclaimed.exiled);
    expect(restored.exiled).toHaveLength(0);
    expect(restored.side.hand.length + restored.side.drawPile.length).toBe(40);
  });

  it('reshuffles the discard pile when the draw pile is empty and reports it', () => {
    const side: PlayerState = {
      hand: [], drawPile: [], discardPile: [card('BROWN'), card('SKY')],
      score: 0, cash: 4, tycoons: [], consumables: [], handsLeft: 4, discardsLeft: 3,
    };
    const result = drawToHand(side, 42, 2);
    expect(result.side.hand).toHaveLength(2);
    expect(result.side.discardPile).toHaveLength(0);
    expect(result.reshuffled).toBe(true);
  });

  it('does not report a reshuffle when the draw pile covers the deal', () => {
    const side: PlayerState = {
      hand: [], drawPile: [card('BROWN'), card('SKY'), card('RED')], discardPile: [card('BLUE')],
      score: 0, cash: 4, tycoons: [], consumables: [], handsLeft: 4, discardsLeft: 3,
    };
    const result = drawToHand(side, 42, 2);
    expect(result.reshuffled).toBe(false);
    expect(result.side.discardPile).toHaveLength(1);
  });
});
