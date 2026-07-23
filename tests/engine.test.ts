import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CARD_TEMPLATES, MARKET_MODIFIERS, TYCOONS } from '../src/game/data';
import { createStartingDeck, drawToHand, identifyHand, marketTarget, prepareMarket, scoreHand } from '../src/game/engine';
import type { Card, PlayerState, GroupKey } from '../src/game/types';

let id = 0;
const card = (group: GroupKey, rank = 1, templateId = `${group.toLowerCase()}-${id}`): Card => ({
  id: templateId, instanceId: `test-${id++}`, name: templateId, group, rank, chips: rank * 5, bonus: 0,
});

describe('authoritative scoring engine', () => {
  it('scales published market targets by difficulty only', () => {
    expect(marketTarget(1, 'casual')).toBe(1740);
    expect(marketTarget(1, 'trader')).toBe(2800);
    expect(marketTarget(1, 'tycoon')).toBe(7000);
    expect(marketTarget(8, 'casual')).toBeLessThan(marketTarget(8, 'trader'));
    expect(marketTarget(8, 'trader')).toBeLessThan(marketTarget(8, 'tycoon'));
  });

  it('creates the specified 52-card ranked trading deck', () => {
    const deck = createStartingDeck('test');
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((item) => `${item.group}-${item.rank}`)).size).toBe(52);
  });

  it('has thirteen ranked assets in each of four classes', () => {
    const groups = new Set(CARD_TEMPLATES.map((item) => item.group));
    expect(groups.size).toBe(4);
    for (const group of groups) {
      const assets = CARD_TEMPLATES.filter((item) => item.group === group);
      expect(assets).toHaveLength(13);
      expect(assets.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    }
    expect(new Set(CARD_TEMPLATES.map((item) => item.name)).size).toBe(52);
    expect(CARD_TEMPLATES.every((item) => Boolean(item.artId))).toBe(true);
    for (const asset of CARD_TEMPLATES) {
      expect(existsSync(resolve(process.cwd(), `public/assets/cards/${asset.artId}.png`))).toBe(true);
    }
  });

  it.each([
    [[card('RESIDENTIAL', 9)], 'HIGH_ASSET'],
    [[card('RESIDENTIAL', 4), card('COMMERCIAL', 4)], 'PAIR'],
    [[card('RESIDENTIAL', 4), card('COMMERCIAL', 4), card('INNOVATION', 7), card('INFRASTRUCTURE', 7)], 'TWO_PAIRS'],
    [[card('RESIDENTIAL', 4), card('COMMERCIAL', 4), card('INNOVATION', 4)], 'THREE_KIND'],
    [[card('RESIDENTIAL', 3), card('COMMERCIAL', 4), card('INNOVATION', 5), card('INFRASTRUCTURE', 6), card('RESIDENTIAL', 7)], 'STRAIGHT'],
    [[card('RESIDENTIAL', 1), card('RESIDENTIAL', 3), card('RESIDENTIAL', 5), card('RESIDENTIAL', 7), card('RESIDENTIAL', 9)], 'FLUSH'],
    [[card('RESIDENTIAL', 4), card('COMMERCIAL', 4), card('INNOVATION', 4), card('INFRASTRUCTURE', 7), card('RESIDENTIAL', 7)], 'FULL_HOUSE'],
    [[card('RESIDENTIAL', 4), card('COMMERCIAL', 4), card('INNOVATION', 4), card('INFRASTRUCTURE', 4)], 'FOUR_KIND'],
    [[card('INFRASTRUCTURE', 3), card('INFRASTRUCTURE', 4), card('INFRASTRUCTURE', 5), card('INFRASTRUCTURE', 6), card('INFRASTRUCTURE', 7)], 'STRAIGHT_FLUSH'],
  ] as const)('recognizes a portfolio as %s', (cards, hand) => {
    expect(identifyHand([...cards])).toBe(hand);
  });

  it('applies chip, additive multiplier, then multiplicative effects', () => {
    const cards = [card('INNOVATION', 4), card('COMMERCIAL', 4), card('INFRASTRUCTURE', 4)];
    const project = TYCOONS.find((item) => item.id === 'bos-proyek')!;
    const flat = TYCOONS.find((item) => item.id === 'pak-notaris')!;
    const base = scoreHand(cards, [project, flat]);
    expect(base.cardChips).toBe(60);
    expect(base.bonusChips).toBe(25);
    expect(base.baseMultiplier).toBe(4);
    const prime = scoreHand([card('INFRASTRUCTURE', 3), card('INFRASTRUCTURE', 4), card('INFRASTRUCTURE', 5), card('INFRASTRUCTURE', 6), card('INFRASTRUCTURE', 7)], [TYCOONS.find((item) => item.id === 'investor-bodong')!]);
    expect(prime.multiplicative).toBeCloseTo(3.1275);
  });

  it('applies a public market modifier before Tycoon scoring', () => {
    const flood = MARKET_MODIFIERS.find((modifier) => modifier.id === 'BANJIR')!;
    const sidak = MARKET_MODIFIERS.find((modifier) => modifier.id === 'SIDAK')!;
    const regional = [card('RESIDENTIAL', 2), card('RESIDENTIAL', 2)];
    expect(scoreHand(regional, [], { modifier: flood }).cardChips).toBe(0);
    const notaris = TYCOONS.find((tycoon) => tycoon.id === 'pak-notaris')!;
    const withTycoon = scoreHand([card('COMMERCIAL', 2)], [notaris]);
    const inspected = scoreHand([card('COMMERCIAL', 2)], [notaris], { modifier: sidak });
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
    expect(reclaimed.side.hand.length + reclaimed.side.drawPile.length + reclaimed.exiled.length).toBe(52);
    const restored = prepareMarket(reclaimed.side, reclaimed.rngState, normal, reclaimed.exiled);
    expect(restored.exiled).toHaveLength(0);
    expect(restored.side.hand.length + restored.side.drawPile.length).toBe(52);
  });

  it('reshuffles the discard pile when the draw pile is empty and reports it', () => {
    const side: PlayerState = {
      hand: [], drawPile: [], discardPile: [card('RESIDENTIAL'), card('COMMERCIAL')],
      score: 0, cash: 4, tycoons: [], consumables: [], handsLeft: 4, discardsLeft: 3,
    };
    const result = drawToHand(side, 42, 2);
    expect(result.side.hand).toHaveLength(2);
    expect(result.side.discardPile).toHaveLength(0);
    expect(result.reshuffled).toBe(true);
  });

  it('does not report a reshuffle when the draw pile covers the deal', () => {
    const side: PlayerState = {
      hand: [], drawPile: [card('RESIDENTIAL'), card('COMMERCIAL'), card('INNOVATION')], discardPile: [card('INFRASTRUCTURE')],
      score: 0, cash: 4, tycoons: [], consumables: [], handsLeft: 4, discardsLeft: 3,
    };
    const result = drawToHand(side, 42, 2);
    expect(result.reshuffled).toBe(false);
    expect(result.side.discardPile).toHaveLength(1);
  });
});
