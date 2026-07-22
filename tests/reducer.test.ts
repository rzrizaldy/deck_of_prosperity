import { describe, expect, it } from 'vitest';
import { generateShop, scoreHand } from '../src/game/engine';
import { createRun, gameReducer } from '../src/game/reducer';
import type { GameState } from '../src/game/types';

function commitBest(state: GameState): GameState {
  const ids = [...state.player.hand]
    .sort((a, b) => scoreHand([b], state.player.tycoons).total - scoreHand([a], state.player.tycoons).total)
    .slice(0, 5)
    .map((card) => card.instanceId);
  let current = state;
  ids.forEach((cardId) => { current = gameReducer(current, { type: 'TOGGLE_CARD', cardId }); });
  return gameReducer(current, { type: 'PLAYER_PLAY' });
}

describe('campaign reducer', () => {
  it('creates a seeded solo market deck', () => {
    const run = createRun('trader', 100);
    expect(run.player.hand).toHaveLength(8);
    expect(run.player.hand.length + run.player.drawPile.length + run.marketExile.length).toBe(40);
    expect(run.marketExile).toHaveLength(run.modifier.id === 'REKLAMASI' ? 3 : 0);
    expect(run.player.hand.map((card) => card.instanceId)).toEqual(createRun('trader', 100).player.hand.map((card) => card.instanceId));
  });

  it('resolves a full four-hand solo round without illegal state', () => {
    let run = createRun('trader', 2026);
    for (let hand = 0; hand < 4; hand += 1) run = commitBest(run);
    expect(['shop', 'gameover']).toContain(run.phase);
    expect(run.player.handsLeft).toBe(0);
    expect(run.runScore).toBeGreaterThan(0);
  }, 20_000);

  it('counts and announces a discard-pile reshuffle', () => {
    const base = createRun('trader', 77);
    // Draw pile deep enough to refill: no recycle, no announcement.
    const stocked: GameState = { ...base, reshuffles: 0, selectedIds: [base.player.hand[0].instanceId] };
    const after = gameReducer(stocked, { type: 'PLAYER_DISCARD' });
    expect(after.player.hand).toHaveLength(8);
    expect(after.reshuffles).toBe(0);
    expect(after.events.at(-1)?.message).not.toMatch(/reshuffled/i);

    // Draw pile exhausted: the discard pile must be recycled to refill.
    const drained: GameState = {
      ...base,
      reshuffles: 0,
      player: { ...base.player, drawPile: [], discardPile: base.player.drawPile.slice(0, 4) },
      selectedIds: [base.player.hand[0].instanceId],
    };
    const recycled = gameReducer(drained, { type: 'PLAYER_DISCARD' });
    expect(recycled.player.hand).toHaveLength(8);
    expect(recycled.reshuffles).toBe(1);
    expect(recycled.events.at(-1)?.message).toMatch(/reshuffled/i);
  });

  it('caps selection at five cards and rejects empty plays', () => {
    let run = createRun('trader', 55);
    run.player.hand.forEach((card) => { run = gameReducer(run, { type: 'TOGGLE_CARD', cardId: card.instanceId }); });
    expect(run.selectedIds).toHaveLength(5);
    const empty = createRun('trader', 55);
    expect(gameReducer(empty, { type: 'PLAYER_PLAY' })).toBe(empty);
  });

  it('supports acquisition, renovation, liquidation, and Tycoon purchases', () => {
    const run = createRun('trader', 909);
    const generated = generateShop([], run.rngState);
    let market: GameState = {
      ...run,
      phase: 'shop',
      shop: generated.shop,
      player: { ...run.player, cash: 100 },
    };
    const startingSize = market.player.hand.length + market.player.drawPile.length + market.player.discardPile.length;
    market = gameReducer(market, { type: 'BUY_TYCOON', tycoonId: market.shop!.tycoons[0].id });
    expect(market.player.tycoons).toHaveLength(1);
    market = gameReducer(market, { type: 'BUY_ACQUISITION' });
    expect(market.player.hand.length + market.player.drawPile.length + market.player.discardPile.length).toBe(startingSize + 1);
    const cardId = market.player.hand[0].instanceId;
    market = gameReducer(market, { type: 'RENOVATE', cardId });
    expect(market.player.hand.find((card) => card.instanceId === cardId)?.bonus).toBe(5);
    market = gameReducer(market, { type: 'LIQUIDATE', cardId });
    expect(market.player.hand.some((card) => card.instanceId === cardId)).toBe(false);
  });

  it('enforces consumable capacity and resolves every legal one-use tool', () => {
    const run = createRun('trader', 1_234);
    const generated = generateShop([], run.rngState);
    let market: GameState = { ...run, phase: 'shop', shop: generated.shop, player: { ...run.player, cash: 100 } };
    const first = market.shop!.consumables[0];
    const second = market.shop!.consumables[1];
    market = gameReducer(market, { type: 'BUY_CONSUMABLE', consumableId: first.id });
    market = gameReducer(market, { type: 'BUY_CONSUMABLE', consumableId: second.id });
    expect(market.player.consumables).toHaveLength(2);

    const playing = { ...market, phase: 'playing' as const, selectedIds: [market.player.hand[0].instanceId], player: { ...market.player, consumables: [{ id: 'SERTIFIKAT', name: 'Sertifikat', description: '', cost: 3, art: 'sertifikat' }] } };
    const original = playing.player.hand[0];
    const retitled = gameReducer(playing, { type: 'USE_CONSUMABLE', consumableId: 'SERTIFIKAT' });
    expect(retitled.player.hand.find((card) => card.instanceId === original.instanceId)?.group).not.toBe(original.group);
    expect(retitled.player.consumables).toHaveLength(0);

    const copied = gameReducer({ ...playing, player: { ...playing.player, consumables: [{ id: 'NOTARIS', name: 'Notaris', description: '', cost: 4, art: 'notaris' }] } }, { type: 'USE_CONSUMABLE', consumableId: 'NOTARIS' });
    expect(copied.player.discardPile.some((card) => card.id === original.id)).toBe(true);

    const bribed = gameReducer({ ...playing, selectedIds: [], player: { ...playing.player, handsLeft: 1, consumables: [{ id: 'UANG_PELICIN', name: 'Uang Pelicin', description: '', cost: 4, art: 'uang-pelicin' }] } }, { type: 'USE_CONSUMABLE', consumableId: 'UANG_PELICIN' });
    expect(bribed.player.handsLeft).toBe(2);

    const seized = gameReducer({ ...playing, selectedIds: playing.player.hand.slice(0, 3).map((card) => card.instanceId), player: { ...playing.player, consumables: [{ id: 'SITA', name: 'Sita', description: '', cost: 4, art: 'sita' }] } }, { type: 'USE_CONSUMABLE', consumableId: 'SITA' });
    expect(seized.player.hand).toHaveLength(playing.player.hand.length - 3);

    const rerolled = gameReducer({ ...playing, selectedIds: [], modifier: { ...playing.modifier, id: 'BANJIR' }, player: { ...playing.player, consumables: [{ id: 'PUNGLI', name: 'Pungli', description: '', cost: 3, art: 'pungli' }] } }, { type: 'USE_CONSUMABLE', consumableId: 'PUNGLI' });
    expect(rerolled.modifier.id).not.toBe('BANJIR');
    expect(rerolled.modifier.id).not.toBe('REKLAMASI');
  });

  it('resolves explicit final-round victory and defeat states', () => {
    const base = createRun('trader', 404);
    const selected = base.player.hand[0].instanceId;
    const finalBase: GameState = {
      ...base,
      round: 8,
      selectedIds: [selected],
      player: { ...base.player, handsLeft: 1, score: 1_000_000 },
    };
    expect(gameReducer(finalBase, { type: 'PLAYER_PLAY' }).phase).toBe('victory');
    const losing: GameState = {
      ...finalBase,
      player: { ...finalBase.player, score: 0 },
    };
    expect(gameReducer(losing, { type: 'PLAYER_PLAY' }).phase).toBe('gameover');
  }, 20_000);
});
